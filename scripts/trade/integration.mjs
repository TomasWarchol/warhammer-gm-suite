/**
 * Konfiguracja integracji systemu dla Item Piles (game.itempiles.API.addSystemIntegration).
 * Czysta funkcja – dane wejściowe (adapter systemu, waluty, typy) przekazuje scripts/main.mjs.
 */

/**
 * Wersja konfiguracji. Item Piles nadpisuje ustawienia użytkownika tylko wtedy, gdy ta wersja
 * jest nowsza od zapisanej – podbijaj ją przy każdej zmianie domyślnej konfiguracji.
 */
export const INTEGRATION_VERSION = "1.0.2";

/**
 * @param {object} params
 * @param {object} params.adapter  adapter systemu (scripts/systems/*.mjs)
 * @param {Array} params.currencies  waluty w formacie Item Piles
 * @param {string[]} params.itemTypes  wszystkie typy przedmiotów w świecie (z modułami)
 * @param {string[]} params.physical  typy przedmiotów fizycznych (handel, łupy)
 */
export function buildIntegration({ adapter, currencies, itemTypes, physical }) {
  const excluded = itemTypes.filter((type) => !physical.includes(type));
  return {
    VERSION: INTEGRATION_VERSION,
    ACTOR_CLASS_TYPE: adapter.actorType,
    ITEM_PRICE_ATTRIBUTE: adapter.pricePath,
    ITEM_QUANTITY_ATTRIBUTE: adapter.quantityPath,
    ITEM_FILTERS: excluded.length ? [{ path: "type", filters: excluded.join(",") }] : [],
    ITEM_SIMILARITIES: ["name", "type"],
    UNSTACKABLE_ITEM_TYPES: (adapter.unstackable ?? []).filter((type) => physical.includes(type)),
    // Cena w walucie głównej systemu, liczona przez adapter (WFRP: {zk,s,p}, The Old World: poziom statusu…)
    ITEM_COST_TRANSFORMER: (item) => adapter.cost(item?.system ?? {}),
    ITEM_PREVIEW_PERMISSION_LEVEL: 2,
    VAULT_STYLES: adapter.vaultStyles ?? [],
    CURRENCIES: currencies,
    SECONDARY_CURRENCIES: [],
    PILE_DEFAULTS: {},
    TOKEN_FLAG_DEFAULTS: {}
  };
}

/** Poświata w skarbcu dla rzadkości (ścieżka i wartości zależne od systemu). */
export function rarityStyles(path, colours) {
  return Object.entries(colours).map(([value, rgb]) => ({
    path,
    value,
    styling: { "box-shadow": `inset 0px 0px 7px 0px rgba(${rgb}, 1)` }
  }));
}
