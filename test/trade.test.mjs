import { describe, expect, it } from "vitest";
import { buildCurrencies, detectMoneyNames, priceInBP, priceInGC } from "../scripts/trade/money.mjs";
import { fallbackRow, isAvailable, physicalTypes, pickStock, rollFormula, shuffle, stockQuantity } from "../scripts/trade/availability.mjs";
import { buildIntegration } from "../scripts/trade/integration.mjs";
import { ADAPTERS, adapterFor } from "../scripts/trade/systems/index.mjs";

// Tabela dostępności jak w WFRP4e 10.x
const WFRP_TABLE = {
  "MARKET.Village": {
    "WFRP4E.Availability.Common": { test: 100, stock: "2" },
    "WFRP4E.Availability.Scarce": { test: 30, stock: "1" },
    "WFRP4E.Availability.Rare": { test: 15, stock: "1" },
    "WFRP4E.Availability.Exotic": { test: 0, stock: "0" }
  },
  "MARKET.City": {
    "WFRP4E.Availability.Common": { test: 100, stock: "∞" },
    "WFRP4E.Availability.Scarce": { test: 90, stock: "∞" },
    "WFRP4E.Availability.Rare": { test: 45, stock: "∞" },
    "WFRP4E.Availability.Exotic": { test: 0, stock: "0" }
  }
};

/** Atrapa obiektu `game` z konfiguracją wszystkich systemów. */
const ctx = {
  i18n: { localize: (k) => `L(${k})` },
  actors: [{ itemTypes: { money: [{ name: "Złota Korona", img: "gc.png", system: { coinValue: { value: 240 } } }] } }],
  items: [],
  // Podstawowy indeks kompendium (bez pól systemu) – nominał rozpoznawany po obrazku monety
  packs: [{
    documentName: "Item",
    index: [
      { type: "money", name: "Gold Crown", img: "modules/wfrp4e-core/icons/currency/goldcrown.png" },
      { type: "money", name: "Silver Shilling", img: "modules/wfrp4e-core/icons/currency/silvershilling.png" },
      { type: "money", name: "Brass Penny", img: "modules/wfrp4e-core/icons/currency/brasspenny.png" }
    ]
  }],
  wfrp4e: { config: { availabilityTable: WFRP_TABLE, moneyNames: { gc: "Gold Crown", ss: "Silver Shilling", bp: "Brass Penny" } } },
  oldworld: { config: { status: { brass: "TOW.StatusName.Brass", silver: "TOW.StatusName.Silver", gold: "TOW.StatusName.Gold" } } },
  impmal: { config: { worlds: { feral: "IMPMAL.WorldFeral", forge: "IMPMAL.WorldForge" }, worldAvailability: { feral: { common: 100, scarce: 15, rare: 0, exotic: 0 }, forge: { common: 100, scarce: 90, rare: 45, exotic: 0 } } } },
  wng: { config: { rarity: { common: "RARITY.COMMON", rare: "RARITY.RARE" } } },
  aos: { config: { availability: { "": "-", common: "AVAILABILITY.COMMON", rare: "AVAILABILITY.RARE" } } }
};
const t = (key) => `t(${key})`;

describe("money (WFRP)", () => {
  it("ceny w koronach i pensach", () => {
    expect(priceInGC({ gc: 1, ss: 10, bp: 6 })).toBeCloseTo(1.525);
    expect(priceInBP({ gc: 1, ss: 10, bp: 6 })).toBe(366);
    expect(priceInGC(undefined)).toBe(0);
  });

  it("wykrywa nazwy monet ważone miejscem występowania", () => {
    const names = detectMoneyNames([
      { name: "Gold Crown", coinValue: 240, weight: 1 },
      { name: "Złota Korona", coinValue: 240, img: "gc.png", weight: 3 },
      { name: "Srebrny Szyling", coinValue: 12, weight: 3 }
    ], { bp: "Brass Penny" });
    expect(names).toEqual({ gc: { name: "Złota Korona", img: "gc.png" }, ss: { name: "Srebrny Szyling", img: null }, bp: { name: "Brass Penny", img: null } });
  });

  it("waluty Item Piles: pens główny, kursy w pensach (bez ułamków)", () => {
    const currencies = buildCurrencies({ gc: { name: "A" }, ss: { name: "B" }, bp: { name: "C" } }, { gc: "{#} zk" }, {});
    expect(currencies.map((c) => [c.name, c.primary, c.exchangeRate])).toEqual([["A", false, 240], ["B", false, 12], ["C", true, 1]]);
    expect(currencies[2].data.item).toMatchObject({ type: "money", system: { coinValue: { value: 1 } } });
  });
});

