/**
 * Warhammer: The Old World (system "whtow"): testy puli kości, bez stopni trudności.
 */
import { entries, quickFrom, testContext } from "./shared.mjs";

export default {
  id: "whtow",
  partyTypes: ["character"],
  companyTypes: ["npc"],

  xp: {
    read(actor) {
      const xp = actor.system.xp;
      return xp ? { total: xp.total, available: xp.available ?? xp.total } : null;
    },
    award: (actor, amount, reason) => actor.system.awardXP(amount, reason)
  },

  refresh: {
    key: "fate",
    perActor: true,
    targets: (_ctx, party) => party.filter((a) => a.system.fate),
    read: (actor) => (actor.system.fate ? { value: actor.system.fate.current, target: actor.system.fate.max } : null),
    apply: (actor, target) => actor.update({ "system.fate.current": target })
  },

  tests: {
    freeText: false,
    modifier: false,
    catalog: async (ctx) => entries(ctx.oldworld.config.skills, "skill", "skill", (k) => ctx.i18n.localize(k)),
    quick: (_ctx, catalog) => quickFrom(["skill:awareness", "skill:survival", "skill:endurance", "skill:athletics"], catalog),
    difficulty: () => null,

    async run(actor, entry, options) {
      return { test: await actor.setupSkillTest(entry.key, testContext(options)) };
    },

    read(test) {
      const r = test.result ?? {};
      const successes = Number(r.successes) || 0;
      return { success: Boolean(r.succeeded), detail: "", score: successes, scoreText: String(successes) };
    }
  }
};
