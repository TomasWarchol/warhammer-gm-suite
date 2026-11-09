/**
 * Budowanie listy podpowiedzi z analizy parametrów – bez zależności od Foundry.
 * Wynik renderuje scripts/autocomplete.mjs.
 */
import { rankCandidates } from "./matching.mjs";
import { normalize } from "./text.mjs";

/**
 * @typedef {object} Suggestion
 * @property {"value"|"name"} kind  wartość argumentu albo nazwa kolejnego argumentu
 * @property {string} text   pełny tekst wiadomości po wybraniu (np. "/table critarm ")
 * @property {string} [value]
 * @property {string} [label]
 * @property {string} [hint]
 * @property {string} [arg]  argument, którego dotyczy podpowiedź
 */

/**
 * @param {object} params
 * @param {string} params.alias  użyta nazwa komendy z prefiksem, np. "/table"
 * @param {import("./parser.mjs").CommandAnalysis} params.analysis
 * @param {Array<{value: string, label?: string, hint?: string}>} params.values  wartości dla bieżącego argumentu
 * @returns {{ items: Suggestion[], freeText: boolean }}
 */
export function buildSuggestions({ alias, analysis, values = [] }) {
  const { mode, arg, partial, prefix, text, remaining } = analysis;
  const base = `${alias} `;
  const items = [];

  const nameItems = (filter, before) =>
    remaining
      .filter((name) => name !== arg)
      .filter((name) => !filter || name.toLowerCase().startsWith(normalize(filter)))
      .map((name) => ({ kind: "name", arg: name, label: `${name}=`, text: `${base}${before}${name}=` }));

  if (mode === "name") {
    items.push(...nameItems(partial, prefix));
    return { items, freeText: false };
  }

  // Tryb "default" lub "value": wartości bieżącego argumentu
  const freeText = values.length === 0;
  for (const candidate of rankCandidates(partial, values)) {
    const value = String(candidate.value);
    // Wieloczłonowa wartość domyślna nie zmieści się w pozycyjnym argumencie (system bierze
    // tylko pierwsze słowo), więc wstawiamy ją jako nazwany argument "arg=Wartość Pełna".
    const insertion = mode === "default" && /\s/.test(value) ? `${arg}=${value}` : value;
    items.push({
      kind: "value",
      arg,
      value,
      label: candidate.label ?? value,
      hint: candidate.hint,
      text: `${base}${prefix}${insertion} `
    });
  }

  if (mode === "default" && partial) {
    // Użytkownik może zacząć od nazwanego argumentu zamiast wartości domyślnej
    const matching = nameItems(partial, prefix);
    if (matching.length) {
      items.push(...matching);
      return { items, freeText };
    }
  }

  if (freeText && partial.trim()) {
    // Wolny tekst: po wpisaniu wartości można przejść do kolejnego argumentu
    items.push(...nameItems(null, `${text.trimEnd()} `));
  }

  return { items, freeText };
}
