/**
 * MqttService
 * ---------------------------------------------------------------------------
 * Single responsibility: broker connection lifecycle, subscriptions, publishing
 * and raw packet tracing. Knows nothing about React or the DOM — it just emits
 * callbacks. This keeps it trivially reusable / testable.
 */
import mqtt from "mqtt";
import type { MqttStatus, TraceDir, TraceEntry } from "../types";

export type MessageHandler = (topic: string, payload: string) => void;
export type StatusHandler = (status: MqttStatus, detail?: string) => void;
export type TraceHandler = (entry: TraceEntry) => void;

type Client = ReturnType<typeof mqtt.connect>;

function traceId(): string {
  try {
    return crypto.randomUUID();
  } catch {
    return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }
}

export class MqttService {
  private client: Client | null = null;
  private subscriptions = new Set<string>();
  private currentUrl = "";

  /** Hooks the UI/state layer attaches to. */
  onMessage?: MessageHandler;
  onStatus?: StatusHandler;
  onTrace?: TraceHandler;

  get connected(): boolean {
    return !!this.client?.connected;
  }

  /** Last url this service attempted to connect to. */
  get url(): string {
    return this.currentUrl;
  }

  /** Emit a raw packet/lifecycle trace (drives the Packet Tracer panel). */
  private trace(dir: TraceDir, kind: string, data?: Partial<TraceEntry>): void {
    this.onTrace?.({ id: traceId(), ts: Date.now(), dir, kind, ...data });
  }

  /** Build the WSS url and open the connection. */
  connect(url: string, topics: string[]): void {
    this.disconnect(true);
    this.currentUrl = url;
    this.setStatus("connecting");
    this.trace("sys", "CONNECT", { detail: url });

    const opts = {
      clean: true,
      keepalive: 30,
      connectTimeout: 8000,
      reconnectPeriod: 3000,
      clientId: `diapastash-web-${Math.random().toString(16).slice(2, 10)}`,
    } as const;

    this.client = mqtt.connect(url, opts as Parameters<typeof mqtt.connect>[1]);

    this.client.on("connect", () => {
      this.setStatus("connected");
      const subs = topics.filter((t) => !!t && typeof t === "string");
      if (subs.length && this.client) {
        this.client.subscribe(subs, { qos: 0 });
        this.subscriptions = new Set(subs);
        this.trace("tx", "SUBSCRIBE", { detail: subs.join(", ") });
      }
      this.trace("sys", "CONNECTED", { detail: `${subs.length} topics` });
    });
    this.client.on("reconnect", () => {
      this.setStatus("reconnecting");
      this.trace("sys", "RECONNECT", { detail: url });
    });
    this.client.on("close", () => {
      this.setStatus("closed");
      this.trace("sys", "CLOSE", {});
    });
    this.client.on("offline", () => {
      this.setStatus("disconnected");
      this.trace("sys", "OFFLINE", {});
    });
    this.client.on("disconnect", () => {
      this.setStatus("disconnected");
      this.trace("sys", "DISCONNECT", {});
    });
    this.client.on("error", (err: Error) => {
      const msg = err?.message ?? "connection error";
      this.setStatus("error", msg);
      this.trace("sys", "ERROR", { detail: msg });
    });
    this.client.on("message", (topic: string, payload: Uint8Array) => {
      const str = payload.toString();
      this.trace("rx", "MESSAGE", { topic, payload: str });
      this.onMessage?.(topic, str);
    });
  }

  /** Publish an outbound command. Returns false if not connected (and traces nothing). */
  publish(topic: string, payload = ""): boolean {
    if (!this.client?.connected) return false;
    this.client.publish(topic, payload, { qos: 0 });
    this.trace("tx", "PUBLISH", { topic, payload });
    return true;
  }

  /** Gracefully (or forcibly) end the session. */
  disconnect(silent = false): void {
    if (this.client) {
      try {
        this.client.end(true);
      } catch {
        /* ignore */
      }
      this.client = null;
    }
    this.subscriptions.clear();
    if (!silent) {
      this.trace("sys", "DISCONNECT", {});
      this.setStatus("disconnected");
    } else {
      this.setStatus("disconnected");
    }
  }

  private setStatus(status: MqttStatus, detail?: string): void {
    this.onStatus?.(status, detail);
  }
}

/** Shared singleton — one broker connection for the whole app. */
export const mqttService = new MqttService();