describe("availability", () => {
  it("test dostępności i zapas", () => {
    expect(isAvailable({ test: 60 }, 60)).toBe(true);
    expect(isAvailable({ test: 60 }, 61)).toBe(false);
    expect(isAvailable({ test: 60 }, 70, 10)).toBe(true);
    expect(isAvailable({ test: 0 }, 1)).toBe(false);
    expect(isAvailable(null, 1)).toBe(false);
    expect(stockQuantity("2d10", () => 13)).toEqual({ quantity: 13, infinite: false });
    expect(stockQuantity("∞", () => 0)).toEqual({ quantity: 1, infinite: true });
    expect(shuffle([1, 2, 3], () => 0.5).sort()).toEqual([1, 2, 3]);
    // k10 przy random 0.55 → 6; k5 → 3
    expect(rollFormula("2d10", () => 0.55)).toBe(12);
    expect(rollFormula("1d5 + 2", () => 0.55)).toBe(5);
    expect(rollFormula("d10-1", () => 0)).toBe(0);
    expect(rollFormula("3")).toBe(3);
  });

  it("wiersz zastępczy: wybrane rzadkości, jedna sztuka", () => {
    expect(fallbackRow("rare", ["common", "rare"])).toEqual({ test: 100, stock: "1" });
    expect(fallbackRow("unique", ["common"])).toBeNull();
    expect(fallbackRow(undefined, [])).toEqual({ test: 100, stock: "1" });
  });

  it("typy fizyczne: modele z polem ilości", () => {
    expect(physicalTypes({
      weapon: { schema: { fields: { quantity: {} } } },
      skill: { schema: { fields: {} } },
      "wfrp4e-dwarfs.rune": { schema: { fields: { quantity: {} } } }
    })).toEqual(["weapon", "wfrp4e-dwarfs.rune"]);
  });

  it("dobór towaru z tabeli WFRP: wioska bez rzadkich, miasto bez limitu", () => {
    const wfrp = adapterFor("wfrp4e");
    const candidates = [
      { uuid: "a", name: "Miecz", rarity: "common" },
      { uuid: "b", name: "Kusza", rarity: "rare" },
      { uuid: "c", name: "Proch", rarity: "exotic" }
    ];
    const random = () => 0.2; // k100 = 21
    const village = pickStock(candidates, { rowFor: (c) => wfrp.rowFor(ctx, "MARKET.Village", c.rarity), random, rollDice: () => 0 });
    expect(village.map((s) => [s.name, s.quantity])).toEqual([["Miecz", 2]]);
    const city = pickStock(candidates, { rowFor: (c) => wfrp.rowFor(ctx, "MARKET.City", c.rarity), random, rollDice: () => 0 });
    expect(city.map((s) => s.name).sort()).toEqual(["Kusza", "Miecz"]);
    expect(city.every((s) => s.infinite)).toBe(true);
  });
});

