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
  findModuleDef,
} from "../config";
import { translations, type Lang, type TranslationKey } from "../i18n/translations";
import type {
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
 * Best-effort scalar extraction from a backend status string, so distance/UID
 * values get the emphasis styling on the card. Falls back to undefined so the
 * plain message text is shown instead.
 */
function extractValueFromMessage(type: ModuleState["type"], message?: string): string | undefined {
  if (!message) return undefined;
  const s = String(message).trim();
  if (type === "ultrasonic") {
    const m = /(-?\d+(?:\.\d+)?)/.exec(s);
    return m ? m[1] : undefined;
  }
  if (type === "rfid") {
    if (/^[0-9a-fA-F]{2}([: -]?[0-9a-fA-F]{2}){2,}/.test(s)) return s;
  }
  return undefined;
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

  // system / connection
  system: SystemSnapshot;
  refreshSystemState: () => Promise<void>;

  // domain state
  modules: ModuleState[];
  logs: LogEntry[];
  traces: TraceEntry[];
  traceStats: { tx: number; rx: number; bytes: number };
  pendingCommand: "arm" | "disarm" | "silence" | null;
  sendCommand: (cmd: "arm" | "disarm" | "silence") => Promise<void>;
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

  const [authed, setAuthed] = useState(false);
  const [authChecking, setAuthChecking] = useState(true);
  const [demo, setDemo] = useState(false);

  const [system, setSystem] = useState<SystemSnapshot>(OFFLINE_SYSTEM);
  const [modulesMap, setModulesMap] = useState<Record<string, ModuleState>>(initialModules);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [traces, setTraces] = useState<TraceEntry[]>([]);
  const [pendingCommand, setPendingCommand] = useState<"arm" | "disarm" | "silence" | null>(null);
  const [notificationPermission, setNotificationPermission] = useState<NotificationPermission | "unsupported">(
    typeof Notification !== "undefined" ? Notification.permission : "unsupported",
  );

  // Live refs so the once-bound socket handlers always read fresh values.
  const settingsRef = useRef(settings);
  useEffect(() => {
    settingsRef.current = settings;
  }, [settings]);
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
    setModulesMap((prev) => ({
      ...prev,
      [def.id]: {
        id: def.id,
        type: def.type,
        severity,
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
   * Payload shape: { "M01": { status, message }, "U01": {...}, ... }
   */
  const handleModulesSync = useCallback((data: unknown) => {
    const d = (data ?? {}) as Record<string, { status?: string; message?: string }>;
    setModulesMap((prev) => {
      const next = { ...prev };
      const now = Date.now();
      let touched = false;
      for (const m of MODULE_REGISTRY) {
        const entry = d[m.id] ?? d[m.id.toLowerCase()];
        if (!entry) continue;
        touched = true;
        const severity = normalizeSeverity(entry.status, undefined);
        const value = extractValueFromMessage(m.type, entry.message);
        next[m.id] = {
          id: m.id,
          type: m.type,
          severity,
          value,
          message: entry.message,
          updatedAt: now,
        };
      }
      return touched ? next : prev;
    });
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
    async (cmd: "arm" | "disarm" | "silence") => {
      if (pendingRef.current) return;
      pendingRef.current = cmd;
      setPendingCommand(cmd);

      // Demo / preview path — simulate a backend confirmation locally.
      if (demoRef.current) {
        await new Promise((r) => setTimeout(r, 700));
        setSystem((prev) => ({
          ...prev,
          securityState: cmd === "arm" ? "armed" : "disarmed",
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
    const scenarios: {
      module: string;
      event: string;
      severity: Severity;
      distance?: string;
      uid?: string;
    }[] = [
      { module: "S01", event: "LaserBeamBroken", severity: "alarm" },
      { module: "S01", event: "LaserRestored", severity: "ok" },
      { module: "M01", event: "MotionDetected", severity: "alarm" },
      { module: "M01", event: "MotionClear", severity: "ok" },
      { module: "U01", event: "Proximity", severity: "warning", distance: String(15 + Math.floor(Math.random() * 25)) },
      { module: "U01", event: "Proximity", severity: "ok", distance: String(80 + Math.floor(Math.random() * 120)) },
      { module: "R01", event: "CardScanned", severity: "ok", uid: randUid() },
    ];
    const s = scenarios[Math.floor(Math.random() * scenarios.length)];
    const evt: SecurityEvent = {
      module: s.module,
      event: s.event,
      severity: s.severity,
      payload: s.uid ?? s.distance ?? "",
      uptime: `${10 + Math.floor(Math.random() * 900)}s`,
      distance: s.distance,
      uid: s.uid,
    };
    const payload = JSON.stringify(evt);
    pushTrace("rx", "security:event", { payload, detail: "simulated" });
    handleSecurityEvent(evt);
  }, [handleSecurityEvent, pushTrace]);

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
    system,
    refreshSystemState,
    modules,
    logs,
    traces,
    traceStats,
    pendingCommand,
    sendCommand,
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
