/**
 * AppContext — the StateManager + wiring layer (Backend presentation client).
 * ---------------------------------------------------------------------------
 * • Authentication is delegated ENTIRELY to the backend. This layer never
 *   stores, reads or compares passwords. It only calls /auth/* and trusts the
 *   HttpOnly cookie the backend sets (sent automatically via credentials:include).
 * • Real-time state arrives over Socket.IO (system:state, security:event).
 * • Commands go through POST /system/commands; the UI is updated only after the
 *   backend confirms (no optimistic updates).
 *
 * A clearly-labelled local "Demo / Preview" mode exists ONLY so the UI can be
 * previewed without a live backend. It never performs or bypasses real auth and
 * touches no session. Remove `enterDemo`/DEMO handling for a strict production
 * build if you prefer.
 */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { api, ApiError, setApiTraceSink } from "../services/ApiClient";
import { socketService } from "../services/SocketService";
import { applyAppIcon } from "../pwa";
import {
  ACCENTS,
  MODULE_REGISTRY,
  STORAGE_KEYS,
  defaultSettings,
  deriveSocketUrl,
  findModuleDef,
  loadConnectionConfig,
  saveConnectionConfig as persistConnectionConfig,
} from "../config";
import { translations, type Lang, type TranslationKey } from "../i18n/translations";
import type {
  ConnectionConfig,
  LogEntry,
  ModuleState,
  SecurityEvent,
  Settings,
  Severity,
  SystemSnapshot,
  SystemState,
  TraceDir,
  TraceEntry,
} from "../types";

/* ---------------------------------------------------------------- helpers */

function uid(): string {
  try {
    return crypto.randomUUID();
  } catch {
    return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }
}

function loadJSON<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? ({ ...fallback, ...JSON.parse(raw) } as T) : fallback;
  } catch {
    return fallback;
  }
}

function randUid(): string {
  const b = () => Math.floor(Math.random() * 256).toString(16).padStart(2, "0").toUpperCase();
  return `${b()}:${b()}:${b()}:${b()}`;
}

/** Map any severity-ish string (or event name) to our 4 buckets. */
function normalizeSeverity(sev?: string, event?: string): Severity {
  const s = String(sev ?? "").toLowerCase();
  if (s) {
    if (/alarm|critical|danger|alert/.test(s)) return "alarm";
    if (/warn/.test(s)) return "warning";
    if (/\bok\b|normal|clear|safe|ready/.test(s)) return "ok";
    if (/info/.test(s)) return "info";
  }
  const e = String(event ?? "").toLowerCase();
  if (e) {
    if (/broken|trip|trigger|motion|detect|breach|intrud|alarm|fire|tamper/.test(e)) return "alarm";
    if (/warn|near|low|weak|fault/.test(e)) return "warning";
    if (/clear|safe|ok|normal|reset|ready|online|restored/.test(e)) return "ok";
  }
  return "info";
}

function normalizeSystemState(v?: unknown): SystemState {
  const s = String(v ?? "").toLowerCase();
  if (s.includes("disarm")) return "disarmed";
  if (s.includes("white")) return "white"; // RFID-triggered "white mode"
  if (s.includes("alarm") || s.includes("trigger")) return "alarm";
  if (s.includes("arm")) return "armed";
  return "unknown";
}

function computeValue(type: ModuleState["type"], evt: SecurityEvent): string | undefined {
  switch (type) {
    case "ultrasonic":
      return evt.distance != null ? String(evt.distance) : evt.payload || undefined;
    case "rfid":
      return evt.uid || evt.payload || undefined;
    default:
      return evt.payload || undefined;
  }
}

function buildSummary(evt: SecurityEvent): string {
  const head = evt.event || (evt.module ? "event" : "message");
  return evt.module ? `[${evt.module}] ${head}` : head;
}

