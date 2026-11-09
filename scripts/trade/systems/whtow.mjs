/**
 * Warhammer: The Old World (system "whtow"): monety na karcie (system.coins.gold/silver/brass).
 * Koszt przedmiotu to poziom statusu (brass/silver/gold), a nie kwota – przeliczamy go na jedną
 * monetę danego poziomu. MG może nadpisać ceny w ustawieniach kupca Item Piles.
 */

/**
 * Wartość monet w mosiądzu (waluta główna, kurs 1): 1 złota = 20 srebrnych = 240 mosiężnych.
 * Kwoty całkowite – Item Piles zaokrągla koszt w walucie głównej do 5 miejsc.
 */
export const TOW_RATES = { gold: 240, silver: 12, brass: 1 };

export default {
  id: "whtow",
  actorType: "npc",
  quantityPath: "system.quantity",
  pricePath: "system.cost",
  unstackable: ["weapon", "armour"],
  vaultStyles: [],
  indexFields: ["type", "system.cost"],

  cost: (system) => TOW_RATES[system.cost] ?? 0,

  async currencies(_ctx, t) {
    return Object.entries(TOW_RATES).map(([key, rate]) => ({
      type: "attribute",
      name: t(`Currency.whtow.${key}Name`),
      img: {
        gold: "icons/commodities/currency/coin-embossed-crown-gold.webp",
        silver: "icons/commodities/currency/coin-engraved-moon-silver.webp",
        brass: "icons/commodities/currency/coin-embossed-sword-copper.webp"
      }[key],
      abbreviation: t(`Currency.whtow.${key}`),
      data: { path: `system.coins.${key}` },
      primary: key === "brass",
      exchangeRate: rate
    }));
  },

  // Brak rzadkości – generator dobiera towar według poziomu statusu kosztu
  rarityOf: (entry) => entry.system?.cost,
  hasPrice: (entry) => Boolean(entry.system?.cost),
  locations: () => null,
  rowFor: () => null,
  rarities: (ctx) => Object.entries(ctx.oldworld?.config?.status ?? {}).map(([key, label]) => ({ key, label: ctx.i18n.localize(label) }))
};
