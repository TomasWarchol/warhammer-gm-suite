/**
 * Odczyt komend czatu zarejestrowanych przez system (warhammer-lib → ChatCommands).
 *
 * System trzyma je w `game.wfrp4e.commands.commands` jako:
 *   { [nazwa]: { args, defaultArg, description, notes, examples, callback } }
 * Czytamy je dynamicznie – nowe komendy systemu (albo dodane przez inne moduły przez
 * `game.wfrp4e.commands.add`) dostają podpowiedzi bez zmian w tym module.
 */

/** Ikony Font Awesome dla znanych komend; nieznane dostają ikonę domyślną. */
export const COMMAND_ICONS = {
  help: "fa-circle-question",
  table: "fa-table-list",
  cond: "fa-heart-crack",
  prop: "fa-tags",
  char: "fa-user-plus",
  name: "fa-signature",
  avail: "fa-store",
  pay: "fa-coins",
  credit: "fa-hand-holding-dollar",
  corruption: "fa-skull",
  fear: "fa-ghost",
  terror: "fa-skull-crossbones",
  exp: "fa-star",
  travel: "fa-route",
  trade: "fa-scale-balanced"
};

export const DEFAULT_ICON = "fa-terminal";

/** Zwraca rejestr komend aktywnego systemu Warhammer albo `null`. */
export function getCommandRegistry(gameRef = globalThis.game) {
  const registry = gameRef?.[gameRef?.system?.id]?.commands ?? gameRef?.wfrp4e?.commands;
  return registry?.commands ? registry : null;
}

/** Dopisek aliasu w opisie, np. "Rzut na tabelę (alias /table)" albo "Alias for /corruption". */
const ALIAS_DESCRIPTION = /\balias(?:\s+for)?\s+\/([^\s)]+)/i;

/**
 * Normalizuje definicje komend z rejestru do prostych obiektów i grupuje aliasy.
 *
 * Moduły (np. polskie tłumaczenie systemu) dodają aliasy jako osobne komendy. Za alias
 * uznajemy komendę, która ma tę samą funkcję wywołania co komenda zarejestrowana wcześniej,
 * albo w opisie wskazuje oryginał ("(alias /table)", "Alias for /corruption").
 * Alias trafia do `aliases` oryginału i dzieli z nim podpowiedzi.
 *
 * @returns {Array<{key: string, prefix: string, aliases: string[], args: string[],
 *   defaultArg: string|null, description: string, notes: string, examples: string}>}
 */
export function listCommands(registry) {
  if (!registry?.commands) return [];
  const prefix = registry.prefix ?? "/";
  const entries = Object.entries(registry.commands).filter(([key, def]) => key && typeof def?.callback === "function");

  const primaryByCallback = new Map();
  const primaryOf = new Map();
  for (const [key, def] of entries) {
    const target = def.description?.match(ALIAS_DESCRIPTION)?.[1]?.toLowerCase();
    const byDescription = target && target !== key && registry.commands[target] ? target : null;
    const primary = byDescription ?? primaryByCallback.get(def.callback) ?? null;
    if (primary) {
      primaryOf.set(key, primaryOf.get(primary) ?? primary);
    } else {
      primaryByCallback.set(def.callback, key);
    }
  }

  const result = new Map();
  for (const [key, def] of entries) {
    if (primaryOf.has(key)) continue;
    result.set(key, {
      key,
      prefix,
      aliases: [],
      args: Array.isArray(def.args) ? [...def.args] : [],
      defaultArg: def.defaultArg ?? null,
      description: def.description ?? "",
      notes: def.notes ?? "",
      examples: def.examples ?? ""
    });
  }
  for (const [alias, primary] of primaryOf) result.get(primary)?.aliases.push(alias);
  return [...result.values()];
}
