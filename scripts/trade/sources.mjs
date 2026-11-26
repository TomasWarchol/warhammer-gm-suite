/**
 * Priorytety źródeł i rozwiązywanie konfliktów między kompendiami WFRP4e
 * (Core vs Up in Arms vs Archives 3 vs kampanie) – czysta logika.
 */

export const PACK_PRIORITY = {
  "wfrp4e-up-in-arms": 100,
  "wfrp4e-archives3": 90,
  "wfrp4e-archives2": 85,
  "wfrp4e-archives1": 80,
  "wfrp4e-wom": 75,
  "wfrp4e-dwarfs": 70,
  "wfrp4e-altdorf": 60,
  "wfrp4e-middenheim": 60,
  "wfrp4e-salzenmund": 60,
  "wfrp4e-soc": 60,
  "wfrp4e-lustria": 60,
  "wfrp4e-zoo": 60,
  "wfrp4e-core": 50
};

export const CAMPAIGN_PACKS = new Set([
  "wfrp4e-eis",
  "wfrp4e-dotr",
  "wfrp4e-pbtt",
  "wfrp4e-horned-rat",
  "wfrp4e-empire-ruins",
  "wfrp4e-rnhd",
  "wfrp4e-starter-set",
  "wfrp4e-ua1",
  "wfrp4e-ua2",
  "wfrp4e-owb1",
  "wfrp4e-owb3",
  "wfrp4e-mutations",
  "wfrp4e-warriors-of-salvation"
]);

/** Zwraca identyfikator modułu (lub świata), z którego pochodzi kompendium. */
export function packModuleId(pack) {
  return pack?.metadata?.packageName ?? pack?.collection?.split(".")?.[0] ?? "";
}

/** Wybiera kompendia przedmiotów i sortuje je malejąco według priorytetu zasad. */
export function sortAndFilterPacks(packs, { includeCampaignPacks = false } = {}) {
  return [...(packs ?? [])]
    .filter((p) => p?.documentName === "Item")
    .filter((p) => includeCampaignPacks || !CAMPAIGN_PACKS.has(packModuleId(p)))
    .sort((a, b) => (PACK_PRIORITY[packModuleId(b)] ?? 40) - (PACK_PRIORITY[packModuleId(a)] ?? 40));
}

/** Rozstrzyga aktywny typ pancerza (Core vs Archives 3). */
export function resolveArmourType(mode, dataModels, activeModules) {
  const hasArchives3 = Boolean(dataModels?.["wfrp4e-archives3.armour"] || activeModules?.has?.("wfrp4e-archives3"));
  if (mode === "core") return "armour";
  if (mode === "archives3") return hasArchives3 ? "wfrp4e-archives3.armour" : "armour";
  return hasArchives3 ? "wfrp4e-archives3.armour" : "armour";
}

/** Znormalizowany klucz deduplikacji (uwzględnia oryginalną nazwę Babele oraz zamianę Archives 3 armour → armour). */
export function canonicalItemKey(entry) {
  const canonicalType = entry?.type === "wfrp4e-archives3.armour" ? "armour" : entry?.type;
  const originalName = entry?.flags?.babele?.originalName ?? entry?.name ?? "";
  return `${canonicalType}|${String(originalName).trim().toLowerCase()}`;
}

/** Czy wpis z Core został zastąpiony przez nowsze warianty z Up in Arms (np. Hand Weapon). */
export function isSupersededCoreItem(entry, packModId, activeModules) {
  if (packModId !== "wfrp4e-core" || !activeModules?.has?.("wfrp4e-up-in-arms")) return false;
  const originalName = entry?.flags?.babele?.originalName ?? entry?.name ?? "";
  return String(originalName).trim().toLowerCase() === "hand weapon";
}
