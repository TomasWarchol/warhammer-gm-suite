/**
 * WFRP 4e/5e (system "wfrp4e"): umiejętności to przedmioty z nazwami (także specjalizacje),
 * więc test wybiera się z listy z podpowiedziami albo wpisuje ręcznie.
 */
import { shiftDifficulty } from "../group-data.mjs";
import { entries, readPercentile, testContext } from "./shared.mjs";

const same = (a, b) => String(a).trim().toLocaleLowerCase() === String(b).trim().toLocaleLowerCase();
const isAdvanced = (value) => value === "adv";

/** Nazwy umiejętności: bieżąca i oryginalna sprzed tłumaczenia (Babele), żeby karty PL i kompendia EN się łączyły. */
export const skillNames = (skill) => [skill.name, skill.flags?.babele?.originalName].filter(Boolean);

/**
 * Jak przetestować postać, która może nie mieć umiejętności.
 * Podstawowa bez rozwinięć → test Cechy. Zaawansowana bez wyszkolenia → brak testu albo (ustawienie) Cecha z karą.
 * @returns {{kind: "skill", skill: object}|{kind: "characteristic", key: string, steps: number}|{kind: "skip", reason: string}}
 */
export function planTest(entry, skills, { fallback = false, steps = 1 } = {}) {
  if (entry.kind === "characteristic") return { kind: "characteristic", key: entry.key, steps: 0 };
  const names = [entry.label, ...(entry.aliases ?? [])];
  const owned = skills.find((s) => skillNames(s).some((a) => names.some((b) => same(a, b))));
  if (owned) return { kind: "skill", skill: owned };
  if (!entry.characteristic) return { kind: "skip", reason: "UnknownSkill" };
  if (!entry.advanced) return { kind: "characteristic", key: entry.characteristic, steps: 0 };
  return fallback ? { kind: "characteristic", key: entry.characteristic, steps } : { kind: "skip", reason: "Untrained" };
}

/** Maksimum Fortuny: Przeznaczenie + liczba wykupień talentu Szczęście. */
export function fortuneTarget(actor, luckNames) {
  const talents = actor.itemTypes?.talent ?? [];
  const luck = talents.filter((t) => luckNames.some((n) => same(t.name, n)));
  return (actor.system.status.fate.value ?? 0) + luck.reduce((sum, t) => sum + (Number(t.system?.advances?.value) || 1), 0);
}

const luckNames = (ctx) => ["Luck", ctx.i18n.localize("NAME.Luck")];

/** Rodzaj obrażeń systemu dla opcji pomijania Punktów Pancerza i Bonusu z Wytrzymałości. */
export function damageType({ ignoreAP, ignoreTB }, types) {
  if (ignoreAP && ignoreTB) return types.IGNORE_ALL;
  if (ignoreAP) return types.IGNORE_AP;
  return ignoreTB ? types.IGNORE_TB : types.NORMAL;
}

