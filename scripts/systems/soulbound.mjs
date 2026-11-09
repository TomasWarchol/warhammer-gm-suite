/**
 * Warhammer Age of Sigmar: Soulbound (system "age-of-sigmar-soulbound"): pula k6 i ST (trudność:złożoność).
 * Ogień Duszy należy do aktora drużyny, nie do postaci.
 */
import { entries, quickFrom, testContext } from "./shared.mjs";

/** System przegląda `item.damageEffects` bez sprawdzenia, czy broń istnieje, więc obrażenia bez broni wymagają pustego zastępnika. */
const NO_ITEM = { damageEffects: [], runScripts: () => [] };

export default {
  id: "age-of-sigmar-soulbound",
  lightSet: "fantasy",
  partyTypes: ["player"],
  companyTypes: ["npc"],

  xp: {
    read(actor) {
      const xp = actor.system.experience;
      return xp ? { total: xp.total, available: xp.outstanding ?? xp.total } : null;
    },
    award: (actor, amount) => actor.update({ "system.experience.total": actor.system.experience.total + amount })
  },

  refresh: {
    key: "soulfire",
    perActor: false,
    targets: (ctx) => [...ctx.actors].filter((a) => a.type === "party" && a.system.soulfire),
    read: (actor) => (actor.system.soulfire ? { value: actor.system.soulfire.value, target: actor.system.soulfire.max } : null),
    apply: (actor, target) => actor.update({ "system.soulfire.value": target })
  },

  damage: {
    stat: "toughness",
    fields: [
      { id: "penetrating", type: "number", initial: 0 },
      { id: "ignoreArmour", type: "checkbox", initial: false },
      { id: "ineffective", type: "checkbox", initial: false }
    ],
    read: (actor) => {
      const toughness = actor.system.combat?.health?.toughness;
      return toughness ? { value: toughness.value, max: toughness.max } : null;
    },
    apply: async (actor, amount, options) => {
      await actor.system.applyDamage(amount, { ignoreArmour: options.ignoreArmour, penetrating: options.penetrating, ineffective: options.ineffective, item: NO_ITEM });
    }
  },

  tests: {
    freeText: false,
    modifier: false,
    catalog: async (ctx) => {
      const localize = (k) => ctx.i18n.localize(k);
      return [...entries(ctx.aos.config.skills, "skill", "skill", localize), ...entries(ctx.aos.config.attributes, "attribute", "attribute", localize)];
    },
    quick: (_ctx, catalog) => quickFrom(["skill:awareness", "skill:determination", "skill:survival", "skill:athletics"], catalog),
    difficulty: () => ({ kind: "dn", initial: 4, complexity: 1 }),
    value: (actor, entry) => (entry.kind === "skill" ? actor.system.skills?.[entry.key]?.training : actor.system.attributes?.[entry.key]?.value),

    async run(actor, entry, options) {
      const target = entry.kind === "skill" ? { skill: entry.key } : { attribute: entry.key };
      return { test: await actor.setupCommonTest(target, testContext(options, { difficulty: options.difficulty, complexity: options.complexity })) };
    },

    read(test) {
      const r = test.result ?? {};
      const successes = Number(r.successes) || 0;
      return { success: Boolean(r.success), detail: "", score: successes, scoreText: String(successes) };
    }
  }
};
