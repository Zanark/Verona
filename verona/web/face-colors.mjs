export const FACE_COLORS = Object.freeze({ mesh: "#4DE8DB", eyes: "#FF0406" });

export function parseFaceColor(value) {
  if (typeof value !== "string" || !/^#?(?:[\da-f]{3}|[\da-f]{6})$/i.test(value.trim())) {
    throw new Error("Enter a 3- or 6-digit hex color, for example #4DE8DB.");
  }
  let hex = value.trim().replace(/^#/, "");
  if (hex.length === 3) hex = [...hex].map(channel => channel + channel).join("");
  return { hex: `#${hex.toUpperCase()}`,
    rgb: [0, 2, 4].map(index => parseInt(hex.slice(index, index + 2), 16) / 255) };
}
