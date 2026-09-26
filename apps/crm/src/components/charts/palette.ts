// Chart colours are drawn ONLY from the locked brand palette in
// packages/ui/tokens.css (blue #005FA8, red #CC102F, dark navy #020B16, plus
// the semantic --success green that file already flags as its one
// exception). Variety comes from tints/shades of those, never new hues.
export const C = {
  blue: "var(--brand-blue)",
  red: "var(--brand-red)",
  navy: "var(--brand-dark-navy)",
  green: "var(--success)",
};

/** A lighter tint of a palette colour (mixed toward white). */
export const tint = (color: string, pct: number) => `color-mix(in srgb, ${color} ${pct}%, white)`;

/** Blue→navy ramp for ranked series (largest = darkest). */
export const RAMP = [C.navy, "color-mix(in srgb, var(--brand-blue) 100%, black 25%)", C.blue, tint(C.blue, 75), tint(C.blue, 55), tint(C.blue, 38)];

// One colour per business line, used identically on every chart so a
// segment is recognisable at a glance across the whole dashboard.
export const SEGMENT_COLOR: Record<string, string> = {
  "Life Insurance": C.blue,
  "Health Insurance": C.red,
  "General Insurance": C.navy,
  "Mutual Funds": C.green,
  Other: tint(C.navy, 45),
};
export const segmentColor = (name: string) => SEGMENT_COLOR[name] ?? SEGMENT_COLOR.Other;
