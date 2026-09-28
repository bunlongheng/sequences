// The chrome around a shared diagram - the public /s/[id] page and the OG card
// it unfurls as. Keyed by the diagram's theme, so a dark diagram is not shown
// floating in a white card on a grey ground. `card` equals the diagram's own
// background (THEMES[theme].bg) so the two blend into one surface.
export type ShareChrome = { ground: string; bar: string; barBorder: string; barText: string; card: string; cardBorder: string; muted: string };

export const SHARE_CHROME: Record<string, ShareChrome> = {
  light:   { ground: "#eceef2", bar: "#ffffff", barBorder: "#e5e7eb", barText: "#111827", card: "#ffffff", cardBorder: "#e5e7eb", muted: "#4b5563" },
  dark:    { ground: "#0d0e14", bar: "#16161e", barBorder: "#1e2030", barText: "#c0caf5", card: "#16161e", cardBorder: "#1e2030", muted: "#a9b1d6" },
  monokai: { ground: "#221F22", bar: "#2C2B2F", barBorder: "#403E41", barText: "#FCFCFA", card: "#2C2B2F", cardBorder: "#403E41", muted: "#FCFCFA" },
};

export const shareChrome = (theme?: string | null): ShareChrome => SHARE_CHROME[theme ?? "light"] ?? SHARE_CHROME.light;
