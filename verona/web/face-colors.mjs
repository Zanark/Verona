export const FACE_COLORS = Object.freeze({ mesh: "#4DE8DB", eyes: "#FF0406" });
export const APPEARANCE_KEYS = Object.freeze(["mesh", "eyes", "hair", "lips", "eyebrows"]);
export const COLOR_SWATCHES = Object.freeze({...FACE_COLORS,
  hair: "#24170F", lips: "#A45261", eyebrows: "#30251F"});

// Null is a style-dependent original, not a single approximate swatch color.
export function createAppearance(onApply = () => {}) {
  let colors = Object.fromEntries(APPEARANCE_KEYS.map(key => [key, null]));
  return {
    read: () => ({...colors}),
    apply(patch) {
      if (!patch || typeof patch !== "object" || Array.isArray(patch)) {
        throw new Error("Appearance colors must be an object.");
      }
      const next = {...colors};
      for (const [key, value] of Object.entries(patch)) {
        if (!APPEARANCE_KEYS.includes(key) ||
            (value !== null && (typeof value !== "string" || !/^#[\da-f]{6}$/i.test(value)))) {
          throw new Error("Use mesh, eyes, hair, lips or eyebrows with #RRGGBB or null.");
        }
        next[key] = value === null ? null : value.toUpperCase();
      }
      onApply({...next});
      colors = next;
      return {...colors};
    }
  };
}

export function parseFaceColor(value) {
  if (typeof value !== "string" || !/^#?(?:[\da-f]{3}|[\da-f]{6})$/i.test(value.trim())) {
    throw new Error("Enter a 3- or 6-digit hex color, for example #4DE8DB.");
  }
  let hex = value.trim().replace(/^#/, "");
  if (hex.length === 3) hex = [...hex].map(channel => channel + channel).join("");
  return { hex: `#${hex.toUpperCase()}`,
    rgb: [0, 2, 4].map(index => parseInt(hex.slice(index, index + 2), 16) / 255) };
}
