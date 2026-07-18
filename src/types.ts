/**
 * DiaPastash — Core domain types
 * Shared by MqttService, StateManager (context) and UI components.
 */

import type { Lang } from "./i18n/translations";

/* ---- System level ---- */
export type SystemState = "armed" | "disarmed" | "alarm" | "unknown";

/* ---- Per-module severity ---- */
export type Severity = "ok" | "warning" | "alarm" | "info";

export type ModuleType = "motion" | "ultrasonic" | "laser" | "rfid" | "generic";

/** A single sensor module's live snapshot (StateManager unit). */
export interface ModuleState {
  /** Raw code from the ESP32, e.g. "S01" */
  id: string;
  type: ModuleType;
  /** Derived severity used for colour + headline */
  severity: Severity;
  /** Raw value string (distance in cm, RFID UID, ...) */
  value?: string;
  /** Last ESP32 event name, e.g. "LaserBeamBroken" */
  event?: string;
  /** epoch ms of last update */
  updatedAt?: number;
}

/** Inbound JSON payload contract from the ESP32-S3. */
export interface DeviceEvent {
  module?: string;
  event?: string;
  severity?: Severity | string;
  payload?: string;
  uptime?: string;
  state?: SystemState | string;
  distance?: number | string;
  uid?: string;
  [key: string]: unknown;
}

export interface LogEntry {
  id: string;
  timestamp: number;
  topic: string;
  event: DeviceEvent;
  severity: Severity;
  /** True for locally-dispatched outbound commands */
  outbound?: boolean;
  /** Pre-formatted headline shown in the terminal */
  summary: string;
}

/* ---- MQTT connection ---- */
export type MqttStatus =
  | "disconnected"
  | "connecting"
  | "connected"
  | "reconnecting"
  | "error"
  | "closed";

/* ---- Packet tracer (raw protocol I/O log) ---- */
export type TraceDir = "tx" | "rx" | "sys";

export interface TraceEntry {
  id: string;
  ts: number;
  /** tx = outbound (we sent), rx = inbound (we received), sys = lifecycle/system */
  dir: TraceDir;
  /** PUBLISH, MESSAGE, SUBSCRIBE, CONNECT, CONNECTED, RECONNECT, CLOSE, ERROR, DISCONNECT, SIM */
  kind: string;
  topic?: string;
  payload?: string;
  detail?: string;
}

/** All configurable MQTT topics. */
export interface TopicConfig {
  cmdArm: string;
  cmdDisarm: string;
  cmdSilence: string;
  state: string;
  alarm: string;
  sensor: string;
  rfid: string;
  system: string;
}

export interface Settings {
  broker: string;
  port: string;
  path: string;
  appIconUrl: string;
  topics: TopicConfig;
}

export interface AppConfig {
  lang: Lang;
  settings: Settings;
}
