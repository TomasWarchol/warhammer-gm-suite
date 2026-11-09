/**
 * Adapter danych systemu WFRP4e dla podpowiedzi (scripts/providers.mjs).
 *
 * Czyta konfigurację na żywo (`game.wfrp4e.config`), więc po przełączeniu zasad
 * w Edition Manager (4e/5e) podpowiedzi same odpowiadają aktywnej edycji.
 * Każda metoda jest odporna na brak danych – zwraca pustą listę zamiast rzucać.
 */
import { t } from "./constants.mjs";

/** Wartości siły Zepsucia, które akceptuje /corruption (po lokalizacji, małymi literami). */
const CORRUPTION_STRENGTHS = ["CORRUPTION.Minor", "CORRUPTION.Moderate", "CORRUPTION.Major"];

/** Umiejętności testu Zepsucia. */
const CORRUPTION_SKILLS = ["NAME.Endurance", "NAME.Cool"];

/** Usuwa końcowy dopisek w nawiasie, np. "Mutacje (Khorne)" → "Mutacje". */
function baseTableName(name) {
  return String(name ?? "").replace(/\s*\([^)]*\)\s*$/, "") || name;
}

export function createWfrpData(gameRef = globalThis.game) {
  const system = () => gameRef?.[gameRef?.system?.id] ?? gameRef?.wfrp4e;
  const config = () => system()?.config ?? {};
  const localize = (key) => (typeof key === "string" ? gameRef.i18n.localize(key) : String(key ?? ""));

  /** Zamienia obiekt { klucz: etykieta/klucz-i18n } na listę podpowiedzi. */
  const fromRecord = (record) =>
    Object.entries(record ?? {})
      .filter(([key]) => key && key !== "None")
      .map(([value, label]) => ({ value, label: localize(label) }));

  /**
   * Jak `fromRecord`, ale wartością jest zlokalizowana nazwa – /cond i /prop dopasowują
   * wpis po nazwie (WFRP_Utility.matchClosest), nie po kluczu. Klucz trafia do opisu.
   */
  const fromRecordByLabel = (record) =>
    fromRecord(record).map(({ value, label }) => ({ value: label, label, hint: value }));

  /** Zlokalizowane nazwy w formie, którą porównuje system (małe litery). */
  const localizedLower = (keys) =>
    keys.map((key) => {
      const label = localize(key);
      return { value: label.toLowerCase(), label };
    });

  return {
    /** Tłumaczenie z przestrzeni tego modułu. */
    label: (key) => t(key),

    /** Tabele z kluczem systemu (flaga wfrp4e.key) oraz tabele lokacji trafień. */
    tables() {
      const byKey = new Map();
      for (const table of gameRef.tables ?? []) {
        const key = table.getFlag?.("wfrp4e", "key");
        if (!key) continue;
        const column = table.getFlag("wfrp4e", "column");
        const entry = byKey.get(key) ?? { value: key, label: table.name, columns: [] };
        if (column && !entry.columns.includes(column)) {
          entry.columns.push(column);
          entry.label = baseTableName(table.name);
        }
        byKey.set(key, entry);
      }
      for (const [key, label] of Object.entries(config().hitLocationTables ?? {})) {
        if (!byKey.has(key)) byKey.set(key, { value: key, label: localize(label), columns: [] });
      }
      return [...byKey.values()];
    },

    conditions: () => fromRecordByLabel(config().conditions),

    properties() {
      const all = system()?.utility?.allProperties?.() ?? {
        ...config().weaponQualities,
        ...config().weaponFlaws,
        ...config().armorQualities,
        ...config().armorFlaws
      };
      return fromRecordByLabel(all);
    },

    /** Wielkości osad z tabeli dostępności (Village, Town, City...). */
    settlements: () => localizedLower(Object.keys(config().availabilityTable ?? {})),

    /** Rzadkości dla podanej wielkości osady albo ze wszystkich osad. */
    rarities(size) {
      const table = config().availabilityTable ?? {};
      const sizeKey = size
        ? Object.keys(table).find((key) => localize(key).toLowerCase() === String(size).toLowerCase())
        : null;
      const rows = sizeKey ? [table[sizeKey]] : Object.values(table);
      const keys = [...new Set(rows.flatMap((row) => Object.keys(row ?? {})))];
      return localizedLower(keys);
    },

    corruptionStrengths: () => localizedLower(CORRUPTION_STRENGTHS),

    corruptionSkills: () => localizedLower(CORRUPTION_SKILLS),

    speciesLabel(key) {
      const label = config().species?.[key];
      return label ? localize(label) : key;
    }
  };
}
