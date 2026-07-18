/**
 * DiaPastash — Static configuration
 * Default settings, module registry, credentials & storage keys.
 */
import type { ModuleType, Settings } from "./types";

/** Frontend-only auth credentials (per spec). */
export const AUTH = {
  username: "MohammadDiacko",
  password: "m242mm242m",
} as const;

export const STORAGE_KEYS = {
  auth: "diapastash.auth",
  settings: "diapastash.settings",
  lang: "diapastash.lang",
} as const;

/** Factory for the default topic set. */
export function defaultTopics() {
  return {
    cmdArm: "security/cmd/arm",
    cmdDisarm: "security/cmd/disarm",
    cmdSilence: "security/cmd/silence",
    state: "security/state",
    alarm: "security/events/alarm",
    sensor: "security/events/sensor",
    rfid: "security/events/rfid",
    system: "security/events/system",
  } as Settings["topics"];
}

/** Default MQTT connection (HiveMQ public broker over secure WebSocket). */
export function defaultSettings(): Settings {
  return {
    broker: "broker.hivemq.com",
    port: "8884",
    path: "/mqtt",
    appIconUrl: "",
    topics: defaultTopics(),
  };
}

/**
 * Module registry — maps the ESP32 module codes to display metadata.
 * Easy to extend: add a new entry here and it shows up in the UI.
 */
export interface ModuleDef {
  id: string;
  type: ModuleType;
  nameKey: "modMotion" | "modUltrasonic" | "modLaser" | "modRfid";
  modelKey: "modelMotion" | "modelUltrasonic" | "modelLaser" | "modelRfid";
}

export const MODULE_REGISTRY: ModuleDef[] = [
  { id: "S01", type: "laser", nameKey: "modLaser", modelKey: "modelLaser" },
  { id: "S02", type: "motion", nameKey: "modMotion", modelKey: "modelMotion" },
  { id: "S03", type: "ultrasonic", nameKey: "modUltrasonic", modelKey: "modelUltrasonic" },
  { id: "S04", type: "rfid", nameKey: "modRfid", modelKey: "modelRfid" },
];

/** Look up a module definition by its raw code. */
export function findModuleDef(id: string | undefined): ModuleDef | undefined {
  if (!id) return undefined;
  return MODULE_REGISTRY.find((m) => m.id.toLowerCase() === id.toLowerCase());
}

/** Build the full WSS connection URL from settings. */
export function buildBrokerUrl(s: Settings): string {
  const proto = "wss";
  const path = s.path.startsWith("/") ? s.path : `/${s.path}`;
  return `${proto}://${s.broker}:${s.port}${path}`;
}
