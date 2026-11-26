/**
 * Predefiniowane sklepy tematyczne WFRP 4e/5e: tworzenie aktora Item Piles,
 * losowanie dostępności według osady (tryb 1B), otwieranie/zamykanie i synchronizacja z kompendiami.
 */
import { MODULE_ID, t, log } from "./constants.mjs";
import { physicalTypes } from "./availability.mjs";
import { gatherCandidates, rollStockDice } from "./merchant.mjs";
import { matchesShopPreset, planShopAvailability, settlementLimit } from "./presets.mjs";
import { canonicalItemKey, resolveArmourType } from "./sources.mjs";

export const SHOP_FLAG = "shop";
export const MANAGED_FLAG = "shopManaged";

function randomUniform() {
  return CONFIG.Dice.randomUniform();
}

function activeArmourType() {
  const mode = game.settings.settings.has(`${MODULE_ID}.shopArmourRules`)
    ? game.settings.get(MODULE_ID, "shopArmourRules")
    : "auto";
  const activeModules = new Set([...game.modules.values()].filter((m) => m.active).map((m) => m.id));
  return resolveArmourType(mode, CONFIG.Item.dataModels, activeModules);
}

/** Metadane sklepu zapisane na aktorze albo null. */
export function shopMeta(actor) {
  return actor?.getFlag?.(MODULE_ID, SHOP_FLAG) ?? null;
}

/** Czy sklep jest otwarty dla graczy (domyślny brak flagi openTimes oznacza otwarty). */
export function isShopOpen(actor) {
  return actor?.getFlag?.("item-piles", "data")?.openTimes?.status !== "closed";
}

/** Otwiera lub zamyka sklep (flaga Item Piles `openTimes.status`). */
export async function toggleShopOpen(actor, open) {
  if (!actor) return false;
  const next = open === undefined ? !isShopOpen(actor) : Boolean(open);
  await actor.setFlag("item-piles", "data.openTimes.status", next ? "open" : "closed");
  return next;
}

/** Otwiera interfejs sklepu Item Piles dla danego kupca. */
export function openShopInterface(actor) {
  if (actor) return game.itempiles?.API.renderItemPileInterface(actor);
}

/** Domyślne flagi Item Piles dla tematycznego sklepu: sprzedaż wyłączona, zamknięty, zachowuje 0 szt. */
export function buildMerchantFlags() {
  return {
    enabled: true,
    type: "merchant",
    purchaseOnly: true,
    keepZeroQuantity: true,
    hideItemsWithZeroCost: true,
    openTimes: {
      enabled: false,
      status: "closed",
      open: { hour: 9, minute: 0 },
      close: { hour: 18, minute: 0 }
    }
  };
}

async function ensureShopsFolder() {
  const name = t("Shop.Folder");
  const existing = game.folders.find((f) => f.type === "Actor" && f.name === name && !f.folder);
  if (existing) return existing.id;
  const created = await getDocumentClass("Folder").create({ name, type: "Actor" });
  return created?.id ?? null;
}

function applyAvailabilityToItemData(data, entry, quantityPath) {
  foundry.utils.setProperty(data, quantityPath, entry.quantity);
  foundry.utils.setProperty(data, "flags.item-piles.item.hidden", !entry.available);
  foundry.utils.setProperty(data, "flags.item-piles.item.infiniteQuantity", entry.infinite ? "yes" : "no");
  foundry.utils.setProperty(data, `flags.${MODULE_ID}.${MANAGED_FLAG}`, true);
}

async function matchingCandidates(adapter, presetId) {
  const types = physicalTypes(CONFIG.Item.dataModels).filter((type) => !["money", "cargo"].includes(type));
  const candidates = await gatherCandidates(adapter, types);
  const armourType = activeArmourType();
  return candidates.filter((c) => matchesShopPreset(c, presetId, { armourType }));
}

/**
 * Tworzy nowy sklep tematyczny z szablonu i wypełnia go przedmiotami z posiadanych kompendiów.
 */
