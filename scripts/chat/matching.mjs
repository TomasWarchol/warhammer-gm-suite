/**
 * Dopasowanie podpowiedzi do wpisywanego tekstu – bez zależności od Foundry.
 */
import { normalize } from "./text.mjs";

/**
 * Ocena dopasowania (mniej = lepiej); `null` gdy brak dopasowania.
 *  0 – dokładnie wartość, 1 – początek wartości, 2 – początek etykiety,
 *  3 – początek słowa w etykiecie, 4 – fragment wartości lub etykiety.
 */
export function scoreCandidate(query, candidate) {
  const q = normalize(query);
  if (!q) return 0;
  const value = normalize(candidate.value);
  const label = normalize(candidate.label ?? candidate.value);
  if (value === q) return 0;
  if (value.startsWith(q)) return 1;
  if (label.startsWith(q)) return 2;
  if (label.split(/[\s\-_/()]+/).some((word) => word.startsWith(q))) return 3;
  if (value.includes(q) || label.includes(q)) return 4;
  return null;
}

/**
 * Filtruje i sortuje kandydatów `{ value, label }` według dopasowania do zapytania.
 * Przy pustym zapytaniu zwraca wszystkich w kolejności alfabetycznej etykiet.
 */
export function rankCandidates(query, candidates) {
  return candidates
    .map((candidate) => ({ candidate, score: scoreCandidate(query, candidate) }))
    .filter((entry) => entry.score !== null)
    .sort((a, b) =>
      a.score - b.score ||
      String(a.candidate.label ?? a.candidate.value).localeCompare(String(b.candidate.label ?? b.candidate.value))
    )
    .map((entry) => entry.candidate);
}
