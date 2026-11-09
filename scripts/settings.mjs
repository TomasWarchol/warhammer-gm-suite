/**
 * Ustawienia świata. Każda funkcja panelu ma własny przełącznik; adapter może dołożyć ustawienia swojego systemu.
 */
import { MODULE_ID, I18N } from "./constants.mjs";

/** Tryby rzutu w nazwach, których używają okna rzutu systemów Warhammera (warhammer-lib). */
export const rollModes = () => Object.fromEntries(["publicroll", "gmroll", "blindroll", "selfroll"].map((id) => [id, `${I18N}.RollMode.${id}`]));

export function registerSettings(adapter) {
  const onChange = () => Hooks.callAll(`${MODULE_ID}.settingsChanged`);
  const visible = {
    enableSession: { type: Boolean, default: true },
    enableGroup: { type: Boolean, default: true },
    enableCombat: { type: Boolean, default: true },
    enableTokens: { type: Boolean, default: true },
    enableMerchants: { type: Boolean, default: true, requiresReload: true },
    enableChatHints: { type: Boolean, default: true, requiresReload: true },
    ...(adapter?.whispers ? { enableWhispers: { type: Boolean, default: true }, whisperRemoveCorruption: { type: Boolean, default: true } } : {}),
    defaultMode: { type: String, default: "party", choices: { party: `${I18N}.Party.party`, company: `${I18N}.Party.company` } },
    defaultRollMode: { type: String, default: "gmroll", choices: rollModes() },
    ...adapter?.settings
  };
  for (const [key, data] of Object.entries(visible)) {
    const name = key.charAt(0).toUpperCase() + key.slice(1);
    game.settings.register(MODULE_ID, key, { name: `${I18N}.Settings.${name}Name`, hint: `${I18N}.Settings.${name}Hint`, scope: "world", config: true, onChange, ...data });
  }
  // Wartości edytowane bezpośrednio w panelu
  for (const [key, value] of Object.entries({ sessionId: "1", holdingScene: "", defaultReason: "" })) {
    game.settings.register(MODULE_ID, key, { scope: "world", config: false, type: String, default: value });
  }
}

export const getSetting = (key) => game.settings.get(MODULE_ID, key);
export const setSetting = (key, value) => game.settings.set(MODULE_ID, key, value);

/** Ustawienia dodane przez adapter aktywnego systemu. */
export function adapterSettings(adapter) {
  return Object.fromEntries(Object.keys(adapter?.settings ?? {}).map((key) => [key, getSetting(key)]));
}
