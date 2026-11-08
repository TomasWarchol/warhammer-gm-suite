/**
 * Koniec sesji w grze: XP, odnowienie zasobu, czat, scena. Kolejność kroków z session-data.mjs.
 */
import { MODULE_ID, t, log } from "./constants.mjs";
import { getSetting, setSetting } from "./settings.mjs";
import { nextSessionId, turnoverSteps } from "./session-data.mjs";

/** Przyznaje XP; zwraca aktorów, którzy je dostali. */
export async function awardXp(adapter, actors, amount, reason) {
  const eligible = actors.filter((a) => adapter.xp.read(a));
  for (const actor of eligible) await adapter.xp.award(actor, amount, reason);
  return eligible;
}

/** Odnawia zasób sesji (Fortuna, Los, Gniew, Ogień Duszy); zwraca aktorów, których to dotyczyło. */
export async function refreshResource(adapter, party) {
  const targets = adapter.refresh.targets(game, party);
  for (const actor of targets) await adapter.refresh.apply(actor, adapter.refresh.read(actor, game).target);
  return targets;
}

async function postSummary(lines) {
  const content = await foundry.applications.handlebars.renderTemplate(`modules/${MODULE_ID}/templates/chat-session.hbs`, { lines });
  return ChatMessage.create({ content, speaker: { alias: t("Title") } });
}

/**
 * Kończy sesję wybranymi krokami.
 * @param {object} adapter
 * @param {Actor[]} party
 * @param {object} options  { exportChat, clearChat, award, amount, reason, refresh, scene, sceneId, advance }
 * @returns {Promise<string[]>} wykonane kroki
 */
export async function endSession(adapter, party, options) {
  const canRefresh = adapter.refresh.targets(game, party).length > 0;
  const steps = turnoverSteps({ ...options, canRefresh });
  const lines = [];
  const sessionId = getSetting("sessionId");
  lines.push(t("Session.Summary.Ended", { session: sessionId }));

  for (const step of steps) {
    try {
      if (step === "exportChat") await game.messages.export();
      if (step === "clearChat") await ChatMessage.implementation.deleteDocuments([], { deleteAll: true });
      if (step === "award") {
        const actors = await awardXp(adapter, party, options.amount, options.reason);
        lines.push(t("Session.Summary.Xp", { amount: options.amount, names: actors.map((a) => a.name).join(", ") }));
      }
      if (step === "refresh") {
        await refreshResource(adapter, party);
        lines.push(t(`Refresh.${adapter.refresh.key}.Done`));
      }
      if (step === "scene") await game.scenes.get(options.sceneId)?.activate();
      if (step === "advance") {
        const next = nextSessionId(sessionId);
        await setSetting("sessionId", next);
        lines.push(t("Session.Summary.Next", { session: next }));
      }
    } catch (err) {
      log.error(`Koniec sesji – krok ${step}`, err);
      ui.notifications.error(t("Session.StepFailed", { step: t(`Session.Step.${step}`) }));
    }
  }
  await postSummary(lines);
  return steps;
}
