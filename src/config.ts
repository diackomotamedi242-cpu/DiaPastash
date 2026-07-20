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

export const STORAGE_KEYS = {
  settings: "diapastash.settings",
  lang: "diapastash.lang",
  demo: "diapastash.demo", // local UI preview flag only — never a real session
  connection: "diapastash.connection", // backend + MQTT broker/topics config
} as const;

import type { Accent, ConnectionConfig, MqttTopics, ModuleType, Settings } from "./types";

/** User-preference defaults (NO backend secrets here). */
export function defaultSettings(): Settings {
  return {
    appIconUrl: "",
    themeAccent: "green",
    notifications: false,
  };
}

/* ===========================================================================
   Connection configuration (Backend + MQTT broker/topics).
   - The backend URL is used DYNAMICALLY for REST + Socket.IO after save.
   - The MQTT broker/topics are UI-level editable settings stored in
     localStorage and prepared to be sent to the backend later. The frontend
     NEVER connects to MQTT directly (no mqtt.js).
   =========================================================================== */

/** Compile-time default backend origin. Editable from Settings afterwards. */
export const DEFAULT_BACKEND_URL = "https://diapastash-backend.onrender.com";

/** Topic defaults (match the original project's MQTT topic scheme). */
export function defaultTopics(): MqttTopics {
  return {
    cmdArm: "security/cmd/arm",
    cmdDisarm: "security/cmd/disarm",
    cmdSilence: "security/cmd/silence",
    state: "security/state",
    eventAlarm: "security/events/alarm",
    eventSensor: "security/events/sensor",
    eventRfid: "security/events/rfid",
    eventSystem: "security/events/system",
  };
}

/** Default connection config (used when nothing is stored in localStorage). */
export function defaultConnectionConfig(): ConnectionConfig {
  return {
    backendUrl: DEFAULT_BACKEND_URL,
    brokerUrl: "broker.hivemq.com",
    brokerPort: "8884",
    topics: defaultTopics(),
  };
}

/** Normalize a user-entered backend URL into a REST base ending in /api/v1. */
export function deriveApiBase(backendUrl: string): string {
  const u = (backendUrl || "").trim().replace(/\/+$/, "");
  if (!u) return `${DEFAULT_BACKEND_URL}/api/v1`;
  return /\/api\/v\d+$/i.test(u) ? u : `${u}/api/v1`;
}

/** Normalize a user-entered backend URL into a Socket.IO origin. */
export function deriveSocketUrl(backendUrl: string): string {
  const u = (backendUrl || "").trim().replace(/\/+$/, "");
  if (!u) return DEFAULT_BACKEND_URL;
  return u.replace(/\/api\/v\d+$/i, "");
}

/** Read + merge the stored connection config with the defaults. */
export function loadConnectionConfig(): ConnectionConfig {
  const base = defaultConnectionConfig();
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.connection);
    if (!raw) return base;
    const parsed = JSON.parse(raw) as Partial<ConnectionConfig>;
    return {
      ...base,
      ...parsed,
      topics: { ...base.topics, ...(parsed.topics ?? {}) },
    };
  } catch {
    return base;
  }
}

/** Persist the connection config. */
export function saveConnectionConfig(cfg: ConnectionConfig): void {
  try {
    localStorage.setItem(STORAGE_KEYS.connection, JSON.stringify(cfg));
  } catch {
    /* ignore quota / serialization errors */
  }
}

/** Active REST API base (derived from the stored backend URL, read fresh). */
export function getActiveApiBase(): string {
  return deriveApiBase(loadConnectionConfig().backendUrl);
}

/** Active Socket.IO origin (derived from the stored backend URL, read fresh). */
export function getActiveSocketUrl(): string {
  return deriveSocketUrl(loadConnectionConfig().backendUrl);
}

/** Backward-compatible aliases for the currently active endpoints. */
export const API_BASE_URL = getActiveApiBase();
export const SOCKET_URL = getActiveSocketUrl();

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
