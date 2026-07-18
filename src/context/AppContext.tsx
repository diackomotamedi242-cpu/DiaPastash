/**
 * AppContext — the StateManager + wiring layer.
 * ---------------------------------------------------------------------------
 * Holds every piece of application state (auth, settings, language, MQTT
 * status, system state, modules, event log) and bridges the headless
 * MqttService to React. Parsing of inbound device JSON into module/log state
 * lives here so the UI stays declarative.
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
import { mqttService } from "../services/MqttService";
import {
  AUTH,
  MODULE_REGISTRY,
  STORAGE_KEYS,
  buildBrokerUrl,
  defaultSettings,
  findModuleDef,
} from "../config";
import { translations, type Lang, type TranslationKey } from "../i18n/translations";
import { applyAppIcon } from "../pwa";
import type {
  DeviceEvent,
  LogEntry,
  ModuleState,
  MqttStatus,
  Settings,
  Severity,
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

/** Random RFID-style UID for demo events. */
function randUid(): string {
  const b = () => Math.floor(Math.random() * 256).toString(16).padStart(2, "0").toUpperCase();
  return `${b()}:${b()}:${b()}:${b()}`;
}

function loadJSON<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? ({ ...fallback, ...JSON.parse(raw) } as T) : fallback;
  } catch {
    return fallback;
  }
}

