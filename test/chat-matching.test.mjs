import { describe, expect, it } from "vitest";
import { rankCandidates, scoreCandidate } from "../scripts/chat/matching.mjs";

const conditions = [
  { value: "Krwawienie", label: "Krwawienie", hint: "bleeding" },
  { value: "Oślepienie", label: "Oślepienie", hint: "blinded" },
  { value: "Ogłuszenie", label: "Ogłuszenie", hint: "stunned" },
  { value: "Bleeding", label: "Bleeding" }
];

describe("matching", () => {
  it("ocenia rodzaje dopasowań", () => {
    expect(scoreCandidate("", { value: "x" })).toBe(0);
    expect(scoreCandidate("critarm", { value: "critarm" })).toBe(0);
    expect(scoreCandidate("crit", { value: "critarm" })).toBe(1);
    expect(scoreCandidate("crit", { value: "x", label: "Critical Arm" })).toBe(2);
    expect(scoreCandidate("arm", { value: "x", label: "Critical Arm" })).toBe(3);
    expect(scoreCandidate("itic", { value: "x", label: "Critical Arm" })).toBe(4);
    expect(scoreCandidate("zzz", { value: "x", label: "Critical Arm" })).toBeNull();
  });

  it("dopasowuje bez polskich znaków", () => {
    expect(rankCandidates("osl", conditions).map((c) => c.value)).toEqual(["Oślepienie"]);
  });

  it("sortuje według jakości dopasowania", () => {
    const tables = [
      { value: "mutatemental", label: "Mental Mutation" },
      { value: "critarm", label: "Critical Arm" },
      { value: "mutatephys", label: "Physical Mutation" }
    ];
    expect(rankCandidates("mut", tables).map((c) => c.value)).toEqual(["mutatemental", "mutatephys"]);
    expect(rankCandidates("", tables).map((c) => c.value)).toEqual(["critarm", "mutatemental", "mutatephys"]);
  });
});
