/**
 * Elementy wspólne adapterów systemów.
 */

/** Pozycje katalogu testów z mapy konfiguracji systemu { klucz: klucz tłumaczenia }. */
export function entries(map, kind, group, localize) {
  return Object.entries(map ?? {})
    .map(([key, label]) => ({ id: `${kind}:${key}`, kind, key, group, label: localize(typeof label === "string" ? label : label?.name ?? key) }))
    .sort((a, b) => a.label.localeCompare(b.label));
}

/** Pola okna rzutu wspólne dla systemów opartych na warhammer-lib. */
export function testContext({ rollMode, skipDialog }, fields = {}) {
  return { skipDialog, fields: { rollMode, ...fields } };
}

/** Wiersz wyniku dla systemów z k100 i Poziomami Sukcesu (WFRP, Imperium Maledictum). */
export function readPercentile(test) {
  const r = test.result ?? {};
  const sl = Number(r.SL) || 0;
  return { success: Boolean(test.succeeded), detail: `${r.roll} / ${r.target}`, score: sl, scoreText: `${sl >= 0 ? "+" : ""}${sl}` };
}

/** Pierwsze `count` szybkich testów, które istnieją w katalogu. */
export function quickFrom(ids, catalog, count = 4) {
  return ids.map((id) => catalog.find((e) => e.id === id)).filter(Boolean).slice(0, count);
}
