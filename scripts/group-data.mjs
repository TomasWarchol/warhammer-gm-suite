/**
 * Test grupowy – czysta logika, bez zależności od Foundry.
 */

const same = (a, b) => String(a).trim().toLocaleLowerCase() === String(b).trim().toLocaleLowerCase();

/**
 * Pozycja katalogu testów dla wpisanej lub wybranej wartości (identyfikator albo nazwa).
 * Tekst spoza katalogu daje pozycję `custom` – adapter decyduje, czy umie ją obsłużyć.
 */
export function resolveTest(value, catalog) {
  const text = String(value ?? "").trim();
  if (!text) return null;
  const named = (e) => [e.label, ...(e.aliases ?? [])].some((name) => same(name, text));
  return catalog.find((e) => e.id === text) ?? catalog.find(named) ?? { id: text, label: text, custom: true };
}

/** Trudność przesunięta o `steps` stopni w stronę trudniejszych (lista od najłatwiejszej). */
export function shiftDifficulty(key, steps, order) {
  const index = order.indexOf(key);
  if (index < 0) return key;
  return order[Math.min(order.length - 1, index + Math.max(0, steps))];
}

/**
 * Podsumowanie testu grupowego: najlepsze wyniki najpierw, pominięci na końcu.
 * @param {Array<{name: string, skipped?: string, success?: boolean, score?: number}>} results
 */
export function summarise(results) {
  const rolled = results.filter((r) => !r.skipped).sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
  const skipped = results.filter((r) => r.skipped);
  return {
    rows: [...rolled, ...skipped],
    rolled: rolled.length,
    passed: rolled.filter((r) => r.success).length,
    skipped: skipped.length
  };
}
