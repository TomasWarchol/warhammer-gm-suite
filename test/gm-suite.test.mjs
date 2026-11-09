import { describe, expect, it, vi } from "vitest";
import { pickParty } from "../scripts/party.mjs";
import { expandReason, nextSessionId, turnoverSteps } from "../scripts/session-data.mjs";
import { resolveTest, shiftDifficulty, summarise } from "../scripts/group-data.mjs";
import { ADAPTERS, adapterFor } from "../scripts/systems/index.mjs";
import { damageType, fortuneTarget, planTest } from "../scripts/systems/wfrp4e.mjs";
import { lightData, LIGHT_SETS, sightData, visionPresets } from "../scripts/token-presets.mjs";
import { planWhispers, whisperRecipients } from "../scripts/whispers.mjs";
import { damageOptions, hasAdditive, healthChange, stepPool, stripTags } from "../scripts/damage-data.mjs";

const localize = (k) => `L(${k})`;

describe("drużyna", () => {
  const adapter = { partyTypes: ["character"], companyTypes: ["npc"] };
  const anna = { id: "a", name: "Anna", type: "character", hasPlayerOwner: true };
  const bruno = { id: "b", name: "Bruno", type: "npc", hasPlayerOwner: true };
  const wagon = { id: "w", name: "Wóz", type: "vehicle", hasPlayerOwner: true };
  const rat = { id: "r", name: "Szczur", type: "npc", hasPlayerOwner: false };
  const users = [{ isGM: true, character: rat }, { isGM: false, character: anna }, { isGM: false, character: null }];
  const actors = [anna, bruno, wagon, rat];

  it("party: tylko postacie przypisane graczom", () => {
    expect(pickParty({ mode: "party", actors, users, adapter })).toEqual([anna]);
  });
  it("company: też inne postacie graczy, bez pojazdów i bez powtórzeń", () => {
    expect(pickParty({ mode: "company", actors, users, adapter })).toEqual([anna, bruno]);
  });
  it("selected: zaznaczone tokeny dozwolonych typów", () => {
    expect(pickParty({ mode: "selected", actors, users, controlled: [rat, wagon, null], adapter })).toEqual([rat]);
  });
});

describe("koniec sesji", () => {
  it("powód z numerem sesji", () => {
    expect(expandReason("Sesja %session%", 7)).toBe("Sesja 7");
  });
  it("kolejny numer sesji", () => {
    expect(nextSessionId("7")).toBe("8");
    expect(nextSessionId("3a")).toBe("3a");
  });
  it("kroki: kolejność i pomijanie pustych", () => {
    expect(turnoverSteps({ exportChat: true, clearChat: true, award: true, amount: 50, refresh: true, canRefresh: true, scene: true, sceneId: "s", advance: true }))
      .toEqual(["exportChat", "clearChat", "award", "refresh", "scene", "advance"]);
    expect(turnoverSteps({ award: true, amount: 0, refresh: true, canRefresh: false, scene: true, sceneId: "", advance: false })).toEqual([]);
  });
});

describe("test grupowy", () => {
  const catalog = [{ id: "skill:awareness", label: "Czujność" }];
  it("wybór testu: id, nazwa, tekst własny", () => {
    expect(resolveTest("skill:awareness", catalog)).toBe(catalog[0]);
    expect(resolveTest(" czujność ", catalog)).toBe(catalog[0]);
    expect(resolveTest("Coś", catalog)).toEqual({ id: "Coś", label: "Coś", custom: true });
    expect(resolveTest("", catalog)).toBeNull();
  });
  it("przesunięcie trudności zatrzymuje się na końcu listy", () => {
    const order = ["easy", "average", "hard"];
    expect(shiftDifficulty("easy", 1, order)).toBe("average");
    expect(shiftDifficulty("average", 5, order)).toBe("hard");
    expect(shiftDifficulty("nope", 1, order)).toBe("nope");
  });
  it("podsumowanie: najlepsi najpierw, pominięci na końcu", () => {
    const s = summarise([{ name: "A", success: false, score: -2 }, { name: "B", skipped: "x" }, { name: "C", success: true, score: 3 }]);
    expect(s.rows.map((r) => r.name)).toEqual(["C", "A", "B"]);
    expect([s.rolled, s.passed, s.skipped]).toEqual([2, 1, 1]);
  });
});

