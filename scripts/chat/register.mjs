/**
 * Rejestracja komend systemu w Chat Commander.
 *
 * Wykonanie zostaje po stronie systemu: Chat Commander przekazuje parametry,
 * a my wywołujemy `game.wfrp4e.commands.call(...)` – dokładnie to samo, co zrobiłby
 * hook czatu systemu. Niezależnie od kolejności hooków komenda wykona się raz.
 */
import { MODULE_ID, t, log } from "./constants.mjs";
import { commandDescription, createAutocomplete } from "./autocomplete.mjs";
import { COMMAND_ICONS, DEFAULT_ICON, getCommandRegistry, listCommands } from "./commands.mjs";
import { cleanParameters } from "./text.mjs";
import { createWfrpData } from "./wfrp-data.mjs";

/** Nazwy komend zarejestrowanych przez ten moduł (do ponownej synchronizacji). */
const registered = new Set();

function createCallback(registry, def) {
  return (_chat, parameters) => {
    try {
      registry.call(def.key, cleanParameters(parameters));
    } catch (err) {
      log.error(`/${def.key}`, err);
      ui.notifications.error(t("Notify.CommandFailed", { command: `${def.prefix}${def.key}` }));
    }
    // Pusty obiekt = komenda obsłużona, bez dodatkowej wiadomości na czacie
    return {};
  };
}

/**
 * Rejestruje (lub odświeża) komendy systemu w Chat Commander.
 * @returns {number} liczba zarejestrowanych komend
 */
export function registerCommands(chatCommands = game.chatCommands) {
  const registry = getCommandRegistry();
  if (!chatCommands || !registry) return 0;

  for (const name of registered) chatCommands.unregister(name);
  registered.clear();

  const data = createWfrpData();
  for (const def of listCommands(registry)) {
    const name = `${def.prefix}${def.key}`;
    try {
      chatCommands.register({
        name,
        aliases: def.aliases.map((alias) => `${def.prefix}${alias}`),
        module: MODULE_ID,
        icon: `<i class="fas ${COMMAND_ICONS[def.key] ?? DEFAULT_ICON}"></i>`,
        description: commandDescription(def),
        requiredRole: "NONE",
        closeOnComplete: false,
        callback: createCallback(registry, def),
        autocompleteCallback: createAutocomplete(def, data)
      });
      registered.add(name);
    } catch (err) {
      log.error(`Nie udało się zarejestrować ${name}`, err);
    }
  }

  log.info(`zarejestrowano ${registered.size} komend w Chat Commander`);
  return registered.size;
}

/** Lista nazw zarejestrowanych komend. */
export function registeredCommands() {
  return [...registered];
}