describe("adaptery systemów", () => {
  it("rejestr obejmuje pięć systemów Warhammera", () => {
    expect(Object.keys(ADAPTERS).sort()).toEqual(["age-of-sigmar-soulbound", "impmal", "wfrp4e", "whtow", "wrath-and-glory"]);
    expect(adapterFor("dnd5e")).toBeNull();
  });

  it("ceny w walucie głównej systemu", () => {
    expect(ADAPTERS.wfrp4e.cost({ price: { gc: 2, ss: 10 } })).toBe(600);
    // 18 s 2 p – przypadek, który przy koronie jako walucie głównej tracił pens
    expect(ADAPTERS.wfrp4e.cost({ price: { ss: 18, bp: 2 } })).toBe(218);
    expect(ADAPTERS.whtow.cost({ cost: "silver" })).toBe(12);
    expect(ADAPTERS.whtow.cost({ cost: "" })).toBe(0);
    expect(ADAPTERS.impmal.cost({ cost: 150 })).toBe(150);
    expect(ADAPTERS["wrath-and-glory"].cost({ value: 4 })).toBe(4);
    expect(ADAPTERS["age-of-sigmar-soulbound"].cost({ cost: "3 or a favour" })).toBe(3);
    expect(ADAPTERS["age-of-sigmar-soulbound"].cost({ cost: "-" })).toBe(0);
  });

  it("waluty: WFRP z nazw w świecie, pozostałe jako wartości na karcie", async () => {
    const wfrp = await ADAPTERS.wfrp4e.currencies(ctx, t);
    expect(wfrp.map((c) => c.name)).toEqual(["Złota Korona", "Silver Shilling", "Brass Penny"]);
    const tow = await ADAPTERS.whtow.currencies(ctx, t);
    expect(tow.map((c) => [c.data.path, c.exchangeRate, c.primary])).toEqual([["system.coins.gold", 240, false], ["system.coins.silver", 12, false], ["system.coins.brass", 1, true]]);
    expect((await ADAPTERS.impmal.currencies(ctx, t))[0].data.path).toBe("system.solars");
    expect((await ADAPTERS["wrath-and-glory"].currencies(ctx, t))[0].data.path).toBe("system.resources.wealth");
    expect(await ADAPTERS["age-of-sigmar-soulbound"].currencies(ctx, t)).toEqual([]);
  });

  it("dostępność: tabele WFRP i Imperium Maledictum, rzadkości w pozostałych", () => {
    expect(ADAPTERS.wfrp4e.locations(ctx).map((l) => l.key)).toEqual(["MARKET.Village", "MARKET.City"]);
    expect(ADAPTERS.impmal.locations(ctx)).toEqual([{ key: "feral", label: "L(IMPMAL.WorldFeral)" }, { key: "forge", label: "L(IMPMAL.WorldForge)" }]);
    expect(ADAPTERS.impmal.rowFor(ctx, "forge", "rare")).toEqual({ test: 45, stock: "1" });
    expect(ADAPTERS.impmal.rowFor(ctx, "forge", "")).toBeNull();
    expect(ADAPTERS.whtow.locations(ctx)).toBeNull();
    expect(ADAPTERS.whtow.rarities(ctx).map((r) => r.key)).toEqual(["brass", "silver", "gold"]);
    expect(ADAPTERS["age-of-sigmar-soulbound"].rarities(ctx).map((r) => r.key)).toEqual(["common", "rare"]);
  });

  it("integracja: filtry typów, ilość i cena z adaptera", () => {
    const data = buildIntegration({
      adapter: ADAPTERS.impmal,
      currencies: [],
      itemTypes: ["weapon", "equipment", "talent", "power"],
      physical: ["weapon", "equipment"]
    });
    expect(data.ITEM_FILTERS).toEqual([{ path: "type", filters: "talent,power" }]);
    expect(data.ITEM_QUANTITY_ATTRIBUTE).toBe("system.quantity");
    expect(data.UNSTACKABLE_ITEM_TYPES).toEqual(["weapon"]);
    expect(data.ITEM_COST_TRANSFORMER({ system: { cost: 40 } })).toBe(40);
    expect(data.ACTOR_CLASS_TYPE).toBe("npc");
  });
});