describe("WFRP", () => {
  const skills = [{ name: "Percepcja" }];
  const basic = { label: "Odporność", advanced: false, characteristic: "t" };
  const advanced = { label: "Leczenie", advanced: true, characteristic: "int" };
  it("posiadana umiejętność, podstawowa i zaawansowana bez wyszkolenia", () => {
    expect(planTest({ label: "percepcja" }, skills).kind).toBe("skill");
    expect(planTest(basic, skills)).toEqual({ kind: "characteristic", key: "t", steps: 0 });
    expect(planTest(advanced, skills)).toEqual({ kind: "skip", reason: "Untrained" });
    expect(planTest(advanced, skills, { fallback: true, steps: 2 })).toEqual({ kind: "characteristic", key: "int", steps: 2 });
    expect(planTest({ label: "Nic", custom: true }, skills)).toEqual({ kind: "skip", reason: "UnknownSkill" });
    expect(planTest({ kind: "characteristic", key: "ag", label: "Zw" }, skills)).toEqual({ kind: "characteristic", key: "ag", steps: 0 });
    // Karta po polsku (Babele), pozycja katalogu po angielsku
    const translated = { name: "Percepcja", flags: { babele: { originalName: "Perception" } } };
    expect(planTest({ label: "Perception", characteristic: "i" }, [translated])).toEqual({ kind: "skill", skill: translated });
    expect(planTest({ label: "Percepcja", aliases: ["Perception"], characteristic: "i" }, [{ name: "Perception" }]).kind).toBe("skill");
  });
  it("Fortuna: Przeznaczenie + Szczęście", () => {
    const actor = { system: { status: { fate: { value: 2 } } }, itemTypes: { talent: [{ name: "Szczęście", system: { advances: { value: 2 } } }, { name: "Inny" }] } };
    expect(fortuneTarget(actor, ["Luck", "Szczęście"])).toBe(4);
  });
});

describe("adaptery", () => {
  const update = vi.fn();
  const ctx = {
    i18n: { localize },
    actors: [{ type: "party", system: { soulfire: { value: 1, max: 4 } }, update }, { type: "player", system: {} }],
    oldworld: { config: { skills: { awareness: "A", melee: "M" } } },
    impmal: { config: { skills: { awareness: "A" }, characteristics: { ws: "W" }, difficulties: { hard: { name: "H", modifier: -20 } } } },
    wng: { config: { skills: { awareness: "A" }, attributes: { agility: "G" } } },
    aos: { config: { skills: { awareness: "A" }, attributes: { body: "B" } } }
  };

  it("rejestr obejmuje pięć systemów", () => {
    expect(Object.keys(ADAPTERS).sort()).toEqual(["age-of-sigmar-soulbound", "impmal", "wfrp4e", "whtow", "wrath-and-glory"]);
    expect(adapterFor("dnd5e")).toBeNull();
  });

  it("każdy adapter ma pełny interfejs", () => {
    for (const a of Object.values(ADAPTERS)) {
      expect(a.partyTypes.length).toBeGreaterThan(0);
      for (const fn of [a.xp.read, a.xp.award, a.refresh.targets, a.refresh.read, a.refresh.apply, a.tests.catalog, a.tests.quick, a.tests.difficulty, a.tests.run, a.tests.read]) expect(fn).toBeTypeOf("function");
    }
  });

  it("katalog i szybkie testy z konfiguracji systemu", async () => {
    const wng = await ADAPTERS["wrath-and-glory"].tests.catalog(ctx);
    expect(wng.map((e) => e.id)).toEqual(["skill:awareness", "attribute:agility"]);
    expect(ADAPTERS["wrath-and-glory"].tests.quick(ctx, wng).map((e) => e.id)).toEqual(["skill:awareness"]);
    expect((await ADAPTERS.whtow.tests.catalog(ctx)).map((e) => e.key).sort()).toEqual(["awareness", "melee"]);
  });

  it("trudność: lista, ST albo brak", () => {
    expect(ADAPTERS.impmal.tests.difficulty(ctx).choices).toEqual([{ id: "hard", label: "L(H)" }]);
    expect(ADAPTERS["wrath-and-glory"].tests.difficulty(ctx)).toEqual({ kind: "dn", initial: 3 });
    expect(ADAPTERS["age-of-sigmar-soulbound"].tests.difficulty(ctx).complexity).toBe(1);
    expect(ADAPTERS.whtow.tests.difficulty(ctx)).toBeNull();
  });

  it("uruchomienie testu właściwą metodą systemu", async () => {
    const actor = { setupSkillTest: vi.fn(async () => "t"), setupAttributeTest: vi.fn(async () => "a"), setupCharacteristicTest: vi.fn(async () => "c"), setupCommonTest: vi.fn(async () => "s") };
    const options = { rollMode: "gmroll", skipDialog: true, difficulty: 3, complexity: 2, modifier: 10 };
    await ADAPTERS["wrath-and-glory"].tests.run(actor, { kind: "attribute", key: "agility" }, options);
    expect(actor.setupAttributeTest).toHaveBeenCalledWith("agility", { skipDialog: true, fields: { rollMode: "gmroll", difficulty: 3 } });
    await ADAPTERS.impmal.tests.run(actor, { kind: "skill", key: "awareness" }, options);
    expect(actor.setupSkillTest).toHaveBeenCalledWith({ key: "awareness" }, expect.objectContaining({ fields: expect.objectContaining({ modifier: 10 }) }));
    await ADAPTERS["age-of-sigmar-soulbound"].tests.run(actor, { kind: "skill", key: "awareness" }, options);
    expect(actor.setupCommonTest).toHaveBeenCalledWith({ skill: "awareness" }, { skipDialog: true, fields: { rollMode: "gmroll", difficulty: 3, complexity: 2 } });
  });

  it("odczyt wyników", () => {
    expect(ADAPTERS.impmal.tests.read({ succeeded: true, result: { roll: 12, target: 40, SL: "+3" } })).toMatchObject({ success: true, detail: "12 / 40", score: 3, scoreText: "+3" });
    expect(ADAPTERS["wrath-and-glory"].tests.read({ result: { success: 2, dn: 3, isSuccess: false } })).toMatchObject({ success: false, score: -1 });
    expect(ADAPTERS.whtow.tests.read({ result: { successes: 2, succeeded: true } })).toMatchObject({ success: true, score: 2 });
    expect(ADAPTERS["age-of-sigmar-soulbound"].tests.read({ result: { successes: 1, success: false } })).toMatchObject({ success: false, score: 1 });
  });

  it("zasoby sesji i XP", () => {
    const soulfire = ADAPTERS["age-of-sigmar-soulbound"].refresh;
    const [party] = soulfire.targets(ctx, []);
    expect(soulfire.read(party)).toEqual({ value: 1, target: 4 });
    soulfire.apply(party, 4);
    expect(update).toHaveBeenCalledWith({ "system.soulfire.value": 4 });

    const reward = { system: { xp: { total: 60 } } };
    const im = { system: { applyReward: vi.fn(() => reward) }, update: vi.fn() };
    ADAPTERS.impmal.xp.award(im, 10, "S1");
    expect(im.update).toHaveBeenCalledWith(reward, { skipXPReason: true });

    const agent = { system: { experience: { total: 5 }, resources: { wrath: 3 } }, update: vi.fn() };
    ADAPTERS["wrath-and-glory"].xp.award(agent, 7);
    expect(agent.update).toHaveBeenCalledWith({ "system.experience.total": 12 });
    expect(ADAPTERS["wrath-and-glory"].refresh.read(agent)).toEqual({ value: 3, target: 1 });
  });
});

