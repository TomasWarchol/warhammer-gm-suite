/**
 * Źródła podpowiedzi dla argumentów komend WFRP4e.
 *
 * Każde źródło dostaje adapter danych (scripts/wfrp-data.mjs w grze, atrapa w testach),
 * więc ten plik nie zależy od Foundry.
 *
 * Klucz: "komenda.argument". Pola źródła:
 *  - closed: zamknięty zbiór jednowyrazowych wartości (odstęp kończy wartość),
 *  - values(data, analysis): lista { value, label, hint? }.
 */

/** Wartości dla argumentu `mode` komendy /credit (zgodnie z systemem). */
const CREDIT_MODES = ["split", "each"];

/** Gatunki obsługiwane przez generator imion systemu (/name). */
const NAME_SPECIES = ["human", "dwarf", "helf", "welf", "halfling"];

/** Płcie obsługiwane przez generator imion systemu (/name). */
const NAME_GENDERS = ["male", "female"];

export const PROVIDERS = {
  "table.table": {
    closed: true,
    values: (data) => data.tables().map(({ value, label, columns }) => ({
      value,
      label,
      hint: columns?.length ? columns.join(", ") : undefined
    }))
  },
  "table.column": {
    closed: true,
    values: (data, analysis) => {
      const tableKey = analysis.values.table;
      const tables = data.tables();
      const pool = tableKey ? tables.filter((t) => t.value === tableKey) : tables;
      const columns = [...new Set(pool.flatMap((t) => t.columns ?? []))];
      return columns.map((value) => ({ value, label: value }));
    }
  },
  // Nazwy stanów i cech mogą mieć kilka słów – UI wstawia je wtedy jako "arg=Nazwa Pełna"
  "cond.condition": {
    closed: true,
    values: (data) => data.conditions()
  },
  "prop.property": {
    closed: true,
    values: (data) => data.properties()
  },
  "name.gender": {
    closed: true,
    values: (data) => NAME_GENDERS.map((value) => ({ value, label: data.label(`Values.Gender.${value}`) }))
  },
  "name.species": {
    closed: true,
    values: (data) => NAME_SPECIES.map((value) => ({ value, label: data.speciesLabel(value) }))
  },
  "avail.rarity": {
    closed: true,
    values: (data, analysis) => data.rarities(analysis.values.size)
  },
  "avail.size": {
    closed: true,
    values: (data) => data.settlements()
  },
  "corruption.strength": {
    closed: true,
    values: (data) => data.corruptionStrengths()
  },
  "corruption.skill": {
    closed: true,
    values: (data) => data.corruptionSkills()
  },
  "credit.mode": {
    closed: true,
    values: (data) => CREDIT_MODES.map((value) => ({ value, label: data.label(`Values.CreditMode.${value}`) }))
  }
};

/** Zwraca źródło podpowiedzi dla argumentu albo `null` (argument z wolnym tekstem). */
export function getProvider(command, arg) {
  return PROVIDERS[`${command}.${arg}`] ?? null;
}

/** Czy argument ma zamknięty zbiór jednowyrazowych wartości. */
export function isClosedArg(command, arg) {
  return Boolean(getProvider(command, arg)?.closed);
}

/** Bezpiecznie pobiera wartości źródła – błąd w danych systemu nie psuje podpowiedzi. */
export function providerValues(command, arg, data, analysis, onError = () => {}) {
  const provider = getProvider(command, arg);
  if (!provider) return [];
  try {
    return (provider.values(data, analysis) ?? []).filter((v) => v && v.value);
  } catch (err) {
    onError(err);
    return [];
  }
}
