/**
 * Generator towaru dla kupca Item Piles – wspólny dla wszystkich systemów Warhammera.
 *
 * Systemy z tabelą dostępności (WFRP: wielkość osady, Imperium Maledictum: typ świata) rzucają
 * test dostępności i zapas z tabeli systemu. Pozostałe dobierają losowo przedmioty z wybranych
 * rzadkości (The Old World: poziomów statusu), po jednej sztuce.
 */
import { MODULE_ID, t, log } from "./constants.mjs";
import { fallbackRow, physicalTypes, pickStock, rollFormula } from "./availability.mjs";
import { canonicalItemKey, isSupersededCoreItem, packModuleId, sortAndFilterPacks } from "./sources.mjs";

function includeCampaignPacksSetting() {
  return game.settings.settings.has(`${MODULE_ID}.shopIncludeCampaignPacks`)
    ? Boolean(game.settings.get(MODULE_ID, "shopIncludeCampaignPacks"))
    : false;
}

/** Kandydaci z kompendiów przedmiotów w kolejności priorytetu zasad (Up in Arms > Archives > Core). */
export async function gatherCandidates(adapter, types, { includeCampaignPacks = includeCampaignPacksSetting() } = {}) {
  const candidates = [];
  const seen = new Set();
  const activeModules = new Set([...game.modules.values()].filter((m) => m.active).map((m) => m.id));
  const packs = sortAndFilterPacks(game.packs, { includeCampaignPacks });

  for (const pack of packs) {
    const modId = packModuleId(pack);
    const index = await pack.getIndex({ fields: adapter.indexFields });
    for (const entry of index) {
      if (!types.includes(entry.type) || !adapter.hasPrice(entry)) continue;
      if (isSupersededCoreItem(entry, modId, activeModules)) continue;
      const key = canonicalItemKey(entry);
      if (seen.has(key)) continue;
      seen.add(key);
      candidates.push({
        uuid: entry.uuid,
        name: entry.name,
        type: entry.type,
        rarity: adapter.rarityOf(entry),
        trappingType: entry.system?.trappingType?.value,
        weaponGroup: entry.system?.weaponGroup?.value,
        armorType: entry.system?.armorType?.value,
        ammunitionType: entry.system?.ammunitionType?.value,
        canonicalKey: key
      });
    }
  }
  return candidates;
}

export const rollStockDice = (formula) => rollFormula(formula, () => CONFIG.Dice.randomUniform());

/**
 * Uzupełnia towar kupca.
 * @param {object} adapter  adapter aktywnego systemu
 * @param {Actor} merchant
 * @param {{location?: string, rarities?: string[], types: string[], limit: number, modifier: number, replace: boolean}} options
 * @returns {Promise<number>} liczba dodanych pozycji
 */
export async function stockMerchant(adapter, merchant, { location, rarities = [], types, limit = 10, modifier = 0, replace = false }) {
  const api = game.itempiles?.API;
  if (!api) return 0;
  const candidates = await gatherCandidates(adapter, types);
  const hasTable = Boolean(adapter.locations(game)?.length);
  const rowFor = hasTable
    ? (c) => adapter.rowFor(game, location, c.rarity)
    : (c) => fallbackRow(c.rarity, rarities);
  const picked = pickStock(candidates, { rowFor, limit, modifier: hasTable ? modifier : 0, rollDice: rollStockDice });

  if (replace) {
    const current = api.getActorItems(merchant).filter((i) => types.includes(i.type));
    if (current.length) await api.removeItems(merchant, current.map((item) => ({ item, quantity: api.getItemQuantity(item) })));
  }

  const items = [];
  for (const entry of picked) {
    const doc = await fromUuid(entry.uuid);
    if (!doc) continue;
    const data = doc.toObject();
    delete data._id;
    if (entry.infinite) foundry.utils.setProperty(data, "flags.item-piles.item.infiniteQuantity", "yes");
    items.push({ item: data, quantity: entry.quantity });
  }
  if (items.length) await api.addItems(merchant, items);
  log.info(`kupiec ${merchant.name}: dodano ${items.length} pozycji`);
  return items.length;
}

/** Okno MG: parametry generatora, potem uzupełnienie towaru. */
export async function openStockDialog(adapter, merchant) {
  const esc = foundry.utils.escapeHTML;
  const locations = adapter.locations(game) ?? [];
  const rarities = adapter.rarities(game) ?? [];
  const typeLabels = CONFIG.Item.typeLabels ?? {};
  const types = physicalTypes(CONFIG.Item.dataModels).filter((type) => !["money", "cargo"].includes(type));
  const check = (name, value, label) => `<label class="checkbox"><input type="checkbox" name="${name}" value="${esc(value)}" checked> ${esc(label)}</label>`;
  const initialLimit = adapter.settlementLimit?.(locations[0]?.key) ?? 10;

  const locationField = locations.length
    ? `<div class="form-group"><label>${esc(t(`Stock.Location.${adapter.id}`))}</label><select name="location">${locations.map((l) => `<option value="${esc(l.key)}">${esc(l.label)}</option>`).join("")}</select></div>
       <div class="form-group"><label>${esc(t("Stock.Modifier"))}</label><input type="number" name="modifier" value="0" step="10"></div>`
    : rarities.length
      ? `<div class="form-group stacked"><label>${esc(t(`Stock.Rarities.${adapter.id}`))}</label><div class="form-fields warhammer-gm-suite-checks">${rarities.map((r) => check("rarities", r.key, r.label)).join("")}</div></div>`
      : "";

  const result = await foundry.applications.api.DialogV2.prompt({
    window: { title: t("Stock.Title", { merchant: merchant.name }) },
    content: `
      <p>${esc(locations.length ? t("Stock.IntroTable") : t("Stock.IntroRandom"))}</p>
      ${locationField}
      <div class="form-group stacked"><label>${esc(t("Stock.Types"))}</label><div class="form-fields warhammer-gm-suite-checks">${types.map((type) => check("types", type, game.i18n.localize(typeLabels[type] ?? type))).join("")}</div></div>
      <div class="form-group"><label>${esc(t("Stock.Limit"))}</label><input type="number" name="limit" value="${initialLimit}" min="1" max="500"></div>
      <div class="form-group"><label>${esc(t("Stock.Replace"))}</label><input type="checkbox" name="replace"></div>`,
    render: (_event, dialog) => {
      const form = dialog.element?.querySelector("form");
      const locSelect = form?.elements?.location;
      const limitInput = form?.elements?.limit;
      if (locSelect && limitInput && adapter.settlementLimit) {
        locSelect.addEventListener("change", () => {
          limitInput.value = adapter.settlementLimit(locSelect.value);
        });
      }
    },
    ok: {
      label: t("Stock.Confirm"),
      icon: "fa-solid fa-cart-plus",
      callback: (_event, button) => {
        const form = button.form;
        const checked = (name) => [...form.querySelectorAll(`input[name=${name}]:checked`)].map((i) => i.value);
        return {
          location: form.elements.location?.value,
          modifier: Number(form.elements.modifier?.value) || 0,
          rarities: checked("rarities"),
          types: checked("types"),
          limit: Number(form.elements.limit.value) || initialLimit,
          replace: form.elements.replace.checked
        };
      }
    }
  }).catch(() => null);

  if (!result) return;
  if (!result.types.length) return ui.notifications.warn(t("Stock.NoTypes"));
  ui.notifications.info(t("Stock.Working"));
  const count = await stockMerchant(adapter, merchant, result);
  ui.notifications.info(t("Stock.Done", { count, merchant: merchant.name }));
}
