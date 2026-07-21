/**
 * DiaPastash — Core domain types (Backend/Presentation client edition).
 * The browser talks ONLY to the secure backend over HTTPS + Socket.IO.
 * No MQTT, no broker, no credentials live in these types.
 */
import type { Lang } from "./i18n/translations";

/* ---- System level ---- */
export type SystemState = "armed" | "disarmed" | "alarm" | "white" | "unknown";

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

/* ---- Connection settings (UI-level, persisted in localStorage) ---- */

/** MQTT topic map — editable in Settings, prepared to be sent to backend later.
 *  The frontend never connects to MQTT directly; these are configuration only. */
export interface MqttTopics {
  cmdArm: string;
  cmdDisarm: string;
  cmdSilence: string;
  state: string;
  eventAlarm: string;
  eventSensor: string;
  eventRfid: string;
  eventSystem: string;
}

/** Connection configuration. `backendUrl` drives BOTH REST and Socket.IO. */
export interface ConnectionConfig {
  /** Backend base URL (origin or full /api/v1 path). Drives REST + Socket.IO. */
  backendUrl: string;
  /** MQTT broker URL — UI config only, never used by the frontend directly. */
  brokerUrl: string;
  /** MQTT broker port — UI config only. */
  brokerPort: string;
  /** MQTT topic map — UI config only. */
  topics: MqttTopics;
}

/** Backend MQTT settings payload (GET/POST /settings/mqtt).
 *  The backend is the source of truth for the broker URL + topics. */
export interface MqttSettingsPayload {
  brokerUrl: string;
  topics: MqttTopics;
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
