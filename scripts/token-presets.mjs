/**
 * Presety światła i wizji tokenów – czysta logika, bez zależności od Foundry.
 * Zasięgi są w jednostkach sceny. WFRP używa wartości z zasad; pozostałe zestawy to punkt wyjścia dla MG.
 */

const flame = { color: "#ffb433", alpha: 0.25, animation: { type: "torch", speed: 3, intensity: 3 } };
const steady = { color: "#fff4d6", alpha: 0.15, animation: { type: null, speed: 5, intensity: 5 } };

const LIGHTS = {
  candle: { range: 10, ...flame },
  torch: { range: 15, ...flame },
  lantern: { range: 20, ...flame },
  stormBroad: { range: 20, ...flame },
  stormNarrow: { range: 30, angle: 60, ...flame },
  pettyLight: { range: 15, ...steady, color: "#d6e8ff" },
  glowGlobe: { range: 10, ...steady },
  stablight: { range: 15, ...steady },
  lampPack: { range: 20, angle: 60, ...steady }
};

export const LIGHT_SETS = {
  wfrp: ["candle", "torch", "lantern", "stormBroad", "stormNarrow", "pettyLight"],
  fantasy: ["candle", "torch", "lantern"],
  grimdark: ["glowGlobe", "stablight", "lampPack"]
};

const VISION = {
  normal: { visionMode: "basic", range: 0 },
  nightVision: { visionMode: "lightAmplification", range: 20 },
  darkVision: { visionMode: "darkvision", range: 60 }
};

export const visionPresets = () => Object.keys(VISION);

/** Czy wpisany zasięg zastępuje zasięg presetu (puste lub 0 oznacza „bez zmian”). */
const rangeOf = (preset, custom) => (Number(custom) > 0 ? Number(custom) : preset.range);

/** Dane `light` tokena dla presetu. Światło przyćmione sięga pełnego zasięgu, jasne połowy. */
export function lightData(id, custom) {
  if (id === "off") return { dim: 0, bright: 0, angle: 360, animation: { type: null } };
  const preset = LIGHTS[id];
  if (!preset) return null;
  const dim = rangeOf(preset, custom);
  return { dim, bright: dim / 2, angle: preset.angle ?? 360, color: preset.color, alpha: preset.alpha, animation: preset.animation };
}

/** Dane `sight` tokena dla presetu. */
export function sightData(id, custom) {
  const preset = VISION[id];
  if (!preset) return null;
  return { enabled: true, visionMode: preset.visionMode, range: rangeOf(preset, custom) };
}

/** Domyślny zasięg presetu światła, do pokazania na przycisku. */
export const lightRange = (id) => LIGHTS[id]?.range ?? 0;
export const visionRange = (id) => VISION[id]?.range ?? 0;
