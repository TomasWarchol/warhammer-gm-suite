/**
 * Warhammer 40,000: Imperium Maledictum (system "impmal"): k100 i Poziomy Sukcesu.
 */
import { entries, quickFrom, readPercentile, testContext } from "./shared.mjs";

export default {
  id: "impmal",
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

    read: readPercentile
  }
};
