import { describe, expect, it } from "vitest";
import { analyzeParameters } from "../scripts/chat/parser.mjs";

const table = { args: ["table", "modifier", "column"], defaultArg: "table" };
const pay = { args: ["amount", "for", "target"], defaultArg: "amount" };
const char = { args: [] };
const closed = (...names) => ({ isClosed: (arg) => names.includes(arg) });

describe("analyzeParameters", () => {
  it("pusta komenda – wpisujemy argument domyślny", () => {
    const a = analyzeParameters(table, "");
    expect(a).toMatchObject({ mode: "default", arg: "table", partial: "", prefix: "" });
    expect(a.remaining).toEqual(["table", "modifier", "column"]);
  });

  it("częściowa wartość domyślna", () => {
    expect(analyzeParameters(table, "crit")).toMatchObject({ mode: "default", arg: "table", partial: "crit" });
  });

  it("po wartości domyślnej i spacji – nazwa kolejnego argumentu", () => {
    const a = analyzeParameters(table, "critarm ");
    expect(a).toMatchObject({ mode: "name", partial: "", prefix: "critarm " });
    expect(a.values).toEqual({ table: "critarm" });
    expect(a.remaining).toEqual(["modifier", "column"]);
  });

  it("częściowa nazwa argumentu", () => {
    expect(analyzeParameters(table, "critarm mod")).toMatchObject({ mode: "name", partial: "mod", prefix: "critarm " });
  });

  it("wartość nazwanego argumentu", () => {
    const a = analyzeParameters(table, "mutatephys column=kh");
    expect(a).toMatchObject({ mode: "value", arg: "column", partial: "kh", prefix: "mutatephys column=" });
    expect(a.values).toEqual({ table: "mutatephys", column: "kh" });
  });

  it("odstęp po wartości zamkniętej kończy argument", () => {
    const a = analyzeParameters(table, "mutatephys column=khorne ", closed("column"));
    expect(a).toMatchObject({ mode: "name", partial: "", prefix: "mutatephys column=khorne " });
    expect(a.remaining).toEqual(["modifier"]);
  });

  it("wolny tekst z odstępami zostaje wartością", () => {
    const a = analyzeParameters(pay, "12ss for=Room and Bo");
    expect(a).toMatchObject({ mode: "value", arg: "for", partial: "Room and Bo" });
    expect(a.values).toEqual({ amount: "12ss", for: "Room and Bo" });
  });

  it("kilka nazwanych argumentów", () => {
    const a = analyzeParameters(pay, "12ss for=Room and Board target=Hans");
    expect(a.values).toEqual({ amount: "12ss", for: "Room and Board", target: "Hans" });
    expect(a).toMatchObject({ mode: "value", arg: "target", partial: "Hans" });
  });

  it("argument domyślny podany nazwą", () => {
    const a = analyzeParameters(table, "modifier=20 table=crit");
    expect(a.values).toEqual({ modifier: "20", table: "crit" });
    expect(a).toMatchObject({ mode: "value", arg: "table", partial: "crit" });
  });

  it("komenda bez argumentów", () => {
    const a = analyzeParameters(char, "");
    expect(a).toMatchObject({ mode: "name", partial: "", remaining: [] });
  });

  it("ignoruje początkowe odstępy", () => {
    expect(analyzeParameters(table, "  crit")).toMatchObject({ mode: "default", partial: "crit", text: "crit" });
  });
});
