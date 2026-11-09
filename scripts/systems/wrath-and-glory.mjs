/**
 * Warhammer 40,000: Wrath & Glory (system "wrath-and-glory"): pula kości i Stopień Trudności (ST).
 */
import { entries, quickFrom, testContext } from "./shared.mjs";

export default {
  id: "wrath-and-glory",
  lightSet: "grimdark",
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

  damage: {
    stat: "wounds",
    fields: [
      { id: "ap", type: "number", initial: 0 },
      { id: "shock", type: "number", initial: 0, additive: true },
      { id: "mortal", type: "number", initial: 0, additive: true },
      { id: "ignoreArmour", type: "checkbox", initial: false },
      { id: "ignoreResilience", type: "checkbox", initial: false }
    ],
    read: (actor) => {
      const wounds = actor.system.combat?.wounds;
      return wounds ? { value: wounds.value, max: wounds.max } : null;
    },
    // Bez Determinacji, bo system pytałby o nią przy każdej postaci
    async apply(actor, amount, options) {
      const report = await actor.applyDamage(amount, { ap: options.ap, shock: options.shock, mortal: options.mortal }, { ignoreArmour: options.ignoreArmour, ignoreResilience: options.ignoreResilience, allowDetermination: false });
      return report?.message ?? report?.breakdown?.join?.(" ");
    }
  },

  pools: {
    key: "gloryRuin",
    list: (ctx) => ["glory", "ruin"].map((id) => ({ id, labelKey: `Pools.Side.${id}`, value: ctx.wng.RuinGloryCounter.getValue(id) })),
    async set(ctx, entry, value) {
      await ctx.wng.RuinGloryCounter.setCounter(value, entry.id);
      ctx.counter?.render({ force: true });
    }
  },

  whispers: {
    read: (actor) => actor.system.corruption?.current ?? 0,
    change: (actor, delta) => actor.update({ "system.corruption.current": actor.system.corruption.current + delta })
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
    value: (actor, entry) => (entry.kind === "skill" ? actor.system.skills : actor.system.attributes)?.[entry.key]?.total,

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