export default {
  id: "wfrp4e",
  lightSet: "wfrp",
  partyTypes: ["character"],
  companyTypes: ["npc", "creature"],

  settings: {
    advancedFallback: { type: Boolean, default: false },
    fallbackSteps: { type: Number, default: 1 }
  },

  xp: {
    read(actor) {
      const xp = actor.system.details?.experience;
      return xp ? { total: xp.total, available: xp.total - xp.spent } : null;
    },
    award: (actor, amount, reason) => actor.system.awardExp(amount, reason, null, true)
  },

  refresh: {
    key: "fortune",
    perActor: true,
    targets: (_ctx, party) => party.filter((a) => a.system.status?.fortune),
    read(actor, ctx) {
      const fortune = actor.system.status?.fortune;
      return fortune ? { value: fortune.value, target: fortuneTarget(actor, luckNames(ctx)) } : null;
    },
    apply: (actor, target) => actor.update({ "system.status.fortune.value": target })
  },

  damage: {
    stat: "wounds",
    fields: [
      { id: "location", type: "select", initial: "body", choices: (ctx) => Object.entries(ctx.wfrp4e.config.locations).map(([id, label]) => ({ id, label: ctx.i18n.localize(label) })) },
      { id: "ignoreAP", type: "checkbox", initial: false },
      { id: "ignoreTB", type: "checkbox", initial: false },
      { id: "minimumOne", type: "checkbox", initial: true }
    ],
    read: (actor) => {
      const wounds = actor.system.status?.wounds;
      return wounds ? { value: wounds.value, max: wounds.max } : null;
    },
    apply: (actor, amount, options, ctx) => actor.applyBasicDamage(amount, {
      damageType: damageType(options, ctx.wfrp4e.config.DAMAGE_TYPE),
      minimumOne: options.minimumOne,
      loc: options.location,
      suppressMsg: true
    })
  },

  // Przewaga: system przechowuje ją na postaci albo (zasada opcjonalna) wspólnie dla stron walki
  pools: {
    key: "advantage",
    list(ctx, party) {
      if (ctx.settings.get("wfrp4e", "useGroupAdvantage")) {
        const values = ctx.settings.get("wfrp4e", "groupAdvantageValues");
        return ["players", "enemies"].map((id) => ({ id, labelKey: `Pools.Side.${id}`, value: values[id] }));
      }
      const actors = ctx.combat ? ctx.combat.combatants.contents.map((c) => c.actor).filter(Boolean) : party;
      return [...new Map(actors.map((a) => [a.uuid, a])).values()].map((actor) => ({ id: actor.uuid, label: actor.name, actor, value: actor.system.status.advantage.value, max: actor.system.status.advantage.max }));
    },
    set: (ctx, entry, value) => (entry.actor ? entry.actor.update({ "system.status.advantage.value": value }) : ctx.wfrp4e.utility.updateGroupAdvantage({ [entry.id]: value }))
  },

  whispers: {
    read: (actor) => actor.system.status?.corruption?.value ?? 0,
    change: (actor, delta) => actor.update({ "system.status.corruption.value": actor.system.status.corruption.value + delta })
  },

  tests: {
    freeText: true,
    modifier: true,

    async catalog(ctx, party) {
      const skills = new Map();
      const add = (names, advanced, characteristic) => {
        const [name] = names;
        if (/\(\s*\)$/.test(name)) return; // szablony specjalizacji z kompendium, np. "Trening ( )"
        const key = names.at(-1).trim().toLocaleLowerCase();
        if (!skills.has(key)) skills.set(key, { id: name, label: name, aliases: names.slice(1), group: "skill", advanced: isAdvanced(advanced), characteristic });
      };
      // Najpierw umiejętności drużyny (specjalizacje, nazwy w języku kart postaci), potem kompendia
      for (const actor of party) for (const s of actor.itemTypes?.skill ?? []) add(skillNames(s), s.system.advanced?.value, s.system.characteristic?.value);
      for (const pack of ctx.packs.filter((p) => p.documentName === "Item")) {
        for (const e of await pack.getIndex({ fields: ["system.advanced.value", "system.characteristic.value"] })) {
          if (e.type === "skill") add([e.name], e.system?.advanced?.value, e.system?.characteristic?.value);
        }
      }
      const list = [...skills.values()].sort((a, b) => a.label.localeCompare(b.label));
      return [...list, ...entries(ctx.wfrp4e.config.characteristics, "characteristic", "characteristic", (k) => ctx.i18n.localize(k))];
    },

    quick: (ctx, catalog) => ["NAME.Perception", "NAME.Intuition", "NAME.Cool", "NAME.Endurance"]
      .map((k) => ctx.i18n.localize(k))
      .map((name) => catalog.find((e) => [e.label, ...(e.aliases ?? [])].some((n) => same(n, name))))
      .filter(Boolean),

    difficulty: (ctx) => ({
      kind: "select",
      initial: "challenging",
      choices: Object.entries(ctx.wfrp4e.config.difficultyLabels).map(([id, label]) => ({ id, label: ctx.i18n.localize(label) }))
    }),

    async run(actor, entry, options, ctx, settings) {
      const plan = planTest(entry, actor.itemTypes?.skill ?? [], { fallback: settings.advancedFallback, steps: settings.fallbackSteps });
      if (plan.kind === "skip") return { skipped: plan.reason };
      const order = Object.keys(ctx.wfrp4e.config.difficultyLabels);
      const difficulty = plan.steps ? shiftDifficulty(options.difficulty, plan.steps, order) : options.difficulty;
      const context = testContext(options, { difficulty, modifier: options.modifier });
      let test;
      if (plan.kind === "skill") test = await actor.setupSkill(plan.skill, context);
      else test = await actor.setupCharacteristic(plan.key, entry.kind === "characteristic" ? context : { ...context, appendTitle: ` – ${entry.label}` });
      if (test) await test.roll();
      return { test };
    },

    value(actor, entry) {
      const plan = planTest(entry, actor.itemTypes?.skill ?? [], { fallback: true });
      if (plan.kind === "skill") return plan.skill.system.total?.value;
      return plan.kind === "characteristic" ? actor.system.characteristics?.[plan.key]?.value : undefined;
    },

    read: readPercentile
  }
};
