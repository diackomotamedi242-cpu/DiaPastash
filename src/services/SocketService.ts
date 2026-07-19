/**
 * SocketService — the ONLY real-time transport to the secure backend.
 * ---------------------------------------------------------------------------
 * Connects via Socket.IO to SOCKET_URL with credentials. Listens for the two
 * documented server events and forwards them through callbacks. No MQTT, no
 * direct broker connection, no topic strings.
 *
 * Server → client events:
 *   • system:state    → overall Armed/Disarmed/Alarm + device online
 *   • modules:sync    → last-known state of ALL modules (sent on connect)
 *   • security:event  → a sensor event (logged + drives the Modules panel)
 */
import { io, type Socket } from "socket.io-client";
import { SOCKET_URL } from "../config";
import type { TraceDir, TraceEntry } from "../types";

export type TraceSink = (dir: TraceDir, kind: string, data?: Partial<TraceEntry>) => void;
export type StateHandler = (data: unknown) => void;
export type SyncHandler = (data: unknown) => void;
export type EventHandler = (data: unknown) => void;
export type ConnHandler = (connected: boolean) => void;

class SocketService {
  private socket: Socket | null = null;

  onSystemState?: StateHandler;
  onModulesSync?: SyncHandler;
  onSecurityEvent?: EventHandler;
  onConn?: ConnHandler;
  traceSink?: TraceSink;

  get connected(): boolean {
    return !!this.socket?.connected;
  }

  connect(): void {
    if (this.socket) return;
    this.socket = io(SOCKET_URL, {
      withCredentials: true,
      transports: ["websocket", "polling"],
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 2000,
    });

    this.socket.on("connect", () => {
      this.emitTrace("sys", "SOCKET_CONNECT");
      this.onConn?.(true);
    });
    this.socket.on("disconnect", (reason: unknown) => {
      this.emitTrace("sys", "SOCKET_DISCONNECT", { detail: String(reason) });
      this.onConn?.(false);
    });
    this.socket.on("connect_error", (err: { message?: string }) => {
      this.emitTrace("sys", "SOCKET_ERROR", { detail: err?.message ?? "connect_error" });
      this.onConn?.(false);
    });
    this.socket.on("system:state", (d: unknown) => {
      this.emitTrace("rx", "system:state", { payload: safe(d) });
      this.onSystemState?.(d);
    });
    this.socket.on("modules:sync", (d: unknown) => {
      this.emitTrace("rx", "modules:sync", { payload: safe(d) });
      this.onModulesSync?.(d);
    });
    this.socket.on("security:event", (d: unknown) => {
      this.emitTrace("rx", "security:event", { payload: safe(d) });
      this.onSecurityEvent?.(d);
    });
  }

  disconnect(): void {
    try {
      this.socket?.removeAllListeners();
      this.socket?.disconnect();
    } catch {
      /* ignore */
    }
    this.socket = null;
  }

  private emitTrace(dir: TraceDir, kind: string, data?: Partial<TraceEntry>): void {
    this.traceSink?.(dir, kind, data);
  }
}

function safe(d: unknown): string {
  try {
    return typeof d === "string" ? d : JSON.stringify(d);
  } catch {
    return String(d);
  }
}

/** Shared singleton — one Socket.IO connection for the whole app. */
export const socketService = new SocketService();
