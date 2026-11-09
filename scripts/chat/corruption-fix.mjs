/**
 * Poprawka błędu systemu: `/corruption` zapisuje siłę małymi literami, a przycisk "Resist" porównuje ją
 * z etykietą pisaną wielką literą, więc odrzuca każdą wartość. Polskie tłumaczenie ma własną poprawkę.
 */
import { log } from "./constants.mjs";

const POLISH_PATCH = Symbol.for("wfrp4e-core-pl.corruptionMessageCompatibility");
const KEYS = { minor: "CORRUPTION.Minor", moderate: "CORRUPTION.Moderate", major: "CORRUPTION.Major" };

/** Siła ekspozycji w formie, którą rozumie system (mała litera, w języku gry), albo null. */
export function resolveStrength(value, localize) {
  const text = String(value ?? "").trim().toLocaleLowerCase();
  const key = Object.keys(KEYS).find((k) => k === text || localize(KEYS[k]).toLocaleLowerCase() === text);
  return key ? localize(KEYS[key]).toLocaleLowerCase() : null;
}

export function installCorruptionFix() {
  const Model = CONFIG.ChatMessage.dataModels?.corruption;
  if (!Model?._onResist || Model[POLISH_PATCH]) return;
  const original = Model._onResist;
  Model._onResist = async function (event, target) {
    const strength = resolveStrength(this.strength, (key) => game.i18n.localize(key));
    if (!strength) return original.call(this, event, target);
    const actors = warhammer.utility.targetedOrAssignedActors();
    if (!actors.length) return ui.notifications.error("ErrorCharAssigned", { localize: true });
    for (const actor of actors) actor.corruptionDialog(strength, this.skill);
  };
  log.info("poprawka /corruption aktywna");
}
