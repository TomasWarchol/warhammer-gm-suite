/** Identyfikator modułu – musi być zgodny z "id" w module.json. */
export const MODULE_ID = "warhammer-gm-suite";

/** Przestrzeń kluczy tłumaczeń modułu (lang/*.json). */
export const I18N = "WHGM";

/** Tworzy funkcję tłumaczącą dla wskazanej przestrzeni kluczy. */
export const translator = (scope) => (key, data) => {
  const full = `${scope}.${key}`;
  return data ? game.i18n.format(full, data) : game.i18n.localize(full);
};

/** Tłumaczy klucz z przestrzeni modułu (z podstawieniami, gdy podano dane). */
export const t = translator(I18N);

/** Logger z prefiksem modułu; `debug` pisze tylko przy włączonym CONFIG.debug.modules. */
export const log = {
  info: (...args) => console.log(`${MODULE_ID} |`, ...args),
  warn: (...args) => console.warn(`${MODULE_ID} |`, ...args),
  error: (...args) => console.error(`${MODULE_ID} |`, ...args),
  debug: (...args) => {
    if (globalThis.CONFIG?.debug?.modules) console.debug(`${MODULE_ID} |`, ...args);
  }
};
