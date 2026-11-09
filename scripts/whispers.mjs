/**
 * Mroczne Szepty: MG podsuwa graczowi pokusę, a gracz odpowiada na karcie czatu.
 * Odpowiedź przetwarza MG (przez zapytanie), bo gracz nie może zmieniać cudzej wiadomości.
 */
import { MODULE_ID, t, log } from "./constants.mjs";
import { getSetting } from "./settings.mjs";

const QUERY = `${MODULE_ID}.whisperAnswer`;
const FLAG = "whisper";

/** Gracze, do których trafia szept: przypisani do postaci, a gdy ich nie ma, jej właściciele. */
export function whisperRecipients(actor, users) {
  const players = users.filter((u) => !u.isGM);
  const assigned = players.filter((u) => u.character?.id === actor.id);
  return assigned.length ? assigned : players.filter((u) => actor.testUserPermission(u, "OWNER"));
}

/** Podział postaci: komu można szeptać, a kogo trzeba pominąć i dlaczego. */
export function planWhispers(actors, users, corruptionOf) {
  const send = [];
  let noCorruption = 0;
  let noPlayer = 0;
  for (const actor of actors) {
    const recipients = whisperRecipients(actor, users);
    if (!(corruptionOf(actor) > 0)) noCorruption += 1;
    else if (!recipients.length) noPlayer += 1;
    else send.push({ actor, recipients });
  }
  return { send, noCorruption, noPlayer };
}

async function card(data) {
  return foundry.applications.handlebars.renderTemplate(`modules/${MODULE_ID}/templates/chat-whisper.hbs`, data);
}

/** Wysyła szepty; zwraca plan, żeby panel mógł zgłosić pominiętych. */
export async function sendWhispers(adapter, actors, ask) {
  const plan = planWhispers(actors, game.users.contents, adapter.whispers.read);
  for (const { actor, recipients } of plan.send) {
    await ChatMessage.create({
      content: await card({ ask, name: actor.name }),
      speaker: { alias: t("Whispers.Speaker") },
      whisper: recipients.map((u) => u.id),
      flags: { [MODULE_ID]: { [FLAG]: { actorUuid: actor.uuid, ask, answer: null } } }
    });
  }
  return plan;
}

/** Po stronie MG: zapisuje odpowiedź, zdejmuje Spaczenie (ustawienie) i powiadamia MG. */
async function receiveAnswer(adapter, { messageId, accept }, { user }) {
  const message = game.messages.get(messageId);
  const data = message?.getFlag(MODULE_ID, FLAG);
  if (!data || data.answer || !message.whisper.includes(user.id)) return false;
  await message.setFlag(MODULE_ID, FLAG, { ...data, answer: accept ? "accepted" : "refused" });
  const actor = await fromUuid(data.actorUuid);
  const lowered = Boolean(accept && actor && getSetting("whisperRemoveCorruption") && adapter.whispers.read(actor) > 0);
  if (lowered) await adapter.whispers.change(actor, -1);
  await ChatMessage.create({
    content: await card({ ask: data.ask, name: actor?.name, report: t(accept ? "Whispers.Accepted" : "Whispers.Refused", { name: actor?.name ?? user.name }), lowered }),
    speaker: { alias: t("Whispers.Speaker") },
    whisper: ChatMessage.getWhisperRecipients("GM").map((u) => u.id)
  });
  return true;
}

function decorate(message, html) {
  const data = message.getFlag(MODULE_ID, FLAG);
  const buttons = html.querySelector?.(".whgm-whisper-buttons");
  if (!data || !buttons) return;
  if (data.answer) {
    buttons.textContent = t(`Whispers.Status.${data.answer}`);
    return;
  }
  if (game.user.isGM) {
    buttons.textContent = t("Whispers.Status.waiting");
    return;
  }
  buttons.addEventListener("click", async (event) => {
    const button = event.target.closest("button[data-answer]");
    if (!button) return;
    const gm = game.users.activeGM;
    if (!gm) return ui.notifications.warn(t("Whispers.NoGM"));
    for (const b of buttons.querySelectorAll("button")) b.disabled = true;
    try {
      await gm.query(QUERY, { messageId: message.id, accept: button.dataset.answer === "accept" });
    } catch (err) {
      log.error("Mroczne Szepty – odpowiedź", err);
      for (const b of buttons.querySelectorAll("button")) b.disabled = false;
    }
  });
}

/** Rejestruje obsługę odpowiedzi i wygląd kart. Wywoływane przy starcie, gdy system ma Spaczenie. */
export function registerWhispers(adapter) {
  CONFIG.queries[QUERY] = (data, context) => receiveAnswer(adapter, data, context);
  Hooks.on("renderChatMessageHTML", decorate);
}
