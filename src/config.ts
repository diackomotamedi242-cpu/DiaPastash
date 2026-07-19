/**
 * DiaPastash — Static configuration.
 *
 * ╔══════════════════════════════════════════════════════════════════════╗
 * ║  ⚠️  CONFIGURE THESE BEFORE DEPLOYING  ⚠️                              ║
 * ║                                                                       ║
 * ║  API_BASE_URL  → REST base, e.g. https://api.yourdomain.com/api/v1    ║
 * ║  SOCKET_URL    → Socket.IO origin, e.g. https://api.yourdomain.com    ║
 * ║                                                                       ║
 * ║  Both MUST be HTTPS and on a backend that sends CORS headers with     ║
 * ║  Access-Control-Allow-Credentials: true.                              ║
 * ╚══════════════════════════════════════════════════════════════════════╝
 */

/** Backend REST API base (must end without trailing slash). */
export const API_BASE_URL = "https://diapastash-backend.onrender.com/api/v1";

/** Backend Socket.IO origin. */
export const SOCKET_URL = "https://diapastash-backend.onrender.com";

export const STORAGE_KEYS = {
  settings: "diapastash.settings",
  lang: "diapastash.lang",
  demo: "diapastash.demo", // local UI preview flag only — never a real session
} as const;

import type { Accent, ModuleType, Settings } from "./types";

/** User-preference defaults (NO backend secrets here). */
export function defaultSettings(): Settings {
  return {
    appIconUrl: "",
    themeAccent: "green",
    notifications: false,
  };
}

/** Accent presets → drives the `--accent` / `--accent-rgb` CSS variables. */
export const ACCENTS: {
  id: Accent;
  key: "accentGreen" | "accentCyan" | "accentPink" | "accentYellow" | "accentRed";
  color: string;
  rgb: string;
}[] = [
  { id: "green", key: "accentGreen", color: "#39FF14", rgb: "57,255,20" },
  { id: "cyan", key: "accentCyan", color: "#00FFFF", rgb: "0,255,255" },
  { id: "pink", key: "accentPink", color: "#FF00FF", rgb: "255,0,255" },
  { id: "yellow", key: "accentYellow", color: "#FFFF00", rgb: "255,255,0" },
  { id: "red", key: "accentRed", color: "#FF003C", rgb: "255,0,60" },
];

export interface ModuleDef {
  id: string;
  type: ModuleType;
  nameKey: "modMotion" | "modUltrasonic" | "modLaser" | "modRfid";
  modelKey: "modelMotion" | "modelUltrasonic" | "modelLaser" | "modelRfid";
}

/**
 * Module registry — matches the backend device codes.
 *   M01 = Motion (RCWL-0516) · U01 = Ultrasonic (HC-SR04)
 *   S01 = Laser tripwire     · R01 = RFID (RC522)
 */
export const MODULE_REGISTRY: ModuleDef[] = [
  { id: "M01", type: "motion", nameKey: "modMotion", modelKey: "modelMotion" },
  { id: "U01", type: "ultrasonic", nameKey: "modUltrasonic", modelKey: "modelUltrasonic" },
  { id: "S01", type: "laser", nameKey: "modLaser", modelKey: "modelLaser" },
  { id: "R01", type: "rfid", nameKey: "modRfid", modelKey: "modelRfid" },
];

export function findModuleDef(id: string | undefined): ModuleDef | undefined {
  if (!id) return undefined;
  return MODULE_REGISTRY.find((m) => m.id.toLowerCase() === String(id).toLowerCase());
}
