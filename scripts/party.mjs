/**
 * Dobór drużyny – czysta logika, bez zależności od Foundry.
 */

/**
 * @param {object} params
 * @param {"party"|"company"|"selected"} params.mode  party = postacie przypisane graczom,
 *   company = też inne postacie należące do graczy, selected = zaznaczone tokeny
 * @param {Array} params.actors  wszyscy aktorzy świata
 * @param {Array} params.users  wszyscy użytkownicy
 * @param {Array} [params.controlled]  aktorzy zaznaczonych tokenów
 * @param {{partyTypes: string[], companyTypes: string[]}} params.adapter
 * @returns {Array} aktorzy bez powtórzeń, posortowani po nazwie
 */
export function pickParty({ mode, actors, users, controlled = [], adapter }) {
  const allowed = new Set([...adapter.partyTypes, ...adapter.companyTypes]);
  let picked;
  if (mode === "selected") {
    picked = controlled.filter((a) => a && allowed.has(a.type));
  } else {
    picked = users.filter((u) => !u.isGM && u.character && adapter.partyTypes.includes(u.character.type)).map((u) => u.character);
    if (mode === "company") picked = picked.concat(actors.filter((a) => allowed.has(a.type) && a.hasPlayerOwner));
  }
  const unique = [...new Map(picked.map((a) => [a.id, a])).values()];
  return unique.sort((a, b) => String(a.name).localeCompare(String(b.name)));
}
