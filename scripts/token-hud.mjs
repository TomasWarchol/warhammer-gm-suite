/**
 * Rozszerzenie Token HUD: szybkie testy postaci z wartościami, dla właściciela tokena.
 * Listę testów podaje adapter, więc działa w każdym systemie.
 */
import { t, log } from "./constants.mjs";
import { adapterSettings, getSetting } from "./settings.mjs";

const abbreviate = (label) => label.replace(/\s*\(.*$/, "").slice(0, 3).toLocaleUpperCase();

/** Uruchamia test z oknem rzutu, żeby gracz mógł ustawić modyfikatory. */
async function rollFromHud(adapter, actor, entry) {
  const difficulty = adapter.tests.difficulty(game);
  try {
    const result = await adapter.tests.run(actor, entry, { skipDialog: false, difficulty: difficulty?.initial, complexity: difficulty?.complexity, modifier: 0 }, game, adapterSettings(adapter));
    if (result?.skipped) ui.notifications.warn(t(`Group.Skip.${result.skipped}`));
  } catch (err) {
    log.error(`Token HUD – ${actor.name}`, err);
    ui.notifications.error(t("Group.Skip.Error"));
  }
}

function button(adapter, actor, entry) {
  const value = adapter.tests.value?.(actor, entry);
  const element = document.createElement("button");
  element.type = "button";
  element.className = "control-icon whgm-hud-test";
  element.dataset.tooltip = value === undefined ? entry.label : `${entry.label}: ${value}`;
  element.setAttribute("aria-label", entry.label);
  const name = document.createElement("span");
  name.textContent = abbreviate(entry.label);
  element.append(name);
  if (value !== undefined) {
    const number = document.createElement("strong");
    number.textContent = value;
    element.append(number);
  }
  element.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    rollFromHud(adapter, actor, entry);
  });
  return element;
}

/** Katalog budowany raz po starcie, bo w WFRP przegląda kompendia. */
export async function registerTokenHud(adapter) {
  if (!getSetting("enableTokenHud")) return;
  const catalog = await adapter.tests.catalog(game, []);
  const quick = adapter.tests.quick(game, catalog);
  Hooks.on("renderTokenHUD", (hud, html) => {
    const actor = hud.actor ?? hud.document?.actor;
    if (!actor?.isOwner || !quick.length) return;
    const root = html instanceof HTMLElement ? html : hud.element;
    root.querySelector(".whgm-hud")?.remove();
    const column = document.createElement("div");
    column.className = "col whgm-hud";
    for (const entry of quick) column.append(button(adapter, actor, entry));
    root.append(column);
  });
}