export async function createPresetShop(adapter, { presetId, name, location, modifier = 0, limit }) {
  if (!adapter?.shopPresets?.length) return null;
  const locations = adapter.locations(game) ?? [];
  const chosenLocation = location ?? locations[0]?.key ?? "MARKET.Village";
  const chosenLimit = Number(limit) > 0 ? Number(limit) : settlementLimit(chosenLocation);
  const shopName = String(name ?? "").trim() || t(`Shop.Presets.${presetId}`);

  const candidates = await matchingCandidates(adapter, presetId);
  const plan = planShopAvailability(
    candidates.map((c) => ({ id: c.uuid, rarity: c.rarity, managed: true })),
    {
      rowFor: (item) => adapter.rowFor(game, chosenLocation, item.rarity),
      limit: chosenLimit,
      modifier: Number(modifier) || 0,
      random: randomUniform,
      rollDice: rollStockDice
    }
  );
  const byUuid = new Map(plan.updates.map((u) => [u.id, u]));

  const items = [];
  for (const candidate of candidates) {
    const doc = await fromUuid(candidate.uuid);
    if (!doc) continue;
    const data = doc.toObject();
    delete data._id;
    applyAvailabilityToItemData(data, byUuid.get(candidate.uuid) ?? { available: false, quantity: 0, infinite: false }, adapter.quantityPath);
    items.push(data);
  }

  const folder = await ensureShopsFolder();
  const actor = await Actor.create({
    name: shopName,
    type: adapter.actorType,
    folder,
    flags: {
      "item-piles": { data: buildMerchantFlags() },
      [MODULE_ID]: { [SHOP_FLAG]: { preset: presetId, location: chosenLocation, modifier: Number(modifier) || 0, limit: chosenLimit } }
    },
    items
  });

  log.info(`utworzono sklep ${shopName} (${presetId}, ${chosenLocation}): ${plan.availableCount}/${items.length} dostępnych`);
  return { actor, availableCount: plan.availableCount, totalCount: items.length };
}

/**
 * Przelosowuje dostępność wszystkich zarządzanych przedmiotów istniejącego kupca dla wybranej osady.
 */
export async function rerollShopAvailability(adapter, actor, { location, modifier = 0, limit, includeManual = false } = {}) {
  if (!adapter || !actor) return null;
  const meta = shopMeta(actor);
  const locations = adapter.locations(game) ?? [];
  const chosenLocation = location ?? meta?.location ?? locations[0]?.key ?? "MARKET.Village";
  const chosenLimit = Number(limit) > 0 ? Number(limit) : settlementLimit(chosenLocation);
  const physical = new Set(physicalTypes(CONFIG.Item.dataModels).filter((type) => !["money", "cargo"].includes(type)));

  const items = actor.items
    .filter((i) => physical.has(i.type))
    .map((i) => ({
      id: i.id,
      rarity: adapter.rarityOf(i),
      managed: meta?.preset ? i.getFlag(MODULE_ID, MANAGED_FLAG) !== false : true
    }));

  const plan = planShopAvailability(items, {
    rowFor: (item) => adapter.rowFor(game, chosenLocation, item.rarity),
    limit: chosenLimit,
    modifier: Number(modifier) || 0,
    random: randomUniform,
    rollDice: rollStockDice,
    includeManual
  });

  if (plan.updates.length) {
    const docs = plan.updates.map((u) => ({
      _id: u.id,
      [adapter.quantityPath]: u.quantity,
      "flags.item-piles.item.hidden": !u.available,
      "flags.item-piles.item.infiniteQuantity": u.infinite ? "yes" : "no"
    }));
    await actor.updateEmbeddedDocuments("Item", docs);
  }

  await actor.setFlag(MODULE_ID, SHOP_FLAG, {
    ...(meta ?? {}),
    location: chosenLocation,
    modifier: Number(modifier) || 0,
    limit: chosenLimit
  });

  log.info(`przelosowano dostępność ${actor.name} (${chosenLocation}): ${plan.availableCount} dostępnych, ${plan.hiddenCount} ukrytych`);
  return plan;
}

/**
 * Dociąga brakujące przedmioty pasujące do szablonu z nowo włączonych kompendiów (domyślnie ukryte, 0 szt.).
 */
export async function syncShopCatalog(adapter, actor) {
  const meta = shopMeta(actor);
  if (!adapter || !actor || !meta?.preset) return 0;
  const existingKeys = new Set(actor.items.map((i) => canonicalItemKey(i)));
  const candidates = await matchingCandidates(adapter, meta.preset);
  const missing = candidates.filter((c) => !existingKeys.has(c.canonicalKey));

  const toCreate = [];
  for (const candidate of missing) {
    const doc = await fromUuid(candidate.uuid);
    if (!doc) continue;
    const data = doc.toObject();
    delete data._id;
    applyAvailabilityToItemData(data, { available: false, quantity: 0, infinite: false }, adapter.quantityPath);
    toCreate.push(data);
  }
  if (toCreate.length) await actor.createEmbeddedDocuments("Item", toCreate);
  log.info(`synchronizacja katalogu ${actor.name}: dodano ${toCreate.length} nowych pozycji`);
  return toCreate.length;
}

/** Szybkie wystawienie ukrytego/niedostępnego przedmiotu na półkę przez MG. */
export async function revealShopItem(adapter, actor, item, quantity = 1) {
  if (!adapter || !actor || !item) return;
  await actor.updateEmbeddedDocuments("Item", [{
    _id: item.id,
    [adapter.quantityPath]: quantity,
    "flags.item-piles.item.hidden": false,
    "flags.item-piles.item.infiniteQuantity": "no"
  }]);
}

