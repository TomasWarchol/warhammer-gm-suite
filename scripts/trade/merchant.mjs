/**
 * Generator towaru dla kupca Item Piles – wspólny dla wszystkich systemów Warhammera.
 *
 * Systemy z tabelą dostępności (WFRP: wielkość osady, Imperium Maledictum: typ świata) rzucają
 * test dostępności i zapas z tabeli systemu. Pozostałe dobierają losowo przedmioty z wybranych
 * rzadkości (The Old World: poziomów statusu), po jednej sztuce.
 */
import { t, log } from "./constants.mjs";
import { fallbackRow, physicalTypes, pickStock, rollFormula } from "./availability.mjs";

/** Kandydaci z kompendiów przedmiotów (indeks z polami potrzebnymi adapterowi). */
async function gatherCandidates(adapter, types) {
  const candidates = [];
  const seen = new Set();
  for (const pack of game.packs.filter((p) => p.documentName === "Item")) {
    const index = await pack.getIndex({ fields: adapter.indexFields });
    for (const entry of index) {
      if (!types.includes(entry.type) || !adapter.hasPrice(entry)) continue;
      // Ten sam przedmiot w kilku kompendiach (np. wersja angielska i polska) – bierzemy pierwszy
      const key = `${entry.type}|${entry.name}`;
      if (seen.has(key)) continue;
      seen.add(key);
      candidates.push({ uuid: entry.uuid, name: entry.name, type: entry.type, rarity: adapter.rarityOf(entry) });
    }
  }
  return candidates;
}

const rollDice = (formula) => rollFormula(formula, () => CONFIG.Dice.randomUniform());

/**
 * Uzupełnia towar kupca.
 * @param {object} adapter  adapter aktywnego systemu
 * @param {Actor} merchant
 * @param {{location?: string, rarities?: string[], types: string[], limit: number, modifier: number, replace: boolean}} options
 * @returns {Promise<number>} liczba dodanych pozycji
 */
export async function stockMerchant(adapter, merchant, { location, rarities = [], types, limit = 30, modifier = 0, replace = false }) {
  const api = game.itempiles?.API;
  if (!api) return 0;
  const candidates = await gatherCandidates(adapter, types);
  const hasTable = Boolean(adapter.locations(game)?.length);
  const rowFor = hasTable
    ? (c) => adapter.rowFor(game, location, c.rarity)
    : (c) => fallbackRow(c.rarity, rarities);
  const picked = pickStock(candidates, { rowFor, limit, modifier: hasTable ? modifier : 0, rollDice });

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
    if (entry.infinite) foundry.utils.setProperty(data, "flags.item-piles.item.infiniteQuantity", true);
    items.push({ item: data, quantity: entry.quantity });
  }
  if (items.length) await api.addItems(merchant, items);
  log.info(`kupiec ${merchant.name}: dodano ${items.length} pozycji`);
  return items.length;
}

/** Okno MG: parametry generatora, potem uzupełnienie towaru. */
export async function openStockDialog(adapter, merchant) {
  const locations = adapter.locations(game) ?? [];
  const rarities = adapter.rarities(game) ?? [];
  const typeLabels = CONFIG.Item.typeLabels ?? {};
  const types = physicalTypes(CONFIG.Item.dataModels).filter((type) => !["money", "cargo"].includes(type));
  const check = (name, value, label) => `<label class="checkbox"><input type="checkbox" name="${name}" value="${value}" checked> ${label}</label>`;

  const locationField = locations.length
    ? `<div class="form-group"><label>${t(`Stock.Location.${adapter.id}`)}</label><select name="location">${locations.map((l) => `<option value="${l.key}">${l.label}</option>`).join("")}</select></div>
       <div class="form-group"><label>${t("Stock.Modifier")}</label><input type="number" name="modifier" value="0" step="10"></div>`
    : rarities.length
      ? `<div class="form-group stacked"><label>${t(`Stock.Rarities.${adapter.id}`)}</label><div class="form-fields item-piles-warhammer-trade-checks">${rarities.map((r) => check("rarities", r.key, r.label)).join("")}</div></div>`
      : "";

  const result = await foundry.applications.api.DialogV2.prompt({
    window: { title: t("Stock.Title", { merchant: merchant.name }) },
    content: `
      <p>${locations.length ? t("Stock.IntroTable") : t("Stock.IntroRandom")}</p>
      ${locationField}
      <div class="form-group stacked"><label>${t("Stock.Types")}</label><div class="form-fields item-piles-warhammer-trade-checks">${types.map((type) => check("types", type, game.i18n.localize(typeLabels[type] ?? type))).join("")}</div></div>
      <div class="form-group"><label>${t("Stock.Limit")}</label><input type="number" name="limit" value="30" min="1" max="500"></div>
      <div class="form-group"><label>${t("Stock.Replace")}</label><input type="checkbox" name="replace"></div>`,
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
          limit: Number(form.elements.limit.value) || 30,
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