/** Map any severity-ish string (or event name) to our 4 buckets. */
export function normalizeSeverity(sev?: string, event?: string): Severity {
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

function normalizeSystemState(v?: string): SystemState {
  const s = String(v ?? "").toLowerCase();
  if (s.includes("disarm")) return "disarmed";
  if (s.includes("alarm") || s.includes("trigger")) return "alarm";
  if (s.includes("arm")) return "armed";
  return "unknown";
}

function computeValue(type: ModuleState["type"], evt: DeviceEvent): string | undefined {
  switch (type) {
    case "ultrasonic":
      return evt.distance != null ? String(evt.distance) : evt.payload || undefined;
    case "rfid":
      return evt.uid || evt.payload || undefined;
    default:
      return evt.payload || undefined;
  }
}

function buildSummary(evt: DeviceEvent, topic: string): string {
  const head = evt.event || evt.state || topic.split("/").pop() || "message";
  return evt.module ? `[${evt.module}] ${head}` : head;
}

/* ---------------------------------------------------------------- context */

interface AppContextValue {
  // i18n
  lang: Lang;
  dir: "rtl" | "ltr";
  setLang: (l: Lang) => void;
  toggleLang: () => void;
  t: (key: TranslationKey) => string;

  // auth
  authed: boolean;
  login: (u: string, p: string) => boolean;
  logout: () => void;

  // settings
  settings: Settings;
  saveSettings: (s: Settings) => void;
  resetSettings: () => void;

  // mqtt
  mqttStatus: MqttStatus;
  lastError: string;
  connect: () => void;
  disconnect: () => void;

  // domain state
  systemState: SystemState;
  modules: ModuleState[];
  logs: LogEntry[];
  traces: TraceEntry[];
  traceStats: { tx: number; rx: number; bytes: number };
  sendCommand: (cmd: "arm" | "disarm" | "silence") => boolean;
  injectTestEvent: () => void;
  clearLogs: () => void;
  clearTraces: () => void;
}

const AppContext = createContext<AppContextValue | null>(null);

/* ---------------------------------------------------------------- provider */

export function AppProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(() => {
    const stored = localStorage.getItem(STORAGE_KEYS.lang) as Lang | null;
    return stored === "en" || stored === "fa" ? stored : "fa";
  });

  const [settings, setSettings] = useState<Settings>(() => {
    const loaded = loadJSON<Settings>(STORAGE_KEYS.settings, defaultSettings());
    // ensure topic shape is complete (forward-compat)
    return { ...defaultSettings(), ...loaded, topics: { ...defaultSettings().topics, ...loaded.topics } };
  });

  const [authed, setAuthed] = useState<boolean>(
    () => localStorage.getItem(STORAGE_KEYS.auth) === "1",
  );

  const [mqttStatus, setMqttStatus] = useState<MqttStatus>("disconnected");
  const [lastError, setLastError] = useState("");

  const [systemState, setSystemState] = useState<SystemState>("unknown");
  const [modulesMap, setModulesMap] = useState<Record<string, ModuleState>>(() => {
    const init: Record<string, ModuleState> = {};
    for (const m of MODULE_REGISTRY) {
      init[m.id] = { id: m.id, type: m.type, severity: "info" };
    }
    return init;
  });
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [traces, setTraces] = useState<TraceEntry[]>([]);

  const pushTrace = useCallback((dir: TraceDir, kind: string, data?: Partial<TraceEntry>) => {
    setTraces((prev) => {
      const entry: TraceEntry = { id: uid(), ts: Date.now(), dir, kind, ...data };
      const next = [...prev, entry];
      return next.length > 300 ? next.slice(next.length - 300) : next;
    });
  }, []);

  // Keep a live ref so the (once-bound) MQTT handler always reads fresh settings.
  const settingsRef = useRef(settings);
  useEffect(() => {
    settingsRef.current = settings;
  }, [settings]);

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
  const toggleLang = useCallback(
    () => setLangState((p) => (p === "fa" ? "en" : "fa")),
    [],
  );

  /* keep the PWA icon / favicon in sync with the configured app icon */
  useEffect(() => {
    applyAppIcon(settings.appIconUrl);
  }, [settings.appIconUrl]);

  /* ---- inbound parsing (StateManager logic) ---- */
  const handleIncoming = useCallback((topic: string, raw: string) => {
    const topics = settingsRef.current.topics;
    let evt: DeviceEvent;
    try {
      evt = JSON.parse(raw) as DeviceEvent;
    } catch {
      evt = { event: raw, payload: raw };
    }

    let severity = normalizeSeverity(
      typeof evt.severity === "string" ? evt.severity : undefined,
      evt.event,
    );

    if (topic === topics.state) {
      const st = typeof evt.state === "string" ? evt.state : raw;
      setSystemState(normalizeSystemState(st));
      severity = "info";
    } else if (topic === topics.alarm) {
      severity = severity === "info" ? "alarm" : severity;
      if (severity === "alarm") setSystemState("alarm");
      applyModule(evt, severity);
    } else if (topic === topics.sensor) {
      applyModule(evt, severity);
    } else if (topic === topics.rfid) {
      applyModule(evt, severity === "info" ? "ok" : severity);
    }
    // topics.system & unknown → logged only

    pushLog({ topic, evt, severity });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function applyModule(evt: DeviceEvent, severity: Severity) {
    const def = findModuleDef(evt.module as string);
    if (!def) return; // unknown module — still logged, no card
    const value = computeValue(def.type, evt);
    setModulesMap((prev) => ({
      ...prev,
      [def.id]: {
        id: def.id,
        type: def.type,
        severity,
        value,
        event: evt.event,
        updatedAt: Date.now(),
      },
    }));
  }

  function pushLog(args: {
    topic: string;
    evt: DeviceEvent;
    severity: Severity;
    outbound?: boolean;
    summary?: string;
  }) {
    const { topic, evt, severity, outbound, summary } = args;
    setLogs((prev) =>
      [
        {
          id: uid(),
          timestamp: Date.now(),
          topic,
          event: evt,
          severity,
          outbound,
          summary: summary ?? buildSummary(evt, topic),
        },
        ...prev,
      ].slice(0, 250),
    );
  }

  /* ---- MQTT wiring (bind once) ---- */
  useEffect(() => {
    mqttService.onStatus = (status, detail) => {
      setMqttStatus(status);
      if (status === "error") setLastError(detail || "connection error");
    };
    mqttService.onMessage = (topic, payload) => handleIncoming(topic, payload);
    mqttService.onTrace = (entry) => setTraces((prev) => (prev.length > 300 ? [...prev.slice(-299), entry] : [...prev, entry]));
    return () => {
      mqttService.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const subscriptionTopics = useCallback((s: Settings) => {
    const ts = s.topics;
    return [ts.state, ts.alarm, ts.sensor, ts.rfid, ts.system].filter(Boolean);
  }, []);

  const connect = useCallback(() => {
    const s = settingsRef.current;
    mqttService.connect(buildBrokerUrl(s), subscriptionTopics(s));
  }, [subscriptionTopics]);

  const disconnect = useCallback(() => mqttService.disconnect(), []);

  /* auto-(re)connect after login */
  useEffect(() => {
    if (authed) connect();
    else mqttService.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authed]);

  /* ---- commands ---- */
  const sendCommand = useCallback((cmd: "arm" | "disarm" | "silence") => {
    const s = settingsRef.current;
    const topic =
      cmd === "arm" ? s.topics.cmdArm : cmd === "disarm" ? s.topics.cmdDisarm : s.topics.cmdSilence;
    const ok = mqttService.publish(topic, "");
    if (ok) {
      if (cmd === "arm") setSystemState("armed");
      else if (cmd === "disarm") setSystemState("disarmed");
      else setSystemState((prev) => (prev === "alarm" ? "armed" : prev));
      pushLog({
        topic,
        evt: { event: `cmd.${cmd}`, severity: "info", payload: "" },
        severity: "info",
        outbound: true,
        summary: `→ cmd/${cmd}`,
      });
    } else {
      // Offline: still reflect intent in the UI + tracer so the panel is demonstrable.
      pushTrace("tx", "PUBLISH", { topic, payload: "", detail: "offline intent" });
      pushLog({
        topic,
        evt: { event: `cmd.${cmd}`, severity: "info", payload: "" },
        severity: "info",
        outbound: true,
        summary: `→ cmd/${cmd} (offline)`,
      });
    }
    return ok;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ---- settings persistence ---- */
  const saveSettings = useCallback(
    (next: Settings) => {
      setSettings(next);
      localStorage.setItem(STORAGE_KEYS.settings, JSON.stringify(next));
      // reconnect with the new broker/topics immediately
      mqttService.connect(buildBrokerUrl(next), subscriptionTopics(next));
    },
    [subscriptionTopics],
  );

  const resetSettings = useCallback(() => {
    const fresh = defaultSettings();
    setSettings(fresh);
    localStorage.setItem(STORAGE_KEYS.settings, JSON.stringify(fresh));
    mqttService.connect(buildBrokerUrl(fresh), subscriptionTopics(fresh));
  }, [subscriptionTopics]);

  /* ---- auth ---- */
  const login = useCallback((u: string, p: string) => {
    if (u.trim() === AUTH.username && p === AUTH.password) {
      setAuthed(true);
      localStorage.setItem(STORAGE_KEYS.auth, "1");
      return true;
    }
    return false;
  }, []);

  const logout = useCallback(() => {
    setAuthed(false);
    localStorage.removeItem(STORAGE_KEYS.auth);
    mqttService.disconnect();
  }, []);

  const clearLogs = useCallback(() => setLogs([]), []);

  /* ---- demo / diagnostics: inject a realistic device event ---- */
  const injectTestEvent = useCallback(() => {
    const scenarios: {
      module: string;
      event: string;
      severity: Severity;
      tkey: "alarm" | "sensor" | "rfid";
      distance?: string;
      uid?: string;
    }[] = [
      { module: "S01", event: "LaserBeamBroken", severity: "alarm", tkey: "alarm" },
      { module: "S01", event: "LaserRestored", severity: "ok", tkey: "sensor" },
      { module: "S02", event: "MotionDetected", severity: "alarm", tkey: "alarm" },
      { module: "S02", event: "MotionClear", severity: "ok", tkey: "sensor" },
      { module: "S03", event: "Proximity", severity: "warning", tkey: "sensor", distance: String(15 + Math.floor(Math.random() * 25)) },
      { module: "S03", event: "Proximity", severity: "ok", tkey: "sensor", distance: String(80 + Math.floor(Math.random() * 120)) },
      { module: "S04", event: "CardScanned", severity: "ok", tkey: "rfid", uid: randUid() },
    ];
    const s = scenarios[Math.floor(Math.random() * scenarios.length)];
    const uptime = `${10 + Math.floor(Math.random() * 900)}s`;
    const evt: DeviceEvent = {
      module: s.module,
      event: s.event,
      severity: s.severity,
      payload: s.uid ?? s.distance ?? "",
      uptime,
      distance: s.distance,
      uid: s.uid,
    };
    const topic = settingsRef.current.topics[s.tkey];
    const payload = JSON.stringify(evt);
    if (mqttService.connected) {
      // Echoes back to us (we are subscribed) → real RX trace appears automatically.
      mqttService.publish(topic, payload);
    } else {
      handleIncoming(topic, payload); // offline demo still animates the UI
      pushTrace("rx", "MESSAGE", { topic, payload, detail: "simulated" }); // offline demo trace
    }
  }, [handleIncoming, pushTrace]);

  const modules = useMemo(() => MODULE_REGISTRY.map((m) => modulesMap[m.id]).filter(Boolean), [modulesMap]);

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

  const clearTraces = useCallback(() => setTraces([]), []);

  const value: AppContextValue = {
    lang,
    dir: lang === "fa" ? "rtl" : "ltr",
    setLang,
    toggleLang,
    t,
    authed,
    login,
    logout,
    settings,
    saveSettings,
    resetSettings,
    mqttStatus,
    lastError,
    connect,
    disconnect,
    systemState,
    modules,
    logs,
    traces,
    traceStats,
    sendCommand,
    injectTestEvent,
    clearLogs,
    clearTraces,
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
