import { describe, expect, it, vi } from "vitest";
import { getProvider, isClosedArg, providerValues } from "../scripts/chat/providers.mjs";
import { analyzeParameters } from "../scripts/chat/parser.mjs";
import { createWfrpData } from "../scripts/chat/wfrp-data.mjs";

// constants.mjs używa globalnego `game` tylko w t(); w testach wystarczy atrapa
vi.mock("../scripts/chat/constants.mjs", () => ({ t: (key) => `t:${key}` }));

const I18N = {
  "CORRUPTION.Minor": "Mała",
  "CORRUPTION.Moderate": "Umiarkowana",
  "CORRUPTION.Major": "Poważna",
  "NAME.Endurance": "Odporność",
  "NAME.Cool": "Opanowanie",
  "MARKET.Village": "Wioska",
  "MARKET.Town": "Miasteczko",
  "WFRP4E.Availability.Common": "Powszechny",
  "WFRP4E.Availability.Rare": "Rzadki",
  "WFRP4E.Availability.Exotic": "Egzotyczny",
  "WFRP4E.ConditionName.Bleeding": "Krwawienie",
  "WFRP4E.hitLocationTables.hitloc": "Lokacja trafienia",
  "NAME.Human": "Człowiek"
};

function fakeTable(name, key, column) {
  const flags = { key, column };
  return { name, getFlag: (scope, flag) => (scope === "wfrp4e" ? flags[flag] : undefined) };
}

const fakeGame = {
  system: { id: "wfrp4e" },
  i18n: { localize: (key) => I18N[key] ?? key },
  tables: [
    fakeTable("Critical Arm", "critarm"),
    fakeTable("Physical Mutation (Khorne)", "mutatephys", "khorne"),
    fakeTable("Physical Mutation (Nurgle)", "mutatephys", "nurgle"),
    fakeTable("Some Journal Table", undefined)
  ],
  wfrp4e: {
    utility: { allProperties: () => ({ impact: "Impact", armourPiercing: "Armour Piercing" }) },
    config: {
      conditions: { bleeding: "WFRP4E.ConditionName.Bleeding" },
      hitLocationTables: { hitloc: "WFRP4E.hitLocationTables.hitloc" },
      species: { human: "NAME.Human" },
      availabilityTable: {
        "MARKET.Village": { "WFRP4E.Availability.Common": {}, "WFRP4E.Availability.Rare": {} },
        "MARKET.Town": { "WFRP4E.Availability.Common": {}, "WFRP4E.Availability.Exotic": {} }
      }
    }
  }
};

const data = createWfrpData(fakeGame);
const values = (command, arg, params = "") => {
  const def = { args: [arg, "size", "table"], defaultArg: arg };
  return providerValues(command, arg, data, analyzeParameters(def, params));
};

describe("providers + wfrp-data", () => {
  it("tabele z kluczem i kolumnami, plus tabele lokacji trafień", () => {
    expect(data.tables()).toEqual([
      { value: "critarm", label: "Critical Arm", columns: [] },
      { value: "mutatephys", label: "Physical Mutation", columns: ["khorne", "nurgle"] },
      { value: "hitloc", label: "Lokacja trafienia", columns: [] }
    ]);
  });

  it("kolumny zależą od wybranej tabeli", () => {
    const def = { args: ["table", "modifier", "column"], defaultArg: "table" };
    const analysis = analyzeParameters(def, "mutatephys column=");
    expect(providerValues("table", "column", data, analysis).map((v) => v.value)).toEqual(["khorne", "nurgle"]);
  });

  it("stany i cechy – wartością jest zlokalizowana nazwa", () => {
    expect(values("cond", "condition")).toEqual([{ value: "Krwawienie", label: "Krwawienie", hint: "bleeding" }]);
    expect(values("prop", "property").map((v) => v.value)).toEqual(["Impact", "Armour Piercing"]);
  });

  it("dostępność: osady i rzadkości małymi literami, rzadkości wg osady", () => {
    expect(values("avail", "size").map((v) => v.value)).toEqual(["wioska", "miasteczko"]);
    expect(values("avail", "rarity").map((v) => v.value)).toEqual(["powszechny", "rzadki", "egzotyczny"]);
    expect(values("avail", "rarity", "rz size=miasteczko").map((v) => v.value)).toEqual(["powszechny", "egzotyczny"]);
  });

  it("zepsucie: siła i umiejętność", () => {
    expect(values("corruption", "strength").map((v) => v.value)).toEqual(["mała", "umiarkowana", "poważna"]);
    expect(values("corruption", "skill").map((v) => v.value)).toEqual(["odporność", "opanowanie"]);
  });

  it("generator imion i tryb /credit", () => {
    expect(values("name", "species")[0]).toEqual({ value: "human", label: "Człowiek" });
    expect(values("name", "gender").map((v) => v.label)).toEqual(["t:Values.Gender.male", "t:Values.Gender.female"]);
    expect(values("credit", "mode").map((v) => v.value)).toEqual(["split", "each"]);
  });

  it("argumenty z wolnym tekstem nie mają źródła", () => {
    expect(getProvider("pay", "amount")).toBeNull();
    expect(isClosedArg("pay", "for")).toBe(false);
    expect(isClosedArg("table", "column")).toBe(true);
  });

  it("błąd danych systemu nie psuje podpowiedzi", () => {
    const onError = vi.fn();
    const broken = { ...data, conditions: () => { throw new Error("boom"); } };
    expect(providerValues("cond", "condition", broken, analyzeParameters({ args: [] }, ""), onError)).toEqual([]);
    expect(onError).toHaveBeenCalledOnce();
  });

  it("brak konfiguracji systemu – puste listy", () => {
    const empty = createWfrpData({ system: { id: "wfrp4e" }, i18n: { localize: (k) => k }, tables: [] });
    expect(empty.tables()).toEqual([]);
    expect(empty.conditions()).toEqual([]);
    expect(empty.settlements()).toEqual([]);
  });
});