describe("obrażenia i pule walki", () => {
  it("raport bez znaczników", () => {
    expect(stripTags("<b>Anna</b> traci <span>3</span> Rany")).toBe("Anna traci 3 Rany");
    expect(stripTags(undefined)).toBe("");
    expect(stripTags('Anna <i data-tooltip="TB: -4<br>AP: -3" style="opacity: 0.5"></i> traci 1')).toBe("Anna traci 1");
  });
  it("zmiana zdrowia", () => {
    expect(healthChange({ value: 12 }, { value: 7, max: 12 })).toBe("12 → 7 / 12");
    expect(healthChange({ value: 5 }, { value: 5 })).toBe("5");
    expect(healthChange(null, { value: 5 })).toBe("");
  });
  it("pule: bez ujemnych i powyżej maksimum", () => {
    expect(stepPool(0, -1)).toBe(0);
    expect(stepPool(3, 1, 3)).toBe(3);
    expect(stepPool(2, 1, 0)).toBe(3);
  });
  it("opcje ze stanu panelu i pola addytywne", () => {
    const fields = [{ id: "shock", additive: true }, { id: "ap" }];
    expect(damageOptions(fields, { dmg_shock: 2, dmg_ap: 1 })).toEqual({ shock: 2, ap: 1 });
    expect(hasAdditive(fields, { shock: 2, ap: 0 })).toBe(true);
    expect(hasAdditive(fields, { shock: 0, ap: 5 })).toBe(false);
  });
  it("WFRP: rodzaj obrażeń", () => {
    const types = { NORMAL: 0, IGNORE_AP: 1, IGNORE_TB: 2, IGNORE_ALL: 3 };
    expect([damageType({}, types), damageType({ ignoreAP: true }, types), damageType({ ignoreTB: true }, types), damageType({ ignoreAP: true, ignoreTB: true }, types)]).toEqual([0, 1, 2, 3]);
  });
  it("każdy adapter ma obrażenia", () => {
    for (const a of Object.values(ADAPTERS)) {
      expect(a.damage.read).toBeTypeOf("function");
      expect(a.damage.apply).toBeTypeOf("function");
      expect(Array.isArray(a.damage.fields)).toBe(true);
    }
  });
  it("Soulbound: obrażenia bez broni mają pusty zastępnik", async () => {
    const applyDamage = vi.fn(async () => ({}));
    await ADAPTERS["age-of-sigmar-soulbound"].damage.apply({ system: { applyDamage } }, 3, { penetrating: 1 });
    expect(applyDamage.mock.calls[0][1].item.damageEffects).toEqual([]);
  });
  it("Wrath & Glory: bez pytania o Determinację", async () => {
    const applyDamage = vi.fn(async () => ({ message: "ok" }));
    expect(await ADAPTERS["wrath-and-glory"].damage.apply({ applyDamage }, 4, { ap: 1, shock: 2, mortal: 0 })).toBe("ok");
    expect(applyDamage.mock.calls[0][2].allowDetermination).toBe(false);
  });
  it("WFRP: Przewaga na postaci albo grupowa", () => {
    const update = vi.fn();
    const anna = { uuid: "A", name: "Anna", update, system: { status: { advantage: { value: 2, max: 5 } } } };
    const updateGroupAdvantage = vi.fn();
    const ctx = (group) => ({ combat: null, wfrp4e: { utility: { updateGroupAdvantage } }, settings: { get: (_s, k) => (k === "useGroupAdvantage" ? group : { players: 1, enemies: 3 }) } });
    const pools = ADAPTERS.wfrp4e.pools;
    const [row] = pools.list(ctx(false), [anna, anna]);
    expect(row).toMatchObject({ id: "A", value: 2, max: 5 });
    expect(pools.list(ctx(false), [anna, anna])).toHaveLength(1);
    pools.set(ctx(false), row, 3);
    expect(update).toHaveBeenCalledWith({ "system.status.advantage.value": 3 });
    const [players] = pools.list(ctx(true), []);
    expect(players).toMatchObject({ id: "players", value: 1 });
    pools.set(ctx(true), players, 2);
    expect(updateGroupAdvantage).toHaveBeenCalledWith({ players: 2 });
  });
});

