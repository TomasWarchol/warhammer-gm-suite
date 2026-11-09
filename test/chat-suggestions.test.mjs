import { describe, expect, it } from "vitest";
import { analyzeParameters } from "../scripts/chat/parser.mjs";
import { buildSuggestions } from "../scripts/chat/suggestions.mjs";

const table = { args: ["table", "modifier", "column"], defaultArg: "table" };
const pay = { args: ["amount", "for", "target"], defaultArg: "amount" };
const prop = { args: ["property"], defaultArg: "property" };
const tableValues = [
  { value: "critarm", label: "Critical Arm" },
  { value: "critleg", label: "Critical Leg" },
  { value: "oops", label: "Oops!" }
];

function suggest(def, params, values = [], closedArgs = []) {
  const analysis = analyzeParameters(def, params, { isClosed: (a) => closedArgs.includes(a) });
  return buildSuggestions({ alias: "/cmd", analysis, values });
}

describe("buildSuggestions", () => {
  it("podpowiada wartości argumentu domyślnego", () => {
    const { items } = suggest(table, "crit", tableValues);
    expect(items.map((i) => i.text)).toEqual(["/cmd critarm ", "/cmd critleg "]);
    expect(items[0]).toMatchObject({ kind: "value", label: "Critical Arm", value: "critarm" });
  });

  it("po wartości podpowiada pozostałe argumenty", () => {
    const { items } = suggest(table, "critarm ", tableValues, ["table"]);
    expect(items.map((i) => i.text)).toEqual(["/cmd critarm modifier=", "/cmd critarm column="]);
  });

  it("filtruje nazwy argumentów", () => {
    const { items } = suggest(table, "critarm co");
    expect(items.map((i) => i.text)).toEqual(["/cmd critarm column="]);
  });

  it("zastępuje częściową wartość nazwanego argumentu", () => {
    const { items } = suggest(table, "mutatephys column=kh", [{ value: "khorne" }, { value: "nurgle" }]);
    expect(items.map((i) => i.text)).toEqual(["/cmd mutatephys column=khorne "]);
  });

  it("wieloczłonowa wartość domyślna trafia jako nazwany argument", () => {
    const { items } = suggest(prop, "arm", [{ value: "Armour Piercing" }, { value: "Impact" }]);
    expect(items.map((i) => i.text)).toEqual(["/cmd property=Armour Piercing "]);
  });

  it("wolny tekst: po wpisaniu wartości – kolejne argumenty", () => {
    const { items, freeText } = suggest(pay, "12ss");
    expect(freeText).toBe(true);
    expect(items.map((i) => i.text)).toEqual(["/cmd 12ss for=", "/cmd 12ss target="]);
  });

  it("wolny tekst: częściowa nazwa argumentu zamiast wartości", () => {
    const { items } = suggest(pay, "fo");
    expect(items.map((i) => i.text)).toEqual(["/cmd for="]);
  });

  it("wolny tekst w nazwanym argumencie", () => {
    const { items } = suggest(pay, "12ss for=Room and Board");
    expect(items.map((i) => i.text)).toEqual(["/cmd 12ss for=Room and Board target="]);
  });

  it("pusta wolna wartość – brak podpowiedzi", () => {
    expect(suggest(pay, "").items).toEqual([]);
  });
});
