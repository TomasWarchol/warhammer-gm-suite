/**
 * Koniec sesji – czysta logika, bez zależności od Foundry.
 */

/** Podstawia numer sesji w powodzie przyznania XP (%session%). */
export function expandReason(template, sessionId) {
  return String(template ?? "").replaceAll("%session%", String(sessionId ?? "")).trim();
}

/** Następny numer sesji: liczby rosną o 1, tekst (np. "3a") zostaje bez zmian. */
export function nextSessionId(current) {
  const text = String(current ?? "").trim();
  return /^\d+$/.test(text) ? String(Number(text) + 1) : text;
}

/**
 * Kroki końca sesji w kolejności wykonania – tylko te, które MG zaznaczył i które mają sens.
 * Eksport czatu jest przed czyszczeniem, a podsumowanie trafia na czat dopiero po nim.
 * @returns {string[]}
 */
export function turnoverSteps({ exportChat, clearChat, award, amount, refresh, canRefresh, scene, sceneId, advance }) {
  const steps = [];
  if (exportChat) steps.push("exportChat");
  if (clearChat) steps.push("clearChat");
  if (award && Number(amount) > 0) steps.push("award");
  if (refresh && canRefresh) steps.push("refresh");
  if (scene && sceneId) steps.push("scene");
  if (advance) steps.push("advance");
  return steps;
}
