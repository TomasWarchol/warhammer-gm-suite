/**
 * Imperium Maledictum (system "impmal"): Solary na karcie (system.solars), koszt w Solarach
 * (system.cost), dostępność z tabeli systemu według typu świata (feral … forge).
 */
import { rarityStyles } from "../integration.mjs";

export default {
  id: "impmal",
  actorType: "npc",
  quantityPath: "system.quantity",
  pricePath: "system.cost",
  unstackable: ["weapon", "protection", "forceField", "augmetic"],
  vaultStyles: rarityStyles("system.availability", { scarce: "42, 120, 180", rare: "130, 60, 200", exotic: "230, 150, 20" }),
  indexFields: ["type", "system.availability", "system.cost"],

  cost: (system) => Number(system.cost) || 0,

  async currencies(_ctx, t) {
    return [{
      type: "attribute",
      name: t("Currency.impmal.solarsName"),
      img: "icons/commodities/currency/coin-inset-compass-silver.webp",
      abbreviation: t("Currency.impmal.solars"),
      data: { path: "system.solars" },
      primary: true,
      exchangeRate: 1
    }];
  },

  rarityOf: (entry) => entry.system?.availability,
  hasPrice: (entry) => entry.system?.cost !== undefined,

  /** Miejsca: typy światów z konfiguracji systemu. */
  locations: (ctx) => Object.entries(ctx.impmal?.config?.worlds ?? {}).map(([key, label]) => ({ key, label: ctx.i18n.localize(label) })),

  // Tabela systemu podaje tylko szansę (%) – zapas jednej sztuki
  rowFor(ctx, location, rarity) {
    const test = ctx.impmal?.config?.worldAvailability?.[location]?.[rarity];
    return test === undefined ? null : { test, stock: "1" };
  },

  rarities: () => []
};
