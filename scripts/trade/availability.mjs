/**
 * Dobór towaru dla kupca – czysta logika, bez zależności od Foundry.
 *
 * Systemy z tabelą dostępności (WFRP: wielkość osady, Imperium Maledictum: typ świata) dostarczają
 * wiersz { test, stock } dla miejsca i rzadkości. Systemy bez tabeli dostają wiersz zastępczy:
 * każdy przedmiot z wybranych rzadkości jest dostępny w jednym egzemplarzu.
 */

/**
 * Czy towar jest dostępny: rzut k100 (minus modyfikator) ≤ wartość testu.
 * @param {{test: number}|null} row
 * @param {number} d100  wynik rzutu 1–100
 * @param {number} [modifier]  premia (+) ułatwia, jak w systemowym /avail
 */
export function isAvailable(row, d100, modifier = 0) {
  if (!row || row.test <= 0) return false;
  return d100 - modifier <= row.test;
}

/**
 * Wielkość zapasu z formuły: liczba ("2"), kości ("2d10") albo "∞" (bez limitu).
 * @param {string} formula
 * @param {(formula: string) => number} rollDice
 * @returns {{quantity: number, infinite: boolean}}
 */
export function stockQuantity(formula, rollDice) {
  const f = String(formula ?? "0").trim();
  if (f === "∞" || /^inf/i.test(f)) return { quantity: 1, infinite: true };
  if (/d/i.test(f)) return { quantity: Math.max(0, Math.floor(rollDice(f))), infinite: false };
  return { quantity: Math.max(0, Math.floor(Number(f) || 0)), infinite: false };
}

/**
 * Rzut formułą zapasu: sumy kości i liczb ("2d10", "1d5+2", "3").
 * Synchronicznie – Roll.evaluateSync w Foundry pomija kości (zwraca 0).
 * @param {string} formula
 * @param {() => number} [random]  źródło losowości 0–1
 */
export function rollFormula(formula, random = Math.random) {
  let total = 0;
  for (const [, sign, count, faces, flat] of String(formula).replace(/\s+/g, "").matchAll(/([+-]?)(?:(\d*)d(\d+)|(\d+))/gi)) {
    let value = 0;
    if (faces) for (let i = 0; i < (Number(count) || 1); i++) value += Math.floor(random() * Number(faces)) + 1;
    else value = Number(flat);
    total += sign === "-" ? -value : value;
  }
  return total;
}

/** Losowa kolejność (Fisher–Yates) z podanym źródłem losowości. */
export function shuffle(list, random = Math.random) {
  const a = [...list];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * Dobiera towar dla kupca.
 * @param {Array<{uuid: string, name: string, type: string, rarity?: string}>} candidates
 * @param {object} options
 * @param {(candidate: object) => ({test: number, stock: string}|null)} options.rowFor  wiersz dostępności kandydata
 * @param {number} [options.limit]  najwyżej tyle różnych przedmiotów
 * @param {number} [options.modifier]  modyfikator testu dostępności
 * @param {() => number} [options.random]  źródło losowości 0–1
 * @param {(formula: string) => number} options.rollDice
 * @returns {Array<{uuid: string, name: string, quantity: number, infinite: boolean}>}
 */
export function pickStock(candidates, { rowFor, limit = 30, modifier = 0, random = Math.random, rollDice }) {
  const stock = [];
  for (const candidate of shuffle(candidates, random)) {
    if (stock.length >= limit) break;
    const row = rowFor(candidate);
    const d100 = Math.floor(random() * 100) + 1;
    if (!isAvailable(row, d100, modifier)) continue;
    const { quantity, infinite } = stockQuantity(row.stock, rollDice);
    if (!infinite && quantity <= 0) continue;
    stock.push({ uuid: candidate.uuid, name: candidate.name, quantity, infinite });
  }
  return stock;
}

/** Wiersz zastępczy dla systemów bez tabeli: wybrane rzadkości zawsze dostępne, 1 sztuka. */
export function fallbackRow(rarity, allowedRarities) {
  if (allowedRarities.length && !allowedRarities.includes(rarity ?? "")) return null;
  return { test: 100, stock: "1" };
}

/**
 * Typy przedmiotów fizycznych: te, których model danych ma pole ilości (`quantity`).
 * Działa w każdym systemie bez ręcznej listy typów.
 * @param {Object<string, {schema?: {fields?: object}}>} dataModels  CONFIG.Item.dataModels
 */
export function physicalTypes(dataModels) {
  return Object.entries(dataModels ?? {})
    .filter(([, model]) => Boolean(model?.schema?.fields?.quantity))
    .map(([type]) => type);
}
