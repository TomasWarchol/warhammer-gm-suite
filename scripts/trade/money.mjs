/**
 * Waluta WFRP – czysta logika, bez zależności od Foundry.
 *
 * 1 złota korona (zk/GC) = 20 srebrnych szylingów (s/SS) = 240 mosiężnych pensów (p/BP).
 * Monety to przedmioty typu "money" z wartością w pensach (system.coinValue.value).
 * Item Piles rozpoznaje walutę po nazwie, a nazwy zależą od języka kompendiów, więc nazwy
 * monet wykrywamy w świecie zamiast wpisywać na sztywno.
 */

/** Nominały: klucz → wartość w pensach. */
export const DENOMINATIONS = { gc: 240, ss: 12, bp: 1 };

/** Cena przedmiotu WFRP ({gc, ss, bp}) w złotych koronach. */
export function priceInGC(price) {
  const p = price ?? {};
  return (Number(p.gc) || 0) + (Number(p.ss) || 0) / 20 + (Number(p.bp) || 0) / 240;
}

/** Cena w pensach (liczba całkowita, wygodna do porównań). */
export function priceInBP(price) {
  const p = price ?? {};
  return (Number(p.gc) || 0) * 240 + (Number(p.ss) || 0) * 12 + (Number(p.bp) || 0);
}

/**
 * Wybiera nazwę i obrazek monety dla każdego nominału.
 * Każdy kandydat ma wagę (np. monety na kartach postaci liczą się bardziej niż w kompendiach);
 * wygrywa nazwa z największą sumą wag, przy remisie – pierwsza napotkana.
 * @param {Array<{name: string, img?: string, coinValue: number, weight?: number}>} candidates
 * @param {Object<string,string>} fallbackNames  nazwy zapasowe, np. config.moneyNames
 * @returns {Object<string,{name: string, img: string|null}>}
 */
export function detectMoneyNames(candidates, fallbackNames = {}) {
  const result = {};
  for (const [key, value] of Object.entries(DENOMINATIONS)) {
    const scores = new Map();
    for (const c of candidates) {
      if (Number(c.coinValue) !== value || !c.name) continue;
      const entry = scores.get(c.name) ?? { name: c.name, img: c.img ?? null, score: 0 };
      entry.score += c.weight ?? 1;
      entry.img ??= c.img ?? null;
      scores.set(c.name, entry);
    }
    const best = [...scores.values()].reduce((a, b) => (!a || b.score > a.score ? b : a), null);
    result[key] = best ? { name: best.name, img: best.img } : { name: fallbackNames[key] ?? key, img: null };
  }
  return result;
}

/**
 * Lista walut w formacie Item Piles (przedmioty typu "money").
 * Waluta główna to mosiężny pens (kurs 1), szyling 12, korona 240 – kwoty są całkowite, bo Item Piles
 * zaokrągla koszt w walucie głównej do 5 miejsc i przy koronie jako głównej gubiłby pensy.
 * @param {Object<string,{name: string, img: string|null}>} names  wynik detectMoneyNames
 * @param {Object<string,string>} abbreviations  skróty, np. { gc: "{#} zk", ss: "{#} s", bp: "{#} p" }
 * @param {Object<string,string>} defaultImages  obrazki zapasowe
 */
export function buildCurrencies(names, abbreviations, defaultImages = {}) {
  return Object.entries(DENOMINATIONS).map(([key, value]) => {
    const img = names[key]?.img ?? defaultImages[key] ?? "icons/commodities/currency/coin-embossed-crown-gold.webp";
    return {
      type: "item",
      name: names[key]?.name ?? key,
      img,
      abbreviation: abbreviations[key] ?? `{#}${key.toUpperCase()}`,
      data: {
        item: {
          name: names[key]?.name ?? key,
          type: "money",
          img,
          system: { coinValue: { value }, quantity: { value: 1 } }
        }
      },
      primary: key === "bp",
      exchangeRate: value
    };
  });
}
