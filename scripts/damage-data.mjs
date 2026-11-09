/**
 * Obrażenia i pule walki – czysta logika, bez zależności od Foundry.
 */

/** Tekst raportu systemu bez znaczników HTML (atrybuty, np. podpowiedzi, mogą zawierać znaki < i >). */
export const stripTags = (html) => String(html ?? "").replace(/<(?:[^"'>]|"[^"]*"|'[^']*')*>/g, " ").replace(/\s+/g, " ").trim();

/** Czy pola addytywne (np. Szok w Wrath & Glory) pozwalają działać bez głównej wartości obrażeń. */
export const hasAdditive = (fields, options) => fields.some((f) => f.additive && Number(options[f.id]) > 0);

/** Opcje obrażeń odczytane ze stanu panelu (`dmg_<id>`). */
export const damageOptions = (fields, state) => Object.fromEntries(fields.map((f) => [f.id, state[`dmg_${f.id}`]]));

/** Zmiana zdrowia do podsumowania, np. "12 → 7 / 12". */
export function healthChange(before, after) {
  if (!before || !after) return "";
  const max = after.max === undefined ? "" : ` / ${after.max}`;
  return before.value === after.value ? `${after.value}${max}` : `${before.value} → ${after.value}${max}`;
}

/** Wartość puli po zmianie: nigdy poniżej zera ani powyżej maksimum (o ile je ma). */
export function stepPool(value, delta, max) {
  const next = Math.max(0, (Number(value) || 0) + delta);
  return Number.isFinite(max) && max > 0 ? Math.min(next, max) : next;
}
