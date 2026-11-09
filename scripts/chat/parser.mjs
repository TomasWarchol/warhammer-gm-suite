/**
 * Analiza parametrów komendy w trakcie pisania – bez zależności od Foundry.
 *
 * Składnia komend systemu (warhammer-lib):
 *   /komenda [wartośćDomyślna] [arg=wartość] [arg2=wartość z odstępami] ...
 * Wartość domyślna to pierwsze słowo bez "=", tylko gdy komenda ma `defaultArg`.
 * Wartość nazwanego argumentu trwa do następnego "słowo=" albo do końca tekstu.
 */

const NAMED_ARG = /(^|\s)([A-Za-z][\w-]*)=/g;

/**
 * @typedef {object} CommandAnalysis
 * @property {"default"|"value"|"name"} mode  co jest właśnie wpisywane:
 *   "default" – wartość domyślnego argumentu, "value" – wartość nazwanego argumentu,
 *   "name" – nazwa kolejnego argumentu
 * @property {string|null} arg     argument, którego wartość jest wpisywana (dla "default"/"value")
 * @property {string} partial      wpisywany fragment (do zastąpienia podpowiedzią)
 * @property {string} prefix       tekst przed fragmentem (zostaje bez zmian)
 * @property {string} text         cały tekst parametrów (bez początkowych odstępów)
 * @property {Object<string,string>} values  odczytane wartości argumentów
 * @property {string[]} used       argumenty, które już mają wartość
 * @property {string[]} remaining  argumenty, których jeszcze nie podano
 */

/**
 * Analizuje parametry komendy.
 * @param {{args?: string[], defaultArg?: string}} def  definicja komendy
 * @param {string} raw  tekst parametrów (po nazwie komendy)
 * @param {{isClosed?: (arg: string) => boolean}} [options]
 *   `isClosed(arg)` – czy argument ma zamknięty zbiór jednowyrazowych wartości; wtedy odstęp
 *   po wartości oznacza przejście do następnego argumentu.
 * @returns {CommandAnalysis}
 */
export function analyzeParameters(def, raw, { isClosed = () => false } = {}) {
  const args = def?.args ?? [];
  const defaultArg = def?.defaultArg && args.includes(def.defaultArg) ? def.defaultArg : null;
  const text = String(raw ?? "").replace(/^\s+/, "");
  const matches = [...text.matchAll(NAMED_ARG)].map((m) => ({
    name: m[2],
    start: m.index + m[1].length,
    valueStart: m.index + m[0].length
  }));

  // Wartości argumentów
  const values = {};
  const firstToken = text.split(/\s/)[0];
  if (defaultArg && firstToken && !firstToken.includes("=")) values[defaultArg] = firstToken;
  matches.forEach((m, i) => {
    const end = i + 1 < matches.length ? matches[i + 1].start : text.length;
    values[m.name] = text.slice(m.valueStart, end).trim();
  });

  const used = args.filter((arg) => values[arg]);
  // Argument domyślny można też podać nazwą (np. "table=critarm"), więc też trafia na listę
  const remaining = args.filter((arg) => !values[arg]);
  const result = (mode, arg, partial) => ({
    mode,
    arg,
    partial,
    prefix: text.slice(0, text.length - partial.length),
    text,
    values,
    used,
    remaining
  });
  const lastWord = () => text.match(/(\S*)$/)[1];

  if (!matches.length) {
    if (defaultArg && !/\s/.test(text)) return result("default", defaultArg, text);
    return result("name", null, lastWord());
  }

  const last = matches[matches.length - 1];
  const value = text.slice(last.valueStart);
  if (/\s/.test(value) && isClosed(last.name)) return result("name", null, lastWord());
  return result("value", last.name, value);
}