/**
 * Extract an emphasis value from a backend module payload.
 *
 * The backend places per-module scalars in `payload` (e.g. U01 distance in cm
 * like "45.50", R01 UID string). We prefer `payload`, then fall back to a
 * number/UID parsed out of the human `message` text. Returns undefined so the
 * plain message is rendered when no scalar is available.
 */
function extractModuleValue(
  type: ModuleState["type"],
  payload?: unknown,
  message?: string,
): string | undefined {
  if (type === "ultrasonic") {
    if (payload != null && String(payload).trim() !== "") return String(payload).trim();
    if (message) {
      const m = /(-?\d+(?:\.\d+)?)/.exec(String(message));
      if (m) return m[1];
    }
    return undefined;
  }
  if (type === "rfid") {
    const p = payload != null ? String(payload).trim() : "";
    if (p) return p;
    const s = message ? String(message).trim() : "";
    if (/^[0-9a-fA-F]{2}([: -]?[0-9a-fA-F]{2}){2,}/.test(s)) return s;
    return undefined;
  }
  return undefined;
}

/** Parse a backend `lastUpdate` (ISO string or epoch ms) into epoch ms. */
function parseTime(v?: string | number): number | undefined {
  if (v == null || v === "") return undefined;
  if (typeof v === "number") return v > 0 ? v : undefined;
  const ms = Date.parse(v);
  return Number.isNaN(ms) ? undefined : ms;
}

/** Threshold below which an ultrasonic reading counts as a distance breach. */
const DISTANCE_BREACH_CM = 100; // 1 meter

/**
 * Ultrasonic (U01): a measured distance BELOW 1 meter is an intrusion and must
 * drive the card to a full ALARM (red) state — even if the backend reported a
 * softer "warning"/"normal" status. Returns `base` for non-ultrasonic modules
 * or when no reading / a far reading is available.
 */
function resolveSeverity(
  type: ModuleState["type"],
  payload: unknown,
  distance: unknown,
  base: Severity,
): Severity {
  if (type !== "ultrasonic") return base;
  const src =
    distance != null && String(distance).trim() !== ""
      ? String(distance)
      : payload != null
        ? String(payload)
        : "";
  const cm = parseFloat(src);
  if (!Number.isNaN(cm) && cm < DISTANCE_BREACH_CM) return "alarm";
  return base;
}

function initialModules(): Record<string, ModuleState> {
  const init: Record<string, ModuleState> = {};
  for (const m of MODULE_REGISTRY) init[m.id] = { id: m.id, type: m.type, severity: "info" };
  return init;
}

/** Sample module snapshot used only in local Demo/Preview mode (never real data). */
function demoModules(): Record<string, ModuleState> {
  const now = Date.now();
  return {
    M01: { id: "M01", type: "motion", severity: "ok", message: "Idle · no motion", updatedAt: now },
    U01: { id: "U01", type: "ultrasonic", severity: "ok", message: "Clear · 118cm", value: "118", updatedAt: now },
    S01: { id: "S01", type: "laser", severity: "ok", message: "Beam intact", updatedAt: now },
    R01: { id: "R01", type: "rfid", severity: "ok", message: "Ready · awaiting card", updatedAt: now },
  };
}

const DEMO_SYSTEM: SystemSnapshot = {
  securityState: "disarmed",
  deviceOnline: true,
  backendOnline: true,
  demo: true,
};

const OFFLINE_SYSTEM: SystemSnapshot = {
  securityState: "unknown",
  deviceOnline: false,
  backendOnline: false,
  demo: false,
};

/* ---------------------------------------------------------------- context */

interface LoginResult {
  ok: boolean;
  error?: TranslationKey;
}

interface AppContextValue {
  // i18n
  lang: Lang;
  dir: "rtl" | "ltr";
  setLang: (l: Lang) => void;
  toggleLang: () => void;
  t: (key: TranslationKey) => string;

  // auth (backend-driven)
  authed: boolean;
  authChecking: boolean;
  login: (u: string, p: string) => Promise<LoginResult>;
  logout: () => void;
  enterDemo: () => void;
  demo: boolean;

