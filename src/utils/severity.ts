import type { Severity } from "../types";

/**
 * Centralised severity → styling map.
 * Uses literal class strings (custom neon utilities live in index.css).
 */
export const SEVERITY_STYLES: Record<
  Severity,
  { text: string; border: string; glow: string; dot: string; raw: string; ring: string }
> = {
  ok: {
    text: "text-glow-green",
    border: "border-neon-green",
    glow: "shadow-glow-green",
    dot: "bg-neon-green",
    raw: "#39FF14",
    ring: "shadow-[0_0_0_1px_rgba(57,255,20,0.4)]",
  },
  warning: {
    text: "text-glow-yellow",
    border: "border-neon-yellow",
    glow: "shadow-glow-yellow",
    dot: "bg-neon-yellow",
    raw: "#FFFF00",
    ring: "shadow-[0_0_0_1px_rgba(255,255,0,0.4)]",
  },
  alarm: {
    text: "text-glow-red",
    border: "border-neon-red",
    glow: "shadow-glow-red",
    dot: "bg-neon-red",
    raw: "#FF003C",
    ring: "shadow-[0_0_0_1px_rgba(255,0,60,0.45)]",
  },
  info: {
    text: "text-glow-blue",
    border: "border-neon-blue",
    glow: "shadow-glow-blue",
    dot: "bg-neon-blue",
    raw: "#00FFFF",
    ring: "shadow-[0_0_0_1px_rgba(0,255,255,0.4)]",
  },
};

export const SEVERITY_LABEL_KEY: Record<Severity, "sevOk" | "sevWarning" | "sevAlarm" | "sevInfo"> = {
  ok: "sevOk",
  warning: "sevWarning",
  alarm: "sevAlarm",
  info: "sevInfo",
};
