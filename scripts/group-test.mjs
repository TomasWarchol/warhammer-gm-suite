/**
 * Tajny test grupowy: rzut za każdą postać przez adapter systemu i zbiorcza karta tylko dla MG.
 */
import { MODULE_ID, t, log } from "./constants.mjs";
import { adapterSettings } from "./settings.mjs";
import { summarise } from "./group-data.mjs";

/**
 * @param {object} adapter
 * @param {Actor[]} actors
 * @param {{id: string, label: string}} entry  pozycja katalogu testów
 * @param {object} options  { difficulty, complexity, modifier, rollMode, skipDialog }
 * @returns {Promise<object>} wynik summarise() z nazwą testu
 */
export async function runGroupTest(adapter, actors, entry, options) {
  const settings = adapterSettings(adapter);
  const results = [];
  for (const actor of actors) {
    try {
      const { test, skipped } = await adapter.tests.run(actor, entry, options, game, settings);
      if (skipped) results.push({ name: actor.name, skipped: t(`Group.Skip.${skipped}`) });
      else if (!test) results.push({ name: actor.name, skipped: t("Group.Skip.Cancelled") });
      else results.push({ name: actor.name, ...adapter.tests.read(test) });
    } catch (err) {
      log.error(`Test grupowy – ${actor.name}`, err);
      results.push({ name: actor.name, skipped: t("Group.Skip.Error") });
    }
  }
  const summary = { ...summarise(results), test: entry.label };
  await postResults(summary);
  return summary;
}

async function postResults(summary) {
  const content = await foundry.applications.handlebars.renderTemplate(`modules/${MODULE_ID}/templates/chat-group.hbs`, summary);
  return ChatMessage.create({ content, speaker: { alias: t("Title") }, whisper: ChatMessage.getWhisperRecipients("GM").map((u) => u.id) });
}
