/**
 * Rejestr adapterów systemów Warhammera. Nowy system = nowy plik w tym katalogu i wpis poniżej.
 *
 * Adapter opisuje, czym dany system różni się w funkcjach wspólnych:
 *   partyTypes, companyTypes  typy aktorów drużyny
 *   settings                  dodatkowe ustawienia świata (opcjonalnie)
 *   xp                        { read(actor) → {total, available}|null, award(actor, amount, reason) }
 *   refresh                   zasób odnawiany na koniec sesji { key, perActor, targets, read, apply }
 *   tests                     { freeText, modifier, catalog, quick, difficulty, run, read }
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
