// Deterministische Avatar-Farben + Initialen.
// Gleiches Seed -> gleiche Farbe. Wir nutzen HSL, damit alle Farben harmonisch
// zusammenpassen (gleiche Sättigung & Helligkeit).

const PALETTE = [
  { bg: "hsl(222 70% 92%)", fg: "hsl(222 60% 28%)" }, // brand blue
  { bg: "hsl(160 55% 88%)", fg: "hsl(160 60% 24%)" }, // emerald
  { bg: "hsl(280 60% 92%)", fg: "hsl(280 50% 32%)" }, // violet
  { bg: "hsl(20 80% 90%)",  fg: "hsl(20 70% 32%)"  }, // orange
  { bg: "hsl(340 70% 92%)", fg: "hsl(340 55% 32%)" }, // pink
  { bg: "hsl(195 65% 88%)", fg: "hsl(195 65% 26%)" }, // cyan
  { bg: "hsl(45 80% 88%)",  fg: "hsl(35 70% 28%)"  }, // amber
  { bg: "hsl(250 60% 92%)", fg: "hsl(250 50% 32%)" }, // indigo
  { bg: "hsl(130 50% 88%)", fg: "hsl(130 50% 24%)" }, // green
  { bg: "hsl(0 70% 92%)",   fg: "hsl(0 55% 36%)"   }, // red
];

function hash(input: string): number {
  let h = 0;
  for (let i = 0; i < input.length; i++) {
    h = (h << 5) - h + input.charCodeAt(i);
    h |= 0;
  }
  return Math.abs(h);
}

export function avatarColor(seed: string | null | undefined): { bg: string; fg: string } {
  const s = (seed ?? "").trim() || "default";
  return PALETTE[hash(s) % PALETTE.length];
}

export function initials(name: string | null | undefined, email?: string | null): string {
  const src = (name ?? "").trim() || (email ?? "").trim();
  if (!src) return "?";
  // E-Mail: lokal-Teil
  const base = src.includes("@") ? src.split("@")[0].replace(/[._-]+/g, " ") : src;
  const parts = base.split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}
