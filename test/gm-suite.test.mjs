import { describe, expect, it, vi } from "vitest";
import { pickParty } from "../scripts/party.mjs";
import { expandReason, nextSessionId, turnoverSteps } from "../scripts/session-data.mjs";
import { resolveTest, shiftDifficulty, summarise } from "../scripts/group-data.mjs";
import { ADAPTERS, adapterFor } from "../scripts/systems/index.mjs";
import { fortuneTarget, planTest } from "../scripts/systems/wfrp4e.mjs";

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
