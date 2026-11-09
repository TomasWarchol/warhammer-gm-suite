/**
 * Podpowiedzi i pomoc do komend czatu systemów Warhammera, wyświetlane w menu Chat Commander.
 */
import { MODULE_ID, log } from "./constants.mjs";
import { analyzeParameters } from "./parser.mjs";
import { getCommandRegistry, listCommands } from "./commands.mjs";
import { registerCommands, registeredCommands } from "./register.mjs";
import { installCorruptionFix } from "./corruption-fix.mjs";

/** Starszy, osobny moduł; razem zarejestrowałyby te same komendy dwa razy. */
const STANDALONE = "wfrp4e-chat-commands";

export function registerChatHints(enabled) {
  for (const key of ["showNotes", "showExamples"]) {
    const name = key.charAt(0).toUpperCase() + key.slice(1);
    game.settings.register(MODULE_ID, key, {
      name: `WFRP4E_CHATCMD.Settings.${name}Name`,
      hint: `WFRP4E_CHATCMD.Settings.${name}Hint`,
      scope: "client",
      config: true,
      type: Boolean,
      default: true
    });
  }

  if (game.modules.get(STANDALONE)?.active) return log.info(`aktywny moduł ${STANDALONE}, podpowiedzi komend z panelu MG wyłączone`);
  // Poprawka błędu przycisku Resist w systemie WFRP nie zależy od Chat Commander
  if (game.system.id === "wfrp4e") Hooks.once("ready", installCorruptionFix);
  if (!enabled) return;

  // Wywoływany przez Chat Commander w hooku "ready", po rejestracji wszystkich komend systemu
  Hooks.once("chatCommandsReady", (chatCommands) => registerCommands(chatCommands));

  game.modules.get(MODULE_ID).api.chat = {
    refresh: () => registerCommands(),
    commands: () => listCommands(getCommandRegistry()),
    registered: () => registeredCommands(),
    analyze: analyzeParameters
  };
}
