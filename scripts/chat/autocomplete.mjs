/**
 * Renderowanie podpowiedzi w menu Chat Commander.
 *
 * Układ menu (od góry): nagłówek ze składnią komendy i opisem bieżącego argumentu,
 * podpowiedzi (najlepsze pierwsze – Chat Commander przycina listę od końca),
 * na pustej komendzie także uwagi i przykłady systemu.
 */
import { I18N, MODULE_ID, t, log } from "./constants.mjs";
import { analyzeParameters } from "./parser.mjs";
import { isClosedArg, providerValues } from "./providers.mjs";
import { buildSuggestions } from "./suggestions.mjs";
import { escapeHTML, stripHTML } from "./text.mjs";

/** Tłumaczenie opcjonalne: zwraca `null`, gdy klucza nie ma w plikach językowych. */
function optional(key) {
  const full = `${I18N}.${key}`;
  return game.i18n.has(full) ? game.i18n.localize(full) : null;
}

/** Opis komendy: tłumaczenie modułu albo (dla nieznanych komend) opis z systemu. */
export function commandDescription(def) {
  return optional(`Commands.${def.key}`) ?? stripHTML(def.description);
}

/** Linia składni, np. `/table <b>table</b> modifier= column=`, z wyróżnionym bieżącym argumentem. */
function signatureHTML(def, alias, currentArg) {
  const parts = def.args.map((arg) => {
    const label = arg === def.defaultArg ? `‹${arg}›` : `${arg}=`;
    const cls = arg === currentArg ? `${MODULE_ID}-arg current` : `${MODULE_ID}-arg`;
    return `<span class="${cls}">${escapeHTML(label)}</span>`;
  });
  return `<span class="command-title">${escapeHTML(alias)}</span> ${parts.join(" ")}`;
}

function headerHTML(def, alias, analysis) {
  const currentArg = analysis.mode === "name" ? null : analysis.arg;
  let html = `<div class="${MODULE_ID}-header">${signatureHTML(def, alias, currentArg)}`;
  html += `<p class="${MODULE_ID}-description">${escapeHTML(commandDescription(def))}</p>`;
  if (currentArg) {
    const hint = optional(`Args.${def.key}.${currentArg}`);
    if (hint) html += `<p class="${MODULE_ID}-hint"><strong>${escapeHTML(currentArg)}</strong>: ${escapeHTML(hint)}</p>`;
  } else if (!def.args.length) {
    html += `<p class="notes">${escapeHTML(t("Menu.NoArguments"))}</p>`;
  } else if (!analysis.remaining.length) {
    html += `<p class="notes">${escapeHTML(t("Menu.AllArguments"))}</p>`;
  }
  return `${html}</div>`;
}

function suggestionHTML(item) {
  if (item.kind === "name") {
    const hint = optional(`Args.${item.commandKey}.${item.arg}`);
    return `<span class="${MODULE_ID}-name">${escapeHTML(item.label)}</span>` +
      (hint ? ` <span class="notes">${escapeHTML(hint)}</span>` : "");
  }
  const showValue = item.label && item.label.toLowerCase() !== String(item.value).toLowerCase();
  return `<span class="${MODULE_ID}-label">${escapeHTML(item.label ?? item.value)}</span>` +
    (showValue ? ` <code>${escapeHTML(item.value)}</code>` : "") +
    (item.hint ? ` <span class="notes">${escapeHTML(item.hint)}</span>` : "");
}

/** Uwagi i przykłady systemu – pokazywane, gdy komenda nie ma jeszcze parametrów. */
function footerEntries(def, chatCommands) {
  const entries = [];
  const notes = game.settings.get(MODULE_ID, "showNotes") ? stripHTML(def.notes) : "";
  const examples = game.settings.get(MODULE_ID, "showExamples") ? stripHTML(def.examples) : "";
  if (notes) {
    entries.push(chatCommands.createInfoElement(
      `<p class="notes"><strong>${escapeHTML(t("Menu.Notes"))}:</strong> ${escapeHTML(notes)}</p>`));
  }
  if (examples) {
    const lines = examples.split("\n").map((line) => `<code>${escapeHTML(line)}</code>`).join("<br>");
    entries.push(chatCommands.createInfoElement(
      `<p class="notes"><strong>${escapeHTML(t("Menu.Examples"))}:</strong><br>${lines}</p>`));
  }
  return entries;
}

/**
 * Tworzy funkcję `autocompleteCallback` dla Chat Commander.
 * @param {object} def  definicja komendy (scripts/commands.mjs)
 * @param {object} data adapter danych (scripts/wfrp-data.mjs)
 */
export function createAutocomplete(def, data) {
  return (_menu, alias, parameters) => {
    const chatCommands = game.chatCommands;
    const analysis = analyzeParameters(def, parameters, { isClosed: (arg) => isClosedArg(def.key, arg) });
    const values = analysis.mode === "name"
      ? []
      : providerValues(def.key, analysis.arg, data, analysis, (err) => log.warn(`Podpowiedzi /${def.key}:`, err));
    const { items } = buildSuggestions({ alias, analysis, values });

    const entries = [chatCommands.createInfoElement(headerHTML(def, alias, analysis))];
    if (items.length) entries.push(chatCommands.createSeparatorElement());
    for (const item of items) {
      entries.push(chatCommands.createCommandElement(item.text, suggestionHTML({ ...item, commandKey: def.key })));
    }
    if (!analysis.text) entries.push(...footerEntries(def, chatCommands));
    return entries;
  };
}
