/**
 * Warhammer GM Suite
 * Panel MG dla systemów Warhammera: wykrywa aktywny system i dostosowuje do niego opcje.
 */

import { MODULE_ID, I18N, log } from "./constants.mjs";
import { registerSettings } from "./settings.mjs";
import { adapterFor } from "./systems/index.mjs";
import { GMDashboard } from "./dashboard.mjs";
import { awardXp, endSession, refreshResource } from "./session.mjs";
import { runGroupTest } from "./group-test.mjs";

Hooks.once("init", () => {
  const adapter = adapterFor(game.system.id);
  log.info(adapter ? `init – system ${game.system.id}` : `system ${game.system.id} nie jest obsługiwany`);
  registerSettings(adapter);
  GMDashboard.adapter = adapter;
  foundry.applications.handlebars.loadTemplates([`modules/${MODULE_ID}/templates/party.hbs`]);

  game.modules.get(MODULE_ID).api = {
    /** Adapter aktywnego systemu (null, gdy nieobsługiwany). */
    get adapter() {
      return adapter;
    },
    /** Otwiera panel; `tab`: "session" albo "group". */
    open: (tab) => GMDashboard.open(tab),
    awardXp: (actors, amount, reason) => awardXp(adapter, actors, amount, reason),
    refreshResource: (actors) => refreshResource(adapter, actors),
    endSession: (actors, options) => endSession(adapter, actors, options),
    /** Test grupowy: `entry` to pozycja z `adapter.tests.catalog`. */
    groupTest: (actors, entry, options) => runGroupTest(adapter, actors, entry, options)
  };
});

// Przycisk panelu w narzędziach tokenów (tylko MG)
Hooks.on("getSceneControlButtons", (controls) => {
  if (!game.user.isGM || !GMDashboard.adapter || !controls.tokens) return;
  controls.tokens.tools[MODULE_ID] = {
    name: MODULE_ID,
    title: `${I18N}.Title`,
    icon: "fa-solid fa-chess-rook",
    button: true,
    order: 100,
    onChange: () => GMDashboard.open()
  };
});

// Panel pokazuje aktualne dane drużyny
const refresh = foundry.utils.debounce(() => GMDashboard.refresh(), 150);
Hooks.on("updateActor", refresh);
Hooks.on("controlToken", refresh);
Hooks.on(`${MODULE_ID}.settingsChanged`, refresh);
