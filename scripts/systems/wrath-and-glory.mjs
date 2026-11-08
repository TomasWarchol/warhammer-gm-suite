/**
 * Warhammer 40,000: Wrath & Glory (system "wrath-and-glory"): pula kości i Stopień Trudności (ST).
 */
import { entries, quickFrom, testContext } from "./shared.mjs";

export default {
  id: "wrath-and-glory",
  partyTypes: ["agent"],
  companyTypes: ["threat"],

  xp: {
    read(actor) {
      const xp = actor.system.experience;
      return xp ? { total: xp.total, available: xp.current ?? xp.total } : null;
    },
    award: (actor, amount) => actor.update({ "system.experience.total": actor.system.experience.total + amount })
  },

  refresh: {
    key: "wrath",
    perActor: true,
    targets: (_ctx, party) => party.filter((a) => a.system.resources?.wrath !== undefined),
    read: (actor) => (actor.system.resources?.wrath !== undefined ? { value: actor.system.resources.wrath, target: 1 } : null),
    apply: (actor, target) => actor.update({ "system.resources.wrath": target })
  },

  tests: {
    freeText: false,
    modifier: false,
    catalog: async (ctx) => {
      const localize = (k) => ctx.i18n.localize(k);
      return [...entries(ctx.wng.config.skills, "skill", "skill", localize), ...entries(ctx.wng.config.attributes, "attribute", "attribute", localize)];
    },
    quick: (_ctx, catalog) => quickFrom(["skill:awareness", "skill:insight", "skill:investigation", "skill:athletics"], catalog),
    difficulty: () => ({ kind: "dn", initial: 3 }),

    async run(actor, entry, options) {
      const context = testContext(options, { difficulty: options.difficulty });
      const test = entry.kind === "skill" ? await actor.setupSkillTest(entry.key, context) : await actor.setupAttributeTest(entry.key, context);
      return { test };
    },

    read(test) {
      const r = test.result ?? {};
      const icons = Number(r.success) || 0;
      return { success: Boolean(r.isSuccess), detail: `${icons} / ${r.dn}`, score: icons - (Number(r.dn) || 0), scoreText: String(icons) };
    }
  }
};
