import { useEffect, useRef, useState } from "react";
import { useApp } from "../../context/AppContext";
import { PanelHeader } from "../PanelHeader";
import { ConnectionPill } from "../ConnectionPill";
import { InstallModal } from "../InstallModal";
import { useInstallPrompt } from "../../hooks/useInstallPrompt";
import { buildBrokerUrl, defaultSettings } from "../../config";
import { fileToResizedDataUrl, fmtBytes } from "../../utils/image";
import { cn } from "../../utils/cn";
import type { Settings, TopicConfig } from "../../types";
import { IconImage, IconRefresh, IconSave, IconSettings, IconShield, IconTrash, IconUpload } from "../Icons";

export function SettingsPanel() {
  const { t, settings, saveSettings, resetSettings, lang, setLang, connect, disconnect } = useApp();
  const { canInstall, installed } = useInstallPrompt();
  const [draft, setDraft] = useState<Settings>(settings);
  const [toast, setToast] = useState<string | null>(null);
  const [installOpen, setInstallOpen] = useState(false);
  const [iconBusy, setIconBusy] = useState(false);
  const [iconErr, setIconErr] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => setDraft(settings), [settings]);

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

  const notify = (msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast(null), 1600);
  };

  const patch = (p: Partial<Settings>) => setDraft((d) => ({ ...d, ...p }));
  const patchTopic = (k: keyof TopicConfig, v: string) =>
    setDraft((d) => ({ ...d, topics: { ...d.topics, [k]: v } }));

  const connString = buildBrokerUrl(draft);

  const cmdTopics: { k: keyof TopicConfig; label: string }[] = [
    { k: "cmdArm", label: "arm" },
    { k: "cmdDisarm", label: "disarm" },
    { k: "cmdSilence", label: "silence" },
  ];
  const evtTopics: { k: keyof TopicConfig; label: string }[] = [
    { k: "state", label: "state" },
    { k: "alarm", label: "alarm" },
    { k: "sensor", label: "sensor" },
    { k: "rfid", label: "rfid" },
    { k: "system", label: "system" },
  ];

  return (
    <div className="animate-rise pb-2">
      <PanelHeader title={t("settingsTitle")} desc={t("mqttConfig")} Icon={IconSettings} accent="yellow" />

      {/* MQTT connection */}
      <Section title={t("mqttConfig")}>
        <div className="mb-3 flex items-center justify-between">
          <ConnectionPill compact />
          <div className="flex gap-1.5">
            <button
              type="button"
              onClick={connect}
              className="rounded-md border border-neon-green/40 px-2.5 py-1 font-tech text-[10px] uppercase tracking-wider text-glow-green transition hover:bg-neon-green/10"
            >
              {t("connectNow")}
            </button>
            <button
              type="button"
              onClick={disconnect}
              className="rounded-md border border-neon-red/40 px-2.5 py-1 font-tech text-[10px] uppercase tracking-wider text-glow-red transition hover:bg-neon-red/10"
            >
              {t("disconnect")}
            </button>
          </div>
        </div>

        <Field label={t("brokerAddress")}>
          <input className="cyber-input" dir="ltr" value={draft.broker} onChange={(e) => patch({ broker: e.target.value })} />
        </Field>
        <div className="grid grid-cols-2 gap-2.5">
          <Field label={t("brokerPort")}>
            <input className="cyber-input" dir="ltr" inputMode="numeric" value={draft.port} onChange={(e) => patch({ port: e.target.value })} />
          </Field>
          <Field label={t("brokerPath")}>
            <input className="cyber-input" dir="ltr" value={draft.path} onChange={(e) => patch({ path: e.target.value })} />
          </Field>
        </div>
        <div className="mt-2 rounded-lg border border-cyan-500/15 bg-black/40 p-2.5">
          <div className="font-tech text-[9px] uppercase tracking-wider text-cyan-200/40">{t("connString")}</div>
          <div className="mt-0.5 break-all font-tech text-xs text-glow-green" dir="ltr">
            {connString}
          </div>
        </div>
      </Section>

      {/* Topics */}
      <Section title={t("topicsConfig")}>
        <p className="mb-2 font-tech text-[10px] uppercase tracking-wider text-glow-blue">{t("cmdTopics")}</p>
        <div className="space-y-2">
          {cmdTopics.map((c) => (
            <TopicRow key={c.k} label={c.label} value={draft.topics[c.k]} onChange={(v) => patchTopic(c.k, v)} />
          ))}
        </div>
        <p className="mb-2 mt-4 font-tech text-[10px] uppercase tracking-wider text-glow-blue">{t("evtTopics")}</p>
        <div className="space-y-2">
          {evtTopics.map((c) => (
            <TopicRow key={c.k} label={c.label} value={draft.topics[c.k]} onChange={(v) => patchTopic(c.k, v)} />
          ))}
        </div>
      </Section>

      {/* App config */}
      <Section title={t("appConfig")}>
        <div className="mb-1 font-tech text-[11px] uppercase text-cyan-200/60">{t("customIcon")}</div>
        <p className="mb-3 font-tech text-[10px] leading-relaxed text-cyan-200/30">{t("appIconHint")}</p>

        {/* Icon preview + actions */}
        <div className="mb-3 flex items-center gap-3">
          <div className="relative flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-neon-green/40 bg-black/50 shadow-glow-green">
            {draft.appIconUrl ? (
              <img
                src={draft.appIconUrl}
                alt="app icon"
                className="h-full w-full object-cover"
                onError={() => patch({ appIconUrl: "" })}
              />
            ) : (
              <IconImage className="h-7 w-7 text-cyan-200/30" />
            )}
            {iconBusy && (
              <span className="absolute inset-0 flex items-center justify-center bg-black/60 font-tech text-[9px] text-glow-green">
                …
              </span>
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

        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => handleIconUpload(e.target.files?.[0])}
        />

        {iconErr && (
          <p className="mb-2 rounded-md border border-neon-red/40 bg-neon-red/5 px-2.5 py-1.5 font-tech text-[10px] text-glow-red">
            ⚠ {t("iconError")}
          </p>
        )}

        <div className="mb-1 mt-1 font-tech text-[10px] uppercase text-cyan-200/30">{t("orUseUrl")}</div>
        <input
          className="cyber-input !py-1.5 text-xs"
          dir="ltr"
          placeholder="https://..."
          value={draft.appIconUrl.startsWith("data:") ? "" : draft.appIconUrl}
          onChange={(e) => patch({ appIconUrl: e.target.value })}
        />

        <div className="mb-1 mt-5 font-tech text-[11px] uppercase text-cyan-200/60">{t("languageLabel")}</div>
        <div className="flex overflow-hidden rounded-lg border border-white/10">
          {(["fa", "en"] as const).map((l) => (
            <button
              key={l}
              type="button"
              onClick={() => setLang(l)}
              className={cn(
                "flex-1 py-2 font-display text-sm font-semibold tracking-wider transition",
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
                <span className="font-tech text-[10px] uppercase tracking-wider text-glow-green">✓ {t("installedBadge")}</span>
              ) : canInstall ? (
                <span className="font-tech text-[10px] uppercase tracking-wider text-glow-blue">● {t("canInstallBadge")}</span>
              ) : (
                <span className="font-tech text-[10px] uppercase tracking-wider text-glow-yellow">○ PWA</span>
              )}
            </div>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setInstallOpen(true)}
          className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg border border-neon-green/50 bg-neon-green/10 py-2.5 font-display text-sm font-bold uppercase tracking-widest text-glow-green shadow-glow-green transition active:scale-[0.98]"
        >
          <IconShield className="h-4 w-4" /> {t("installApp")}
        </button>
      </Section>

      {/* Actions */}
      <div className="mt-4 flex gap-2.5">
        <button
          type="button"
          onClick={() => {
            saveSettings(draft);
            notify(t("saved"));
          }}
          className="flex flex-1 items-center justify-center gap-2 rounded-lg border border-neon-green/60 bg-neon-green/10 py-3 font-display text-sm font-bold uppercase tracking-widest text-glow-green shadow-glow-green transition active:scale-[0.98]"
        >
          <IconSave className="h-4 w-4" /> {t("save")}
        </button>
        <button
          type="button"
          onClick={() => {
            resetSettings();
            setDraft(defaultSettings());
            notify(t("resetDone"));
          }}
          className="flex items-center justify-center gap-2 rounded-lg border border-white/15 px-4 py-3 font-display text-sm font-bold uppercase tracking-widest text-cyan-200/60 transition hover:text-glow-yellow active:scale-[0.98]"
        >
          <IconRefresh className="h-4 w-4" /> {t("reset")}
        </button>
      </div>

      {toast && (
        <div className="animate-rise fixed inset-x-0 bottom-24 z-50 flex justify-center px-4">
          <div className="glass-strong rounded-full border border-neon-green/50 px-5 py-2 font-tech text-xs text-glow-green shadow-glow-green">
            ✓ {toast}
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
      <h3 className="mb-3 font-display text-sm font-bold uppercase tracking-[0.2em] text-glow-yellow">{title}</h3>
      {children}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="mb-2.5 block">
      <span className="mb-1 block font-tech text-[10px] uppercase tracking-wider text-cyan-200/50">{label}</span>
      {children}
    </label>
  );
}

function TopicRow({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex items-center gap-2">
      <span className="w-16 shrink-0 font-tech text-[10px] uppercase tracking-wider text-cyan-200/40">{label}</span>
      <input className="cyber-input !py-1.5 text-xs" dir="ltr" value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}
