/**
 * WFRP 4e/5e (system "wfrp4e"): monety jako przedmioty, ceny {gc, ss, bp},
 * dostępność z tabeli systemu według wielkości osady.
 */
import { buildCurrencies, detectMoneyNames, priceInBP } from "../money.mjs";
import { rarityStyles } from "../integration.mjs";

/** Rzadkość przedmiotu → wiersz tabeli dostępności systemu. */
const RARITY_ROWS = {
  common: "WFRP4E.Availability.Common",
  scarce: "WFRP4E.Availability.Scarce",
  rare: "WFRP4E.Availability.Rare",
  exotic: "WFRP4E.Availability.Exotic"
};

const DEFAULT_COIN_IMAGES = {
  gc: "modules/wfrp4e-core/icons/currency/goldcrown.png",
  ss: "modules/wfrp4e-core/icons/currency/silvershilling.png",
  bp: "modules/wfrp4e-core/icons/currency/brasspenny.png"
};

/** Nominał monety z nazwy pliku obrazka systemu (gdy indeks kompendium nie ma wartości). */
const COIN_IMAGE_VALUES = { goldcrown: 240, silvershilling: 12, brasspenny: 1 };

function coinValueOf(entry) {
  const value = entry.system?.coinValue?.value;
  if (value !== undefined) return value;
  const file = String(entry.img ?? "").split("/").pop().replace(/\.\w+$/, "").toLowerCase();
  return COIN_IMAGE_VALUES[file];
}

/**
 * Monety w świecie: na kartach aktorów (waga 3), w katalogu (2), w kompendiach (1).
 * Synchronicznie, na danych już załadowanych (podstawowy indeks kompendiów) – Item Piles sprawdza
 * konfigurację systemu 500 ms po "item-piles-ready", więc integracja musi zgłosić się od razu.
 */
function moneyCandidates(ctx) {
  const candidates = [];
  const add = (entry, weight) => candidates.push({ name: entry.name, img: entry.img, coinValue: coinValueOf(entry), weight });
  for (const actor of ctx.actors ?? []) for (const item of actor.itemTypes?.money ?? []) add(item, 3);
  for (const item of [...(ctx.items ?? [])].filter((i) => i.type === "money")) add(item, 2);
  for (const pack of [...(ctx.packs ?? [])].filter((p) => p.documentName === "Item")) {
    for (const entry of pack.index ?? []) if (entry.type === "money") add(entry, 1);
  }
  return candidates;
}

export default {
  id: "wfrp4e",
  actorType: "npc",
  quantityPath: "system.quantity.value",
  pricePath: "system.price.gc",
  unstackable: ["weapon", "armour", "container"],
  vaultStyles: rarityStyles("system.availability.value", { scarce: "42, 120, 180", rare: "130, 60, 200", exotic: "230, 150, 20" }),
  indexFields: ["type", "system.availability.value", "system.price"],

  // Koszt w pensach (waluta główna) – liczby całkowite, bez błędów zaokrągleń
  cost: (system) => priceInBP(system.price),

  async currencies(ctx, t) {
    const names = detectMoneyNames(moneyCandidates(ctx), ctx.wfrp4e?.config?.moneyNames ?? {});
    return buildCurrencies(names, { gc: t("Currency.wfrp4e.gc"), ss: t("Currency.wfrp4e.ss"), bp: t("Currency.wfrp4e.bp") }, DEFAULT_COIN_IMAGES);
  },

  rarityOf: (entry) => entry.system?.availability?.value,
  hasPrice: (entry) => Boolean(entry.system?.price),

  /** Miejsca z tabeli dostępności: wielkości osad. */
  locations: (ctx) => Object.keys(ctx.wfrp4e?.config?.availabilityTable ?? {}).map((key) => ({ key, label: ctx.i18n.localize(key) })),

  rowFor(ctx, location, rarity) {
    const row = RARITY_ROWS[rarity];
    return row ? ctx.wfrp4e?.config?.availabilityTable?.[location]?.[row] ?? null : null;
  },

  rarities: () => []
};
