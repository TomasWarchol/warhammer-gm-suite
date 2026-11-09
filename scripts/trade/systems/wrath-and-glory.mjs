/**
 * Wrath & Glory (system "wrath-and-glory"): Bogactwo na karcie (system.resources.wealth),
 * wartość przedmiotu (system.value), rzadkość (system.rarity) bez tabeli dostępności.
 */
import { rarityStyles } from "../integration.mjs";

export default {
  id: "wrath-and-glory",
  actorType: "threat",
  quantityPath: "system.quantity",
  pricePath: "system.value",
  unstackable: ["weapon", "armour", "augmetic"],
  vaultStyles: rarityStyles("system.rarity", { uncommon: "42, 120, 180", rare: "130, 60, 200", "very-rare": "230, 150, 20", unique: "200, 40, 40" }),
  indexFields: ["type", "system.rarity", "system.value"],

  cost: (system) => Number(system.value) || 0,

  async currencies(_ctx, t) {
    return [{
      type: "attribute",
      name: t("Currency.wrath-and-glory.wealthName"),
      img: "icons/commodities/currency/coins-assorted-mix-copper-silver-gold.webp",
      abbreviation: t("Currency.wrath-and-glory.wealth"),
      data: { path: "system.resources.wealth" },
      primary: true,
      exchangeRate: 1
    }];
  },

  rarityOf: (entry) => entry.system?.rarity,
  hasPrice: () => true,
  locations: () => null,
  rowFor: () => null,
  rarities: (ctx) => Object.entries(ctx.wng?.config?.rarity ?? {}).map(([key, label]) => ({ key, label: ctx.i18n.localize(label) }))
};
