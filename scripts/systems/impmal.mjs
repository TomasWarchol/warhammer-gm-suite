/**
 * Warhammer 40,000: Imperium Maledictum (system "impmal"): k100 i Poziomy Sukcesu.
 */
import { entries, quickFrom, readPercentile, testContext } from "./shared.mjs";

export default {
  id: "impmal",
  lightSet: "grimdark",
  partyTypes: ["character"],
  companyTypes: ["npc", "familiar"],

  xp: {
    read(actor) {
      const xp = actor.system.xp;
      return xp && typeof xp === "object" ? { total: xp.total, available: xp.available ?? xp.total } : null;
    },
    // applyReward dopisuje wpis do dziennika XP; skipXPReason wyłącza pytanie systemu o powód
    award: (actor, amount, reason) => actor.update(actor.system.applyReward({ xp: amount, reason }), { skipXPReason: true })
  },

  refresh: {
    key: "fate",
    perActor: true,
    targets: (_ctx, party) => party.filter((a) => a.system.fate),
    read: (actor) => (actor.system.fate ? { value: actor.system.fate.value, target: actor.system.fate.max } : null),
    apply: (actor, target) => actor.update({ "system.fate.value": target })
  },

  // Lokacja trafienia losowana przez system; Rany w tym systemie rosną
  damage: {
    stat: "wounds",
    fields: [{ id: "ignoreAP", type: "checkbox", initial: false }],
    read: (actor) => {
      const wounds = actor.system.combat?.wounds;
      return wounds ? { value: wounds.value, max: wounds.max } : null;
    },
    apply: async (actor, amount, options) => (await actor.system.applyDamage(amount, { ignoreAP: options.ignoreAP, location: "roll" }))?.text
  },

  pools: {
    key: "superiority",
    list: (ctx) => [{ id: "superiority", labelKey: "Pools.superiority", value: ctx.impmal.resources.get("superiority") }],
    set: (ctx, entry, value) => ctx.impmal.resources.set(entry.id, value)
  },

  whispers: {
    read: (actor) => actor.system.corruption?.value ?? 0,
    change: (actor, delta) => actor.update({ "system.corruption.value": actor.system.corruption.value + delta })
  },

  tests: {
    freeText: false,
    modifier: true,
    catalog: async (ctx) => {
      const localize = (k) => ctx.i18n.localize(k);
      return [...entries(ctx.impmal.config.skills, "skill", "skill", localize), ...entries(ctx.impmal.config.characteristics, "characteristic", "characteristic", localize)];
    },
    quick: (_ctx, catalog) => quickFrom(["skill:awareness", "skill:intuition", "skill:discipline", "skill:fortitude"], catalog),

    difficulty: (ctx) => ({
      kind: "select",
      initial: "challenging",
      choices: Object.entries(ctx.impmal.config.difficulties).map(([id, d]) => ({ id, label: ctx.i18n.localize(d.name) }))
    }),

    async run(actor, entry, options) {
      const context = testContext(options, { difficulty: options.difficulty, modifier: options.modifier });
      const test = entry.kind === "skill" ? await actor.setupSkillTest({ key: entry.key }, context) : await actor.setupCharacteristicTest(entry.key, context);
      return { test };
    },

    value: (actor, entry) => (entry.kind === "skill" ? actor.system.skills : actor.system.characteristics)?.[entry.key]?.total,

    read: readPercentile
  }
};
