/**
 * Obrażenia poza walką dla wielu postaci: zasady liczy system przez adapter, MG dostaje jedno podsumowanie.
 */
import { MODULE_ID, t, log } from "./constants.mjs";
import { healthChange, stripTags } from "./damage-data.mjs";

/** Wynik wzoru: liczba albo rzut kośćmi (np. "1d10+4"). Puste pole to 0. */
async function rollAmount(formula) {
  const text = String(formula ?? "").trim();
  if (!text) return 0;
  const roll = await new Roll(text).evaluate();
  return Math.max(0, roll.total);
}

/** Część systemów (WFRP) kończy `applyDamage` przed zapisem Ran, więc odczyt zmiany czeka na aktualizację aktora, najdłużej chwilę. */
function nextActorUpdate(actor, timeout = 750) {
  return new Promise((resolve) => {
    const finish = () => {
      Hooks.off("updateActor", hook);
      clearTimeout(timer);
      resolve();
    };
    const hook = Hooks.on("updateActor", (doc) => {
      if (doc.uuid === actor.uuid) finish();
    });
    const timer = setTimeout(finish, timeout);
  });
}

/**
 * @param {object} adapter
 * @param {Actor[]} actors
 * @param {{formula: string, perActor: boolean, options: object}} request
 * @returns {Promise<{rows: object[], total: number}>}
 */
export async function applyGroupDamage(adapter, actors, { formula, perActor = false, options = {} }) {
  const shared = perActor ? null : await rollAmount(formula);
  const rows = [];
  for (const actor of actors) {
    const row = { name: actor.name, amount: shared };
    try {
      if (perActor) row.amount = await rollAmount(formula);
      const before = adapter.damage.read(actor);
      const updated = nextActorUpdate(actor);
      const report = await adapter.damage.apply(actor, row.amount, options, game);
      if (adapter.damage.read(actor)?.value === before?.value) await updated;
      row.change = healthChange(before, adapter.damage.read(actor));
      row.text = stripTags(report);
    } catch (err) {
      log.error(`Obrażenia – ${actor.name}`, err);
      row.failed = true;
      row.text = t("Damage.Failed");
    }
    rows.push(row);
  }
  const summary = { rows, formula: String(formula ?? "").trim() };
  await postSummary(summary);
  return summary;
}

async function postSummary(summary) {
  const content = await foundry.applications.handlebars.renderTemplate(`modules/${MODULE_ID}/templates/chat-damage.hbs`, summary);
  return ChatMessage.create({ content, speaker: { alias: t("Title") }, whisper: ChatMessage.getWhisperRecipients("GM").map((u) => u.id) });
}
