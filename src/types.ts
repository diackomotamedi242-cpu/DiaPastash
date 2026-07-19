/**
 * DiaPastash — Core domain types (Backend/Presentation client edition).
 * The browser talks ONLY to the secure backend over HTTPS + Socket.IO.
 * No MQTT, no broker, no credentials live in these types.
 */
import type { Lang } from "./i18n/translations";

/* ---- System level ---- */
export type SystemState = "armed" | "disarmed" | "alarm" | "unknown";

/* ---- Per-module severity ---- */
export type Severity = "ok" | "warning" | "alarm" | "info";

export type ModuleType = "motion" | "ultrasonic" | "laser" | "rfid" | "generic";

/** Brand/accent theming preset (user preference only). */
export type Accent = "green" | "cyan" | "pink" | "yellow" | "red";

/** A single sensor module's live snapshot. */
export interface ModuleState {
  id: string;
  type: ModuleType;
  severity: Severity;
  /** Backend status message (e.g. "Idle", "120cm", a UID) — shown on the card. */
  message?: string;
  /** Derived scalar value (distance in cm / RFID UID) for emphasis display. */
  value?: string;
  event?: string;
  updatedAt?: number;
}

/** Inbound `security:event` payload from the backend (Socket.IO). */
export interface SecurityEvent {
  module?: string; // "M01" | "U01" | "S01" | "R01"
  event?: string;
  severity?: Severity | string;
  payload?: string;
  distance?: number | string;
  uid?: string;
  uptime?: string;
  timestamp?: number;
  [key: string]: unknown;
}

export interface LogEntry {
  id: string;
  timestamp: number;
  topic: string;
  event: SecurityEvent;
  severity: Severity;
  outbound?: boolean;
  summary: string;
}

/** Overall system snapshot derived from `/system/state` + `system:state` socket. */
export interface SystemSnapshot {
  securityState: SystemState;
  deviceOnline: boolean; // ESP32 reported by backend
  backendOnline: boolean; // Socket.IO transport connected
  demo: boolean;
  lastSync?: number;
}

/* ---- Packet tracer (HTTP + Socket.IO I/O log) ---- */
export type TraceDir = "tx" | "rx" | "sys";

export interface TraceEntry {
  id: string;
  ts: number;
  dir: TraceDir;
  kind: string;
  topic?: string;
  payload?: string;
  detail?: string;
}

/* ---- User preferences (no secrets) ---- */
export interface Settings {
  appIconUrl: string;
  themeAccent: Accent;
  notifications: boolean;
}

export interface AppConfig {
  lang: Lang;
  settings: Settings;
}