describe("światło, wizja i szepty", () => {
  it("światło: przyćmione do zasięgu, jasne do połowy, własny zasięg", () => {
    expect(lightData("torch")).toMatchObject({ dim: 15, bright: 7.5, angle: 360 });
    expect(lightData("torch", 30)).toMatchObject({ dim: 30, bright: 15 });
    expect(lightData("stormNarrow")).toMatchObject({ dim: 30, angle: 60 });
    expect(lightData("off")).toMatchObject({ dim: 0, bright: 0 });
    expect(lightData("nope")).toBeNull();
  });
  it("wizja i zestawy", () => {
    expect(sightData("darkVision")).toEqual({ enabled: true, visionMode: "darkvision", range: 60 });
    expect(sightData("nightVision", 40).range).toBe(40);
    for (const a of Object.values(ADAPTERS)) expect(LIGHT_SETS[a.lightSet]?.length).toBeGreaterThan(0);
    expect(visionPresets()).toContain("normal");
    for (const set of Object.values(LIGHT_SETS)) for (const id of set) expect(lightData(id)).not.toBeNull();
  });
  const actor = (id, owners = []) => ({ id, testUserPermission: (u) => owners.includes(u.id) });
  it("odbiorcy szeptu: najpierw przypisani gracze, potem właściciele, nigdy MG", () => {
    const a = actor("a", ["p2", "gm"]);
    const gm = { id: "gm", isGM: true, character: a };
    const p1 = { id: "p1", isGM: false, character: a };
    const p2 = { id: "p2", isGM: false, character: null };
    expect(whisperRecipients(a, [gm, p1, p2])).toEqual([p1]);
    expect(whisperRecipients(a, [gm, p2])).toEqual([p2]);
    expect(whisperRecipients(a, [gm])).toEqual([]);
  });
  it("plan szeptów: pomija bez Spaczenia i bez gracza", () => {
    const tainted = actor("a", ["p"]);
    const pure = actor("b", ["p"]);
    const lonely = actor("c");
    const plan = planWhispers([tainted, pure, lonely], [{ id: "p", isGM: false, character: null }], (x) => (x === pure ? 0 : 2));
    expect(plan.send.map((s) => s.actor.id)).toEqual(["a"]);
    expect([plan.noCorruption, plan.noPlayer]).toEqual([1, 1]);
  });
  it("Spaczenie tylko tam, gdzie system je ma", () => {
    expect(Object.entries(ADAPTERS).filter(([, a]) => a.whispers).map(([id]) => id).sort()).toEqual(["impmal", "wfrp4e", "wrath-and-glory"]);
  });
});