  // settings (preferences only)
  settings: Settings;
  saveSettings: (s: Settings) => void;

  // connection config (Backend + MQTT broker/topics, UI-level)
  connection: ConnectionConfig;
  saveConnectionConfig: (c: ConnectionConfig) => void;
  reconnectBackend: () => void;

  // system / connection
  system: SystemSnapshot;
  refreshSystemState: () => Promise<void>;

  // domain state
  modules: ModuleState[];
  logs: LogEntry[];
  traces: TraceEntry[];
  traceStats: { tx: number; rx: number; bytes: number };
  pendingCommand: "arm" | "disarm" | "silence" | "white" | null;
  sendCommand: (cmd: "arm" | "disarm" | "silence" | "white") => Promise<void>;
  // POST /system/modules/refresh — asks backend to push fresh module state.
  refreshingModules: boolean;
  refreshModules: () => Promise<boolean>;
  injectDemoEvent: () => void;
  clearLogs: () => void;
  clearTraces: () => void;

  // notifications
  enableNotifications: () => Promise<void>;
  notificationPermission: NotificationPermission | "unsupported";
}

const AppContext = createContext<AppContextValue | null>(null);

/* ---------------------------------------------------------------- provider */

export function AppProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(() => {
    const stored = localStorage.getItem(STORAGE_KEYS.lang) as Lang | null;
    return stored === "en" || stored === "fa" ? stored : "fa";
  });

  const [settings, setSettings] = useState<Settings>(() =>
    loadJSON<Settings>(STORAGE_KEYS.settings, defaultSettings()),
  );
  const [connection, setConnection] = useState<ConnectionConfig>(() => loadConnectionConfig());

  const [authed, setAuthed] = useState(false);
  const [authChecking, setAuthChecking] = useState(true);
  const [demo, setDemo] = useState(false);

  const [system, setSystem] = useState<SystemSnapshot>(OFFLINE_SYSTEM);
  const [modulesMap, setModulesMap] = useState<Record<string, ModuleState>>(initialModules);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [traces, setTraces] = useState<TraceEntry[]>([]);
  const [pendingCommand, setPendingCommand] = useState<"arm" | "disarm" | "silence" | "white" | null>(null);
  const [refreshingModules, setRefreshingModules] = useState(false);
  const [notificationPermission, setNotificationPermission] = useState<NotificationPermission | "unsupported">(
    typeof Notification !== "undefined" ? Notification.permission : "unsupported",
  );

  // Live refs so the once-bound socket handlers always read fresh values.
  const settingsRef = useRef(settings);
  useEffect(() => {
    settingsRef.current = settings;
  }, [settings]);
  const connectionRef = useRef(connection);
  useEffect(() => {
    connectionRef.current = connection;
  }, [connection]);
  const demoRef = useRef(demo);
  useEffect(() => {
    demoRef.current = demo;
  }, [demo]);
  const pendingRef = useRef(pendingCommand);

  const t = useCallback(
    (key: TranslationKey) => translations[lang][key] ?? translations.en[key] ?? key,
    [lang],
  );

  /* ---- language side-effects ---- */
  useEffect(() => {
    document.documentElement.lang = lang;
    document.documentElement.dir = lang === "fa" ? "rtl" : "ltr";
    localStorage.setItem(STORAGE_KEYS.lang, lang);
  }, [lang]);

  const setLang = useCallback((l: Lang) => setLangState(l), []);
  const toggleLang = useCallback(() => setLangState((p) => (p === "fa" ? "en" : "fa")), []);

  /* ---- accent theming (user preference) ---- */
  useEffect(() => {
    const a = ACCENTS.find((x) => x.id === settings.themeAccent) ?? ACCENTS[0];
    document.documentElement.style.setProperty("--accent", a.color);
    document.documentElement.style.setProperty("--accent-rgb", a.rgb);
  }, [settings.themeAccent]);

  /* ---- keep PWA icon / favicon synced to the configured icon ---- */
  useEffect(() => {
    applyAppIcon(settings.appIconUrl);
  }, [settings.appIconUrl]);

  /* ---- tracing (shared by ApiClient + SocketService) ---- */
  const pushTrace = useCallback((dir: TraceDir, kind: string, data?: Partial<TraceEntry>) => {
    setTraces((prev) => {
      const next = [...prev, { id: uid(), ts: Date.now(), dir, kind, ...data }];
      return next.length > 300 ? next.slice(next.length - 300) : next;
    });
  }, []);

  /* ---- domain mutations ---- */
  const pushLog = useCallback((args: {
    topic: string;
    evt: SecurityEvent;
    severity: Severity;
    outbound?: boolean;
    summary?: string;
  }) => {
    const { topic, evt, severity, outbound, summary } = args;
    setLogs((prev) =>
      [
        { id: uid(), timestamp: Date.now(), topic, event: evt, severity, outbound, summary: summary ?? buildSummary(evt) },
        ...prev,
      ].slice(0, 250),
    );
  }, []);

  const applyModule = useCallback((evt: SecurityEvent, severity: Severity) => {
    const def = findModuleDef(evt.module as string);
    if (!def) return; // unknown module — still logged, no card
    const value = computeValue(def.type, evt);
    const message = typeof evt.message === "string" ? evt.message : evt.payload;
    // Promote ultrasonic distance breaches (< 1 m) to a full alarm regardless
    // of the backend-reported severity.
    const finalSeverity = resolveSeverity(def.type, evt.payload, evt.distance, severity);
    setModulesMap((prev) => ({
      ...prev,
      [def.id]: {
        id: def.id,
        type: def.type,
        severity: finalSeverity,
        value,
        message,
        event: evt.event,
        updatedAt: Date.now(),
      },
    }));
  }, []);

  /**
   * `modules:sync` — received right after connecting. Hydrates EVERY module
   * card with the backend's last-known state so the panel is never blank.
   * Entry shape: { "M01": { status, message, payload, lastUpdate }, ... }
   */
  const handleModulesSync = useCallback((data: unknown) => {
    const d = (data ?? {}) as Record<
      string,
      { status?: string; message?: string; payload?: unknown; lastUpdate?: string | number }
    >;
    setModulesMap((prev) => {
      const next = { ...prev };
      const now = Date.now();
      let touched = false;
      for (const m of MODULE_REGISTRY) {
        const entry = d[m.id] ?? d[m.id.toLowerCase()];
        if (!entry) continue;
        touched = true;
        const severity = resolveSeverity(
          m.type,
          entry.payload,
          undefined,
          normalizeSeverity(entry.status, entry.message),
        );
        const value = extractModuleValue(m.type, entry.payload, entry.message);
        next[m.id] = {
          id: m.id,
          type: m.type,
          severity,
          value,
          message: entry.message,
          updatedAt: parseTime(entry.lastUpdate) ?? now,
        };
      }
      return touched ? next : prev;
    });
  }, []);

  /**
   * `module:updated` — real-time per-module status change (live). Updates the
   * single matching card. For U01 the distance (cm) lives in `payload`.
   * Payload: { id, status, message, payload, lastUpdate }
   */
  const handleModuleUpdated = useCallback((data: unknown) => {
    const d = (data ?? {}) as {
      id?: string;
      status?: string;
      message?: string;
      payload?: unknown;
      lastUpdate?: string | number;
    };
    const def = findModuleDef(d.id);
    if (!def) return; // unknown module — nothing to render
    const severity = resolveSeverity(
      def.type,
      d.payload,
      undefined,
      normalizeSeverity(d.status, d.message),
    );
    const value = extractModuleValue(def.type, d.payload, d.message);
    setModulesMap((prev) => ({
      ...prev,
      [def.id]: {
        id: def.id,
        type: def.type,
        severity,
        value,
        message: d.message,
        updatedAt: parseTime(d.lastUpdate) ?? Date.now(),
      },
    }));
  }, []);

  /* ---- inbound socket handlers ---- */
  const handleSystemState = useCallback((data: unknown) => {
    const d = (data ?? {}) as Record<string, unknown>;
    setSystem((prev) => ({
      securityState: normalizeSystemState(d.securityState ?? d.state) || prev.securityState,
      deviceOnline: typeof d.deviceOnline === "boolean" ? d.deviceOnline : prev.deviceOnline,
      backendOnline: true,
      demo: prev.demo,
      lastSync: Date.now(),
    }));
  }, []);

  const handleSecurityEvent = useCallback(
    (data: unknown) => {
      const evt = (data ?? {}) as SecurityEvent;
      const severity = normalizeSeverity(
        typeof evt.severity === "string" ? evt.severity : undefined,
        evt.event,
      );
      applyModule(evt, severity);
      pushLog({ topic: "security:event", evt, severity });
      // Optional desktop notification for alarms.
      if (
        settingsRef.current.notifications &&
        severity === "alarm" &&
        typeof Notification !== "undefined" &&
        Notification.permission === "granted"
      ) {
        try {
          new Notification(`${evt.module ?? "DiaPastash"} · ${evt.event ?? "Alarm"}`);
        } catch {
          /* ignore */
        }
      }
    },
    [applyModule, pushLog],
  );

  /* ---- session probe on first load ---- */
  useEffect(() => {
    let active = true;
    (async () => {
      setAuthChecking(true);
      if (localStorage.getItem(STORAGE_KEYS.demo) === "1") {
        setDemo(true);
        setSystem(DEMO_SYSTEM);
        setModulesMap(demoModules());
        setAuthed(true);
        setAuthChecking(false);
        return;
      }
      try {
        await api.me();
        if (active) setAuthed(true);
      } catch {
        if (active) setAuthed(false);
      } finally {
        if (active) setAuthChecking(false);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  /* ---- wire transports once authenticated (real mode only) ---- */
  useEffect(() => {
    if (!authed || demo) return;

    socketService.onConn = (c) => setSystem((prev) => ({ ...prev, backendOnline: c }));
    socketService.onSystemState = handleSystemState;
    socketService.onModulesSync = handleModulesSync;
    socketService.onModuleUpdated = handleModuleUpdated;
    socketService.onSecurityEvent = handleSecurityEvent;
    socketService.traceSink = pushTrace;
    setApiTraceSink(pushTrace);

    socketService.connect();
    void refreshSystemState();

    return () => {
      socketService.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authed, demo]);

  /* ---- actions ---- */
  const refreshSystemState = useCallback(async () => {
    if (demoRef.current) return;
    try {
      const d = (await api.getSystemState()) as Record<string, unknown>;
      setSystem((prev) => ({
        securityState: normalizeSystemState(d.securityState ?? d.state) || prev.securityState,
        deviceOnline: typeof d.deviceOnline === "boolean" ? d.deviceOnline : prev.deviceOnline,
        backendOnline: true,
        demo: prev.demo,
        lastSync: Date.now(),
      }));
    } catch {
      setSystem((prev) => ({ ...prev, backendOnline: false }));
    }
  }, []);

  /**
   * Force a fresh Socket.IO connection using the (possibly new) backend URL.
   * Tears down the current socket and re-establishes it, then re-fetches
   * system state. Safe to call from Settings after saving a new backend URL.
   */
  const reconnectBackend = useCallback(() => {
    if (demoRef.current) return;
    const url = deriveSocketUrl(connectionRef.current.backendUrl);
    // Re-bind handlers (connect() wipes listeners via disconnect).
    socketService.onConn = (c) => setSystem((prev) => ({ ...prev, backendOnline: c }));
    socketService.onSystemState = handleSystemState;
    socketService.onModulesSync = handleModulesSync;
    socketService.onModuleUpdated = handleModuleUpdated;
    socketService.onSecurityEvent = handleSecurityEvent;
    socketService.traceSink = pushTrace;
    socketService.connect(url);
    void refreshSystemState();
  }, [handleModuleUpdated, handleModulesSync, handleSecurityEvent, handleSystemState, pushTrace, refreshSystemState]);

  /**
   * POST /system/modules/refresh — ask the backend to re-emit fresh module
   * state (modules:sync / module:updated / security:event). We do NOT fake
   * anything here; the UI simply waits for the backend's socket updates.
   * Returns true on success, false on error. No-ops in demo mode.
   */
  const refreshModules = useCallback(async (): Promise<boolean> => {
    if (demoRef.current) {
      // In demo, simulate a refresh by re-seeding sample module data.
      setRefreshingModules(true);
      await new Promise((r) => setTimeout(r, 600));
      setModulesMap(demoModules());
      setRefreshingModules(false);
      return true;
    }
    setRefreshingModules(true);
    try {
      await api.refreshModules();
      return true;
    } catch {
      return false;
    } finally {
      setRefreshingModules(false);
    }
  }, []);

  /** Persist connection config (backend + MQTT broker/topics) to localStorage. */
  const saveConnectionConfig = useCallback((next: ConnectionConfig) => {
    setConnection(next);
    persistConnectionConfig(next);
  }, []);

  const login = useCallback(
    async (username: string, password: string): Promise<LoginResult> => {
      try {
        await api.login(username, password);
        setDemo(false);
        setAuthed(true);
        return { ok: true };
      } catch (e) {
        const status = e instanceof ApiError ? e.status : 0;
        const errorKey: TranslationKey = status === 0 ? "serverUnreachable" : "authError";
        return { ok: false, error: errorKey };
      }
    },
    [],
  );

  const logout = useCallback(async () => {
    if (!demoRef.current) {
      try {
        await api.logout();
      } catch {
        /* best-effort */
      }
    }
    localStorage.removeItem(STORAGE_KEYS.demo);
    setDemo(false);
    setAuthed(false);
    socketService.disconnect();
    setSystem(OFFLINE_SYSTEM);
    setModulesMap(initialModules());
    setLogs([]);
  }, []);

  const enterDemo = useCallback(() => {
    localStorage.setItem(STORAGE_KEYS.demo, "1");
    setDemo(true);
    setSystem(DEMO_SYSTEM);
    setModulesMap(demoModules());
    setAuthed(true);
  }, []);

  const sendCommand = useCallback(
    async (cmd: "arm" | "disarm" | "silence" | "white") => {
      if (pendingRef.current) return;
      pendingRef.current = cmd;
      setPendingCommand(cmd);

      // Demo / preview path — simulate a backend confirmation locally.
      if (demoRef.current) {
        await new Promise((r) => setTimeout(r, 700));
        const demoState =
          cmd === "arm" ? "armed" : cmd === "white" ? "white" : "disarmed";
        setSystem((prev) => ({
          ...prev,
          securityState: demoState,
          lastSync: Date.now(),
        }));
        pushTrace("sys", "CMD_CONFIRM", { detail: `demo ${cmd}` });
        pendingRef.current = null;
        setPendingCommand(null);
        return;
      }

      // Real path — wait for the backend to confirm, then refresh state.
      try {
        await api.sendCommand(cmd);
        await refreshSystemState();
        pushTrace("sys", "CMD_CONFIRM", { detail: cmd });
      } catch (e) {
        pushTrace("sys", "CMD_ERROR", { detail: e instanceof Error ? e.message : "error" });
      } finally {
        pendingRef.current = null;
        setPendingCommand(null);
      }
    },
    [pushTrace, refreshSystemState],
  );

  const injectDemoEvent = useCallback(() => {
    // Ultrasonic (U01) demos the live `module:updated` channel — distance in `payload`.
    if (Math.random() < 0.45) {
      const u = [
        { status: "warning", message: "DistanceBreached", payload: String(15 + Math.floor(Math.random() * 25)) },
        { status: "normal", message: "Clear", payload: String(80 + Math.floor(Math.random() * 120)) },
        { status: "normal", message: "Clear", payload: "" }, // nothing in range → "No target"
        { status: "alarm", message: "IntrusionProximity", payload: String(2 + Math.floor(Math.random() * 8)) },
      ][Math.floor(Math.random() * 4)];
      const data = { id: "U01", status: u.status, message: u.message, payload: u.payload, lastUpdate: new Date().toISOString() };
      pushTrace("rx", "module:updated", { payload: JSON.stringify(data), detail: "simulated" });
      handleModuleUpdated(data);
      return;
    }

    // Other modules demo the `security:event` channel (also updates the card).
    const scenarios: { module: string; event: string; severity: Severity; uid?: string }[] = [
      { module: "S01", event: "LaserBeamBroken", severity: "alarm" },
      { module: "S01", event: "LaserRestored", severity: "ok" },
      { module: "M01", event: "MotionDetected", severity: "alarm" },
      { module: "M01", event: "MotionClear", severity: "ok" },
      { module: "R01", event: "CardScanned", severity: "ok", uid: randUid() },
    ];
    const s = scenarios[Math.floor(Math.random() * scenarios.length)];
    const evt: SecurityEvent = {
      module: s.module,
      event: s.event,
      severity: s.severity,
      payload: s.uid ?? "",
      uptime: `${10 + Math.floor(Math.random() * 900)}s`,
      uid: s.uid,
    };
    pushTrace("rx", "security:event", { payload: JSON.stringify(evt), detail: "simulated" });
    handleSecurityEvent(evt);
  }, [handleModuleUpdated, handleSecurityEvent, pushTrace]);

  const clearLogs = useCallback(() => setLogs([]), []);
  const clearTraces = useCallback(() => setTraces([]), []);

  const enableNotifications = useCallback(async () => {
    if (typeof Notification === "undefined") {
      setNotificationPermission("unsupported");
      return;
    }
    try {
      const perm = await Notification.requestPermission();
      setNotificationPermission(perm);
      setSettings((prev) => {
        const next = { ...prev, notifications: perm === "granted" };
        localStorage.setItem(STORAGE_KEYS.settings, JSON.stringify(next));
        return next;
      });
    } catch {
      /* ignore */
    }
  }, []);

  const saveSettings = useCallback((next: Settings) => {
    setSettings(next);
    localStorage.setItem(STORAGE_KEYS.settings, JSON.stringify(next));
  }, []);

  /* ---- derived ---- */
  const modules = useMemo(
    () => MODULE_REGISTRY.map((m) => modulesMap[m.id]).filter(Boolean),
    [modulesMap],
  );

  const traceStats = useMemo(() => {
    let tx = 0;
    let rx = 0;
    let bytes = 0;
    for (const tr of traces) {
      if (tr.dir === "tx") tx++;
      else if (tr.dir === "rx") rx++;
      bytes += (tr.payload?.length ?? 0) + (tr.topic?.length ?? 0) + (tr.detail?.length ?? 0);
    }
    return { tx, rx, bytes };
  }, [traces]);

  const value: AppContextValue = {
    lang,
    dir: lang === "fa" ? "rtl" : "ltr",
    setLang,
    toggleLang,
    t,
    authed,
    authChecking,
    login,
    logout,
    enterDemo,
    demo,
    settings,
    saveSettings,
    connection,
    saveConnectionConfig,
    reconnectBackend,
    system,
    refreshSystemState,
    modules,
    logs,
    traces,
    traceStats,
    pendingCommand,
    sendCommand,
    refreshingModules,
    refreshModules,
    injectDemoEvent,
    clearLogs,
    clearTraces,
    enableNotifications,
    notificationPermission,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

/* ---------------------------------------------------------------- hook */

// eslint-disable-next-line react-refresh/only-export-components
export function useApp(): AppContextValue {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be used within <AppProvider>");
  return ctx;
}
