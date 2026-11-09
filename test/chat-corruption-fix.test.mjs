import { describe, expect, it } from "vitest";
import { resolveStrength } from "../scripts/chat/corruption-fix.mjs";

const labels = { "CORRUPTION.Minor": "Minor", "CORRUPTION.Moderate": "Moderate", "CORRUPTION.Major": "Major" };
const localize = (key) => labels[key] ?? key;

describe("siła ekspozycji na Spaczenie", () => {
  it("rozpoznaje klucze i etykiety bez względu na wielkość liter", () => {
    expect(resolveStrength("minor", localize)).toBe("minor");
    expect(resolveStrength(" MODERATE ", localize)).toBe("moderate");
  });
  it("zwraca formę w języku gry", () => {
    const polish = { "CORRUPTION.Minor": "Pomniejsze", "CORRUPTION.Moderate": "Umiarkowane", "CORRUPTION.Major": "Potężne" };
    expect(resolveStrength("major", (k) => polish[k])).toBe("potężne");
    expect(resolveStrength("Pomniejsze", (k) => polish[k])).toBe("pomniejsze");
  });
  it("odrzuca nieznane wartości", () => {
    expect(resolveStrength("wielkie", localize)).toBeNull();
    expect(resolveStrength(undefined, localize)).toBeNull();
  });
});