function bindSettlementLimit(dialog, adapter) {
  const form = dialog.element?.querySelector("form");
  const loc = form?.elements?.location;
  const limit = form?.elements?.limit;
  if (loc && limit) {
    loc.addEventListener("change", () => {
      limit.value = adapter.settlementLimit?.(loc.value) ?? settlementLimit(loc.value);
    });
  }
}

/** Okno tworzenia sklepu z szablonu. */
export async function openCreateShopDialog(adapter) {
  const esc = foundry.utils.escapeHTML;
  const presets = adapter.shopPresets ?? [];
  const locations = adapter.locations(game) ?? [];
  const defaultLoc = locations[0]?.key ?? "MARKET.Village";
  const defaultLimit = settlementLimit(defaultLoc);

  const result = await foundry.applications.api.DialogV2.prompt({
    window: { title: t("Shop.CreateTitle") },
    content: `
      <div class="form-group"><label>${esc(t("Shop.Preset"))}</label><select name="presetId">${presets.map((p) => `<option value="${esc(p.id)}">${esc(t(`Shop.Presets.${p.id}`))}</option>`).join("")}</select></div>
      <div class="form-group"><label>${esc(t("Shop.Name"))}</label><input type="text" name="name" placeholder="${esc(t("Shop.NamePlaceholder"))}"></div>
      <div class="form-group"><label>${esc(t(`Stock.Location.${adapter.id}`))}</label><select name="location">${locations.map((l) => `<option value="${esc(l.key)}">${esc(l.label)}</option>`).join("")}</select></div>
      <div class="form-group"><label>${esc(t("Stock.Modifier"))}</label><input type="number" name="modifier" value="0" step="10"></div>
      <div class="form-group"><label>${esc(t("Shop.Limit"))}</label><input type="number" name="limit" value="${defaultLimit}" min="1" max="500"></div>`,
    render: (_event, dialog) => bindSettlementLimit(dialog, adapter),
    ok: {
      label: t("Shop.CreateConfirm"),
      icon: "fa-solid fa-store",
      callback: (_event, button) => {
        const f = button.form.elements;
        return {
          presetId: f.presetId.value,
          name: f.name.value,
          location: f.location.value,
          modifier: Number(f.modifier.value) || 0,
          limit: Number(f.limit.value) || defaultLimit
        };
      }
    }
  }).catch(() => null);

  if (!result) return null;
  ui.notifications.info(t("Shop.Creating"));
  const created = await createPresetShop(adapter, result);
  if (created) ui.notifications.info(t("Shop.Created", { name: created.actor.name, available: created.availableCount, total: created.totalCount }));
  return created;
}

/** Okno przelosowania dostępności istniejącego sklepu dla wybranej osady. */
export async function openRerollDialog(adapter, actor) {
  const esc = foundry.utils.escapeHTML;
  const meta = shopMeta(actor);
  const locations = adapter.locations(game) ?? [];
  const currentLoc = meta?.location ?? locations[0]?.key ?? "MARKET.Village";
  const currentLimit = meta?.limit ?? settlementLimit(currentLoc);

  const result = await foundry.applications.api.DialogV2.prompt({
    window: { title: t("Shop.RerollTitle", { merchant: actor.name }) },
    content: `
      <p>${esc(t("Shop.RerollHint"))}</p>
      <div class="form-group"><label>${esc(t(`Stock.Location.${adapter.id}`))}</label><select name="location">${locations.map((l) => `<option value="${esc(l.key)}" ${l.key === currentLoc ? "selected" : ""}>${esc(l.label)}</option>`).join("")}</select></div>
      <div class="form-group"><label>${esc(t("Stock.Modifier"))}</label><input type="number" name="modifier" value="${Number(meta?.modifier) || 0}" step="10"></div>
      <div class="form-group"><label>${esc(t("Shop.Limit"))}</label><input type="number" name="limit" value="${currentLimit}" min="1" max="500"></div>
      <div class="form-group"><label>${esc(t("Shop.IncludeManual"))}</label><input type="checkbox" name="includeManual"></div>`,
    render: (_event, dialog) => bindSettlementLimit(dialog, adapter),
    ok: {
      label: t("Shop.RerollConfirm"),
      icon: "fa-solid fa-dice",
      callback: (_event, button) => {
        const f = button.form.elements;
        return {
          location: f.location.value,
          modifier: Number(f.modifier.value) || 0,
          limit: Number(f.limit.value) || currentLimit,
          includeManual: f.includeManual.checked
        };
      }
    }
  }).catch(() => null);

  if (!result) return null;
  const plan = await rerollShopAvailability(adapter, actor, result);
  if (plan) ui.notifications.info(t("Shop.Rerolled", { merchant: actor.name, available: plan.availableCount, hidden: plan.hiddenCount }));
  return plan;
}
