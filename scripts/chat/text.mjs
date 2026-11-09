/**
 * Pomocnicze funkcje tekstowe – bez zależności od Foundry (testowane w test/text.test.mjs).
 */

const ENTITIES = {
  "&nbsp;": " ",
  "&amp;": "&",
  "&lt;": "<",
  "&gt;": ">",
  "&quot;": "\"",
  "&#39;": "'",
  "&#x27;": "'",
  "&apos;": "'"
};

/** Zamienia podstawowe encje HTML na znaki (wystarcza dla treści z edytora czatu). */
export function decodeEntities(text) {
  return String(text ?? "")
    .replace(/&(?:nbsp|amp|lt|gt|quot|apos|#39|#x27);/gi, (m) => ENTITIES[m.toLowerCase()] ?? m)
    .replace(/\u00a0/g, " ");
}

/** Usuwa znaczniki HTML; `<br>` i końce akapitów zamienia na nowe linie. */
export function stripHTML(html) {
  return decodeEntities(
    String(html ?? "")
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<\/p>/gi, "\n")
      .replace(/<[^>]*>/g, "")
      // Resztki zepsutych znaczników z opisów systemu, np. `<span font-family:'monospaced'</span>`
      .replace(/<[^\s>]*$/g, "")
  )
    .split("\n")
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter(Boolean)
    .join("\n");
}

/** Escapuje tekst do wstawienia w HTML. */
export function escapeHTML(text) {
  return String(text ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * Normalizuje parametry komendy z edytora czatu (ProseMirror w Foundry v14):
 * zamienia encje i twarde spacje, usuwa znaczniki i zbędne odstępy na końcach.
 */
export function cleanParameters(text) {
  return decodeEntities(String(text ?? "").replace(/<[^>]*>/g, "")).trim();
}

/** Tekst do porównań: małe litery, bez polskich znaków i akcentów. */
export function normalize(text) {
  return String(text ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/ł/g, "l")
    .replace(/Ł/g, "L")
    .toLowerCase()
    .trim();
}
