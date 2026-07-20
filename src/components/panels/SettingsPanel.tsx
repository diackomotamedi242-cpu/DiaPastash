import { useEffect, useRef, useState } from "react";
import { useApp } from "../../context/AppContext";
import { PanelHeader } from "../PanelHeader";
import { ConnectionPill } from "../ConnectionPill";
import { InstallModal } from "../InstallModal";
import { useInstallPrompt } from "../../hooks/useInstallPrompt";
import {
  ACCENTS,
  defaultSettings,
  defaultConnectionConfig,
  deriveApiBase,
  deriveSocketUrl,
} from "../../config";
import { fileToResizedDataUrl, fmtBytes } from "../../utils/image";
import { cn } from "../../utils/cn";
import type { Accent, ConnectionConfig, MqttTopics, Settings } from "../../types";
import { IconBell, IconImage, IconPlug, IconRefresh, IconSave, IconSettings, IconShield, IconTrash, IconUpload } from "../Icons";

export function SettingsPanel() {
  const {
    t,
    settings,
    saveSettings,
    connection,
    saveConnectionConfig,
    reconnectBackend,
    lang,
    setLang,
    notificationPermission,
    enableNotifications,
  } = useApp();
  const { canInstall, installed } = useInstallPrompt();
  const [draft, setDraft] = useState<Settings>(settings);
  const [connDraft, setConnDraft] = useState<ConnectionConfig>(connection);
  const [toast, setToast] = useState<string | null>(null);
  const [toastErr, setToastErr] = useState(false);
  const [installOpen, setInstallOpen] = useState(false);
  const [iconBusy, setIconBusy] = useState(false);
  const [iconErr, setIconErr] = useState(false);
  const [reconnecting, setReconnecting] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => setDraft(settings), [settings]);
  useEffect(() => setConnDraft(connection), [connection]);

  const notify = (msg: string, err = false) => {
    setToast(msg);
    setToastErr(err);
    window.setTimeout(() => setToast(null), 1800);
  };

  const patch = (p: Partial<Settings>) => setDraft((d) => ({ ...d, ...p }));
  const patchConn = (p: Partial<ConnectionConfig>) => setConnDraft((d) => ({ ...d, ...p }));
  const patchTopic = (k: keyof MqttTopics, v: string) =>
    setConnDraft((d) => ({ ...d, topics: { ...d.topics, [k]: v } }));

  const handleSaveConnection = () => {
    saveConnectionConfig(connDraft);
    notify(t("connectionSaved"));
  };

  const handleReconnect = () => {
    saveConnectionConfig(connDraft); // ensure the new URL is active first
    setReconnecting(true);
    reconnectBackend();
    notify(t("reconnectingBackend"));
    window.setTimeout(() => setReconnecting(false), 1500);
  };

  // Active derived endpoints (read-only summary of the drafted backend URL).
  const activeApi = deriveApiBase(connDraft.backendUrl);
  const activeSocket = deriveSocketUrl(connDraft.backendUrl);

  const topicFields: { k: keyof MqttTopics; label: string }[] = [
    { k: "cmdArm", label: t("topicCmdArm") },
    { k: "cmdDisarm", label: t("topicCmdDisarm") },
    { k: "cmdSilence", label: t("topicCmdSilence") },
    { k: "state", label: t("topicState") },
    { k: "eventAlarm", label: t("topicEventAlarm") },
    { k: "eventSensor", label: t("topicEventSensor") },
    { k: "eventRfid", label: t("topicEventRfid") },
    { k: "eventSystem", label: t("topicEventSystem") },
  ];

  const handleIconUpload = async (file?: File | null) => {
    if (!file) return;
    setIconBusy(true);
    setIconErr(false);
    try {
      const { dataUrl, bytes } = await fileToResizedDataUrl(file, 512);
      setDraft((d) => ({ ...d, appIconUrl: dataUrl }));
      notify(`${t("iconApplied")} · ${fmtBytes(bytes)}`);
    } catch {
      setIconErr(true);
    } finally {
      setIconBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  return (
    <div className="animate-rise pb-2">
      <PanelHeader title={t("settingsTitle")} desc={t("appConfig")} Icon={IconSettings} accent="yellow" />

      {/* Connection status (read-only) */}
      <Section title={t("backendSection")}>
        <div className="mb-3 flex items-center justify-between">
          <ConnectionPill compact />
        </div>
        <ReadonlyRow label={t("apiEndpoint")} value={activeApi} />
        <ReadonlyRow label={t("socketEndpoint")} value={activeSocket} />
      </Section>

      {/* Connection settings (editable): backend + MQTT broker/topics */}
      <Section title={t("connectionSettings")}>
        {/* Backend URL */}
        <Field label={t("backendUrl")}>
          <input
            className="cyber-input"
            dir="ltr"
            value={connDraft.backendUrl}
            onChange={(e) => patchConn({ backendUrl: e.target.value })}
            placeholder="https://your-backend.com"
          />
        </Field>
        <p className="-mt-1 mb-3 font-tech text-[10px] leading-relaxed text-cyan-200/30">
          {t("backendUrlHint")}
        </p>

        {/* MQTT broker (UI-only) */}
        <div className="mb-2 flex items-center gap-2">
          <IconPlug className="h-4 w-4 text-glow-pink" />
          <h4 className="font-display text-xs font-bold uppercase text-glow-pink">{t("brokerConfig")}</h4>
        </div>
        <div className="grid grid-cols-1 gap-2.5">
          <Field label={t("brokerUrl")}>
            <input className="cyber-input !py-1.5 text-xs" dir="ltr" value={connDraft.brokerUrl} onChange={(e) => patchConn({ brokerUrl: e.target.value })} />
          </Field>
          <Field label={t("brokerPort")}>
            <input className="cyber-input !py-1.5 text-xs" dir="ltr" inputMode="numeric" value={connDraft.brokerPort} onChange={(e) => patchConn({ brokerPort: e.target.value })} />
          </Field>
        </div>
        <p className="mb-3 font-tech text-[10px] leading-relaxed text-cyan-200/30">{t("brokerHint")}</p>

        {/* MQTT topics (UI-only) */}
        <h4 className="mb-2 font-display text-xs font-bold uppercase text-glow-pink">{t("mqttTopics")}</h4>
        <div className="space-y-2">
          {topicFields.map((f) => (
            <div key={f.k} className="flex items-center gap-2">
              <span className="w-24 shrink-0 font-tech text-[10px] uppercase tracking-wider text-cyan-200/40">{f.label}</span>
              <input className="cyber-input !py-1.5 text-xs" dir="ltr" value={connDraft.topics[f.k]} onChange={(e) => patchTopic(f.k, e.target.value)} />
            </div>
          ))}
        </div>

        {/* Save + Reconnect */}
        <div className="mt-4 flex gap-2.5">
          <button
            type="button"
            onClick={handleSaveConnection}
            className="flex flex-1 items-center justify-center gap-2 rounded-lg border border-neon-green/60 bg-neon-green/10 py-2.5 font-display text-xs font-bold uppercase text-glow-green shadow-glow-green transition active:scale-[0.98]"
          >
            <IconSave className="h-4 w-4" /> {t("save")}
          </button>
          <button
            type="button"
            onClick={handleReconnect}
            disabled={reconnecting}
            className="flex items-center justify-center gap-2 rounded-lg border border-neon-blue/50 bg-neon-blue/10 px-4 py-2.5 font-display text-xs font-bold uppercase text-glow-blue transition active:scale-[0.98] disabled:opacity-60"
          >
            <IconRefresh className={cn("h-4 w-4", reconnecting && "animate-spin")} /> {t("reconnectBackend")}
          </button>
        </div>
        <button
          type="button"
          onClick={() => setConnDraft(defaultConnectionConfig())}
          className="mt-2 w-full text-center font-tech text-[10px] uppercase text-cyan-200/30 transition hover:text-glow-yellow"
        >
          ↺ reset connection defaults
        </button>
      </Section>

      {/* App icon */}
      <Section title={t("customIcon")}>
        <div className="mb-1 font-tech text-[10px] leading-relaxed text-cyan-200/30">{t("appIconHint")}</div>
        <div className="mb-3 flex items-center gap-3">
          <div className="relative flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-neon-green/40 bg-black/50 shadow-glow-green">
            {draft.appIconUrl ? (
              <img src={draft.appIconUrl} alt="app icon" className="h-full w-full object-cover" onError={() => patch({ appIconUrl: "" })} />
            ) : (
              <IconImage className="h-7 w-7 text-cyan-200/30" />
            )}
            {iconBusy && (
              <span className="absolute inset-0 flex items-center justify-center bg-black/60 font-tech text-[9px] text-glow-green">…</span>
            )}
          </div>
          <div className="flex flex-1 flex-col gap-1.5">
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={iconBusy}
              className="flex items-center justify-center gap-1.5 rounded-lg border border-neon-green/50 bg-neon-green/10 py-2 font-display text-xs font-bold uppercase text-glow-green transition active:scale-[0.98] disabled:opacity-60"
            >
              <IconUpload className="h-4 w-4" /> {t("uploadIcon")}
            </button>
            {draft.appIconUrl && (
              <button
                type="button"
                onClick={() => patch({ appIconUrl: "" })}
                className="flex items-center justify-center gap-1.5 rounded-lg border border-white/10 py-1.5 font-tech text-[10px] uppercase text-cyan-200/50 transition hover:border-neon-red/40 hover:text-glow-red"
              >
                <IconTrash className="h-3.5 w-3.5" /> {t("removeIcon")}
              </button>
            )}
          </div>
        </div>
        <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => handleIconUpload(e.target.files?.[0])} />
        {iconErr && (
          <p className="mb-2 rounded-md border border-neon-red/40 bg-neon-red/5 px-2.5 py-1.5 font-tech text-[10px] text-glow-red">
            ⚠ {t("iconError")}
          </p>
        )}
        <div className="mb-1 font-tech text-[10px] uppercase text-cyan-200/30">{t("orUseUrl")}</div>
        <input
          className="cyber-input !py-1.5 text-xs"
          dir="ltr"
          placeholder="https://..."
          value={draft.appIconUrl.startsWith("data:") ? "" : draft.appIconUrl}
          onChange={(e) => patch({ appIconUrl: e.target.value })}
        />
      </Section>

      {/* Theme & accent */}
      <Section title={t("theme")}>
        <div className="grid grid-cols-5 gap-2">
          {ACCENTS.map((a) => {
            const active = draft.themeAccent === a.id;
            return (
              <button
                key={a.id}
                type="button"
                onClick={() => patch({ themeAccent: a.id as Accent })}
                className={cn(
                  "flex flex-col items-center gap-1.5 rounded-lg border py-2 transition",
                  active ? "border-white/40 bg-white/5" : "border-white/10 hover:border-white/20",
                )}
              >
                <span className="h-5 w-5 rounded-full" style={{ background: a.color, boxShadow: `0 0 10px ${a.color}` }} />
                <span className={cn("font-tech text-[8px] uppercase leading-tight", active ? "text-glow-green" : "text-cyan-200/40")}>
                  {t(a.key)}
                </span>
              </button>
            );
          })}
        </div>
      </Section>

      {/* Notifications */}
      <Section title={t("notifications")}>
        <button
          type="button"
          onClick={enableNotifications}
          disabled={notificationPermission === "unsupported" || notificationPermission === "granted"}
          className="flex w-full items-center gap-3 rounded-lg border border-white/10 bg-black/30 p-3 text-start transition hover:border-neon-blue/30 disabled:opacity-60"
        >
          <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-neon-blue/40 bg-black/40">
            <IconBell className="h-5 w-5 text-glow-blue" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="font-tech text-xs text-cyan-100/80">
              {notificationPermission === "granted"
                ? t("notificationsOn")
                : notificationPermission === "unsupported"
                  ? t("notificationsUnsupported")
                  : t("notificationsEnable")}
            </div>
            <div className="font-tech text-[10px] text-cyan-200/30">{t("alarm")}</div>
          </div>
          <span
            className={cn(
              "h-4 w-7 rounded-full p-0.5 transition",
              draft.notifications ? "bg-neon-green/60" : "bg-white/10",
            )}
          >
            <span className={cn("block h-3 w-3 rounded-full bg-white transition", draft.notifications ? "translate-x-3" : "")} />
          </span>
        </button>
      </Section>

      {/* Language */}
      <Section title={t("languageLabel")}>
        <div className="flex overflow-hidden rounded-lg border border-white/10">
          {(["fa", "en"] as const).map((l) => (
            <button
              key={l}
              type="button"
              onClick={() => setLang(l)}
              className={cn(
                "flex-1 py-2 font-display text-sm font-semibold transition",
                lang === l ? "bg-neon-green/15 text-glow-green" : "text-cyan-200/40 hover:text-cyan-200/70",
              )}
            >
              {l === "fa" ? "فارسی" : "ENGLISH"}
            </button>
          ))}
        </div>
      </Section>

      {/* Web App / PWA */}
      <Section title={t("webAppSection")}>
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-neon-green/40 bg-black/40 shadow-glow-green">
            <IconShield className="h-6 w-6 text-glow-green" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="font-tech text-[11px] leading-relaxed text-cyan-200/50">{t("webAppDesc")}</p>
            <div className="mt-1.5">
              {installed ? (
                <span className="font-tech text-[10px] uppercase text-glow-green">✓ {t("installedBadge")}</span>
              ) : canInstall ? (
                <span className="font-tech text-[10px] uppercase text-glow-blue">● {t("canInstallBadge")}</span>
              ) : (
                <span className="font-tech text-[10px] uppercase text-glow-yellow">○ PWA</span>
              )}
            </div>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setInstallOpen(true)}
          className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg border border-neon-green/50 bg-neon-green/10 py-2.5 font-display text-sm font-bold uppercase text-glow-green shadow-glow-green transition active:scale-[0.98]"
        >
          <IconShield className="h-4 w-4" /> {t("installApp")}
        </button>
      </Section>

      {/* Save / reset */}
      <div className="mt-4 flex gap-2.5">
        <button
          type="button"
          onClick={() => {
            saveSettings(draft);
            notify(t("save"));
          }}
          className="flex flex-1 items-center justify-center gap-2 rounded-lg border border-neon-green/60 bg-neon-green/10 py-3 font-display text-sm font-bold uppercase text-glow-green shadow-glow-green transition active:scale-[0.98]"
        >
          <IconSave className="h-4 w-4" /> {t("save")}
        </button>
        <button
          type="button"
          onClick={() => {
            const fresh = defaultSettings();
            setDraft(fresh);
            saveSettings(fresh);
            notify(t("save"));
          }}
          className="flex items-center justify-center gap-2 rounded-lg border border-white/15 px-4 py-3 font-display text-sm font-bold uppercase text-cyan-200/60 transition hover:text-glow-yellow active:scale-[0.98]"
        >
          <IconRefresh className="h-4 w-4" />
        </button>
      </div>

      <p className="mt-3 text-center font-tech text-[9px] uppercase text-cyan-200/20">{t("poweredBy")}</p>

      {toast && (
        <div className="animate-rise fixed inset-x-0 bottom-24 z-50 flex justify-center px-4">
          <div
            className={cn(
              "glass-strong rounded-full border px-5 py-2 font-tech text-xs shadow-glow-green",
              toastErr ? "border-neon-red/50 text-glow-red shadow-glow-red" : "border-neon-green/50 text-glow-green",
            )}
          >
            {toastErr ? "⚠" : "✓"} {toast}
          </div>
        </div>
      )}

      <InstallModal open={installOpen} onClose={() => setInstallOpen(false)} />
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="glass clip-hud mb-3 rounded-2xl border border-white/10 p-4">
      <h3 className="mb-3 font-display text-sm font-bold uppercase text-glow-yellow">{title}</h3>
      {children}
    </div>
  );
}

function ReadonlyRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="mb-2 last:mb-0">
      <div className="font-tech text-[9px] uppercase text-cyan-200/30">{label}</div>
      <div className="mt-0.5 break-all font-tech text-[11px] text-cyan-200/50" dir="ltr">
        {value}
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block font-tech text-[10px] uppercase tracking-wider text-cyan-200/50">{label}</span>
      {children}
    </label>
  );
}
