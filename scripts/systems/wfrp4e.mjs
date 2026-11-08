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

export default {
  id: "wfrp4e",
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

    read: readPercentile
  }
};
