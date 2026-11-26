/**
 * Predefiniowane sklepy tematyczne WFRP 4e/5e, limity low-fantasy oraz planowanie
 * dostępności towaru (tryb 1B: gracze widzą tylko dostępne, MG widzi wszystkie).
 */
import { isAvailable, shuffle, stockQuantity } from "./availability.mjs";

export const SETTLEMENT_LIMITS = {
  "MARKET.Village": 5,
  "MARKET.Town": 10,
  "MARKET.City": 15
};

/** Domyślny limit dostępnych pozycji dla osady (WFRP low-fantasy). */
export function settlementLimit(locationKey) {
  return SETTLEMENT_LIMITS[locationKey] ?? 8;
}

const MELEE_GROUPS = new Set(["basic", "cavalry", "fencing", "flail", "parry", "polearm", "twohanded"]);
const RANGED_GROUPS = new Set(["bow", "crossbow", "sling", "throwing", "entangling", "blackpowder", "engineering", "explosives"]);
const APOTHECARY_TYPES = new Set(["drugsPoisonsHerbsDraughts", "ingredient"]);
const GENERAL_TYPES = new Set(["misc", "toolsAndKits", "tradeTools"]);

/** Definicje 8 tematycznych sklepów WFRP 4e/5e opartych wyłącznie na polach systemowych. */
export const WFRP_SHOP_PRESETS = [
  {
    id: "blacksmith",
    icon: "fa-solid fa-hammer",
    match: (entry) => entry.type === "weapon" && MELEE_GROUPS.has(entry.weaponGroup)
  },
  {
    id: "armourer",
    icon: "fa-solid fa-shield-halved",
    match: (entry, opts) => entry.type === (opts?.armourType ?? "armour")
  },
  {
    id: "fletcher",
    icon: "fa-solid fa-bullseye",
    match: (entry) =>
      (entry.type === "weapon" && RANGED_GROUPS.has(entry.weaponGroup)) ||
      (entry.type === "ammunition" && entry.ammunitionType !== "vehicle" && entry.ammunitionType !== "none")
  },
  {
    id: "apothecary",
    icon: "fa-solid fa-flask",
    match: (entry) => entry.type === "trapping" && APOTHECARY_TYPES.has(entry.trappingType)
  },
  {
    id: "tavern",
    icon: "fa-solid fa-beer-mug-empty",
    match: (entry) => entry.type === "trapping" && entry.trappingType === "foodAndDrink"
  },
  {
    id: "tailor",
    icon: "fa-solid fa-shirt",
    match: (entry) => entry.type === "trapping" && entry.trappingType === "clothingAccessories"
  },
  {
    id: "general",
    icon: "fa-solid fa-sack-dollar",
    match: (entry) => entry.type === "container" || (entry.type === "trapping" && GENERAL_TYPES.has(entry.trappingType))
  },
  {
    id: "scribe",
    icon: "fa-solid fa-book",
    match: (entry) => entry.type === "trapping" && entry.trappingType === "booksAndDocuments"
  }
];

/** Sprawdza czy wpis z kompendium pasuje do wskazanego szablonu sklepu. */
export function matchesShopPreset(entry, presetId, opts = {}) {
  if (!entry || entry.rarity === "exotic") return false;
  const preset = WFRP_SHOP_PRESETS.find((p) => p.id === presetId);
  return preset ? preset.match(entry, opts) : false;
}

/**
 * Planuje dostępność przedmiotów sklepu według tabeli osady i limitu.
 * Elementy z `managed === false` (dodane ręcznie przez MG) pozostają nietknięte, o ile `includeManual` jest false.
 */
export function planShopAvailability(items, { rowFor, limit, modifier = 0, random = Math.random, rollDice, includeManual = false }) {
  const managed = [];
  let untouchedCount = 0;
  for (const item of items ?? []) {
    if (!includeManual && item.managed === false) untouchedCount += 1;
    else managed.push(item);
  }

  const maxAvailable = Number.isFinite(limit) && limit >= 0 ? limit : Infinity;
  const updates = [];
  let availableCount = 0;
  let hiddenCount = 0;

  for (const item of shuffle(managed, random)) {
    const row = rowFor(item);
    const d100 = Math.floor(random() * 100) + 1;
    let available = false;
    let quantity = 0;
    let infinite = false;

    if (availableCount < maxAvailable && isAvailable(row, d100, modifier)) {
      const stock = stockQuantity(row.stock, rollDice);
      if (stock.infinite || stock.quantity > 0) {
        available = true;
        quantity = stock.quantity;
        infinite = stock.infinite;
      }
    }

    if (available) availableCount += 1;
    else hiddenCount += 1;

    updates.push({ id: item.id, available, quantity, infinite });
  }

  return { updates, availableCount, hiddenCount, untouchedCount };
}
