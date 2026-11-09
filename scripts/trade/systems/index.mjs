/**
 * Rejestr adapterów systemów Warhammera. Nowy system = nowy plik w tym katalogu i wpis poniżej.
 */
import wfrp4e from "./wfrp4e.mjs";
import whtow from "./whtow.mjs";
import impmal from "./impmal.mjs";
import wrathAndGlory from "./wrath-and-glory.mjs";
import soulbound from "./soulbound.mjs";

export const ADAPTERS = Object.fromEntries([wfrp4e, whtow, impmal, wrathAndGlory, soulbound].map((a) => [a.id, a]));

/** Adapter dla aktywnego systemu albo `null`, gdy system nie jest obsługiwany. */
export function adapterFor(systemId) {
  return ADAPTERS[systemId] ?? null;
}
