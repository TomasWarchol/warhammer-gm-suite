/**
 * Warhammer Age of Sigmar: Soulbound (system "age-of-sigmar-soulbound").
 * System nie śledzi pieniędzy na karcie, a koszt przedmiotu to tekst – działa łup i wymiana
 * przedmiotów bez waluty; jeśli koszt zaczyna się od liczby, Item Piles ją pokaże.
 */
import { rarityStyles } from "../integration.mjs";

export default {
  id: "age-of-sigmar-soulbound",
  actorType: "npc",
  quantityPath: "system.quantity",
  pricePath: "system.cost",
  unstackable: ["weapon", "armour", "aethericDevice"],
  vaultStyles: rarityStyles("system.availability", { rare: "130, 60, 200", exotic: "230, 150, 20", special: "200, 40, 40" }),
  indexFields: ["type", "system.availability", "system.cost"],

  cost: (system) => Number.parseFloat(String(system.cost ?? "").replace(",", ".")) || 0,

  async currencies() {
    return [];
  },

  rarityOf: (entry) => entry.system?.availability,
  hasPrice: () => true,
  locations: () => null,
  rowFor: () => null,
  rarities: (ctx) => Object.entries(ctx.aos?.config?.availability ?? {})
    .filter(([key]) => key)
    .map(([key, label]) => ({ key, label: ctx.i18n.localize(label) }))
};
