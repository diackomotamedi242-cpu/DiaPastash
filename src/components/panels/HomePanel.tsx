import { useState } from "react";
import { useApp } from "../../context/AppContext";
import { PanelHeader } from "../PanelHeader";
import { SEVERITY_STYLES } from "../../utils/severity";
import { useNow, formatRelative } from "../../hooks/useNow";
import { cn } from "../../utils/cn";
import type { SystemState } from "../../types";
import { IconBolt, IconShield, IconWave } from "../Icons";

function systemMeta(state: SystemState) {
  switch (state) {
    case "armed":
      return { accent: "green" as const, labelKey: "armed" as const, Icon: IconShield };
    case "disarmed":
      return { accent: "blue" as const, labelKey: "disarmed" as const, Icon: IconShield };
    case "white":
      // RFID-triggered "white mode" — a calm milky-white neon state (no pulse).
      return { accent: "white" as const, labelKey: "whiteMode" as const, Icon: IconShield };
    case "alarm":
      return { accent: "red" as const, labelKey: "alarm" as const, Icon: IconBolt, pulse: true };
    default:
      return { accent: "yellow" as const, labelKey: "connDisconnected" as const, Icon: IconWave };
  }
}

const ACCENT_MAP = {
  green: { border: "border-neon-green", glow: "shadow-glow-green", text: "text-glow-green", hex: "#39FF14" },
  blue: { border: "border-neon-blue", glow: "shadow-glow-blue", text: "text-glow-blue", hex: "#00FFFF" },
  red: { border: "border-neon-red", glow: "shadow-glow-red", text: "text-glow-red", hex: "#FF003C" },
  yellow: { border: "border-neon-yellow", glow: "shadow-glow-yellow", text: "text-glow-yellow", hex: "#FFFF00" },
  white: { border: "border-neon-white", glow: "shadow-glow-white", text: "text-glow-white", hex: "#F8F8FF" },
};

/**
 * Inline-style theme for the central System Status indicator.
 * Using inline styles (instead of utility classes) GUARANTEES the milky-white
 * "white mode" styling always renders — color, text-shadow, box-shadow and
 * border all update together. The other states use the same neon values they
 * used before, so armed/disarmed/alarm look identical.
 */
const STATE_THEME: Record<
  string,
  { color: string; border: string; shadow: string; textShadow: string; glow: string }
> = {
  green: {
    color: "#39FF14",
    border: "rgba(57,255,20,0.6)",
    shadow: "0 0 8px rgba(57,255,20,0.5), 0 0 22px rgba(57,255,20,0.25), inset 0 0 12px rgba(57,255,20,0.08)",
    textShadow: "0 0 4px rgba(57,255,20,0.9), 0 0 14px rgba(57,255,20,0.45)",
    glow: "57,255,20",
  },
  blue: {
    color: "#00FFFF",
    border: "rgba(0,255,255,0.6)",
    shadow: "0 0 8px rgba(0,255,255,0.5), 0 0 22px rgba(0,255,255,0.25), inset 0 0 12px rgba(0,255,255,0.08)",
    textShadow: "0 0 4px rgba(0,255,255,0.9), 0 0 14px rgba(0,255,255,0.45)",
    glow: "0,255,255",
  },
  red: {
    color: "#FF003C",
    border: "rgba(255,0,60,0.65)",
    shadow: "0 0 8px rgba(255,0,60,0.6), 0 0 24px rgba(255,0,60,0.3), inset 0 0 12px rgba(255,0,60,0.1)",
    textShadow: "0 0 4px rgba(255,0,60,0.9), 0 0 14px rgba(255,0,60,0.5)",
    glow: "255,0,60",
  },
  yellow: {
    color: "#FFFF00",
    border: "rgba(255,255,0,0.6)",
    shadow: "0 0 8px rgba(255,255,0,0.5), 0 0 22px rgba(255,255,0,0.25), inset 0 0 12px rgba(255,255,0,0.08)",
    textShadow: "0 0 4px rgba(255,255,0,0.9), 0 0 14px rgba(255,255,0,0.45)",
    glow: "255,255,0",
  },
  white: {
    // Milky-white neon (AliceWhite-ish) for RFID-triggered White Mode.
    color: "#F8F8FF",
    border: "#F8F8FF",
    shadow: "0 0 10px #F8F8FF, 0 0 24px rgba(224,224,240,0.35), inset 0 0 14px rgba(255,255,255,0.12)",
    textShadow: "0 0 10px #F8F8FF, 0 0 20px #F8F8FF",
    glow: "248,248,255",
  },
};

export function HomePanel() {
  const { t, system, modules, logs, settings, sendCommand, pendingCommand } = useApp();
  const now = useNow(1000);
  const [toast, setToast] = useState<string | null>(null);

  const meta = systemMeta(system.securityState);
  const theme = STATE_THEME[meta.accent] ?? STATE_THEME.yellow;
  const pulse = "pulse" in meta && meta.pulse;

  const activeCount = modules.filter((m) => m.updatedAt).length;
  const triggeredCount = modules.filter((m) => m.severity === "alarm").length;
  const last = logs[0];

  const fire = async (cmd: "arm" | "disarm" | "silence" | "white") => {
    await sendCommand(cmd);
    setToast(t("commandSent"));
    window.setTimeout(() => setToast(null), 1800);
  };

  return (
    <div className="animate-rise">
      <PanelHeader title={t("homeTitle")} desc={t("appTagline")} Icon={IconShield} accent="green" />

      {/* App icon / name */}
      <div className="mb-4 flex justify-center">
        {settings.appIconUrl ? (
          <img
            src={settings.appIconUrl}
            alt="app icon"
            className="h-20 w-20 rounded-2xl border border-neon-green/40 object-cover shadow-glow-green"
            onError={(e) => (e.currentTarget.style.display = "none")}
          />
        ) : (
          <h1 className="font-brand text-xl font-bold text-glow-blue">
            DIA<span className="text-glow-green">PASTASH</span>
          </h1>
        )}
      </div>

      {/* System state HUD — inline-styled so every state (incl. white) renders reliably */}
      <div
        className={cn(
          "glass clip-hud relative mb-3 overflow-hidden rounded-2xl border p-5 text-center",
          pulse && "animate-pulse-glow",
        )}
        style={{ borderColor: theme.border, boxShadow: theme.shadow }}
      >
        <div
          className="pointer-events-none absolute inset-x-0 -top-10 h-24 blur-3xl"
          style={{ background: `rgba(${theme.glow},0.16)` }}
        />
        <p className="relative font-tech text-[10px] uppercase tracking-[0.3em] text-cyan-200/50">
          {t("systemStatus")}
        </p>
        <div className="relative mt-3 flex flex-col items-center">
          <div
            className="flex h-16 w-16 items-center justify-center rounded-full border bg-black/50"
            style={{ borderColor: theme.border }}
          >
            <meta.Icon
              className={cn("h-8 w-8", pulse && "animate-pulse-glow")}
              style={{ color: theme.color, textShadow: theme.textShadow }}
            />
          </div>
          <div
            className="mt-3 font-display text-3xl font-extrabold"
            style={{ color: theme.color, textShadow: theme.textShadow }}
          >
            {t(meta.labelKey)}
          </div>
        </div>
      </div>

      {/* Backend & ESP32 status chips */}
      <div className="mb-4 grid grid-cols-2 gap-2.5">
        <StatusChip label={t("backend")} online={system.backendOnline} />
        <StatusChip label={t("espDevice")} online={system.deviceOnline} />
      </div>

      {/* Action buttons */}
      <div className="mb-4 space-y-2.5">
        <CmdButton
          onClick={() => fire("arm")}
          label={pendingCommand === "arm" ? t("sending") : t("arm")}
          desc={t("armDesc")}
          color="green"
          Icon={IconShield}
          disabled={!!pendingCommand}
        />
        <div className="grid grid-cols-2 gap-2.5">
          <CmdButton
            onClick={() => fire("disarm")}
            label={pendingCommand === "disarm" ? t("sending") : t("disarm")}
            desc={t("disarmDesc")}
            color="blue"
            Icon={IconShield}
            compact
            disabled={!!pendingCommand}
          />
          <CmdButton
            onClick={() => fire("white")}
            label={pendingCommand === "white" ? t("sending") : t("whiteMode")}
            desc={t("whiteDesc")}
            color="white"
            Icon={IconShield}
            compact
            disabled={!!pendingCommand}
          />
        </div>
        <CmdButton
          onClick={() => fire("silence")}
          label={pendingCommand === "silence" ? t("sending") : t("silence")}
          desc={t("silenceDesc")}
          color="red"
          Icon={IconBolt}
          disabled={!!pendingCommand}
        />
      </div>

      {/* Quick stats */}
      <p className="mb-2 font-tech text-[10px] uppercase tracking-[0.3em] text-cyan-200/40">{t("quickStats")}</p>
      <div className="grid grid-cols-3 gap-2.5">
        <StatTile label={t("activeModules")} value={String(activeCount)} color="green" />
        <StatTile label={t("triggeredCount")} value={String(triggeredCount)} color="red" />
        <StatTile label={t("eventsCount")} value={String(logs.length)} color="blue" />
      </div>

      {/* Last event */}
      <div className="glass mt-2.5 rounded-xl border border-white/10 p-3">
        <div className="flex items-center justify-between">
          <span className="font-tech text-[10px] uppercase text-cyan-200/40">{t("lastEvent")}</span>
          <span className="font-tech text-[10px] text-cyan-200/30">
            {last ? formatRelative(last.timestamp, now, t) : "—"}
          </span>
        </div>
        {last ? (
          <div className="mt-1.5 flex items-center gap-2">
            <span className={cn("h-2 w-2 shrink-0 rounded-full", SEVERITY_STYLES[last.severity].dot)} />
            <span className={cn("truncate font-tech text-xs", SEVERITY_STYLES[last.severity].text)} dir="ltr">
              {last.summary}
            </span>
          </div>
        ) : (
          <p className="mt-1.5 font-tech text-xs text-cyan-200/30">{t("noEvents")}</p>
        )}
      </div>

      {/* Toast */}
      {toast && (
        <div className="animate-rise fixed inset-x-0 bottom-24 z-50 flex justify-center px-4">
          <div className="glass-strong rounded-full border border-neon-green/50 px-5 py-2 font-tech text-xs text-glow-green shadow-glow-green">
            ✓ {toast}
          </div>
        </div>
      )}
    </div>
  );
}

function StatusChip({ label, online }: { label: string; online: boolean }) {
  return (
    <div
      className={cn(
        "glass clip-hud flex items-center justify-between rounded-xl border px-3 py-2.5",
        online ? "border-neon-green/40" : "border-neon-red/40",
      )}
    >
      <span className="font-tech text-[10px] uppercase text-cyan-200/50">{label}</span>
      <span className="flex items-center gap-1.5">
        <span className={cn("h-2 w-2 rounded-full", online ? "animate-pulse-glow bg-neon-green" : "bg-neon-red")} />
        <span className={cn("font-tech text-[10px] uppercase", online ? "text-glow-green" : "text-glow-red")}>
          {online ? "" : ""}
        </span>
      </span>
    </div>
  );
}

function CmdButton({
  onClick,
  label,
  desc,
  color,
  Icon,
  compact = false,
  disabled = false,
}: {
  onClick: () => void;
  label: string;
  desc: string;
  color: "green" | "blue" | "red" | "white";
  Icon: (p: { className?: string }) => React.ReactElement;
  compact?: boolean;
  disabled?: boolean;
}) {
  const c = ACCENT_MAP[color];
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "group glass-strong clip-hud relative flex w-full items-center gap-3 overflow-hidden rounded-xl border px-4 py-3.5 text-start transition active:scale-[0.98] hover:brightness-125 disabled:cursor-not-allowed disabled:opacity-50",
        c.border,
      )}
    >
      <div className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border bg-black/40", c.border)}>
        <Icon className={cn("h-5 w-5", c.text)} />
      </div>
      <div className="min-w-0">
        <div className={cn("font-display text-base font-bold", c.text)}>{label}</div>
        {!compact && <div className="truncate font-tech text-[10px] text-cyan-200/40">{desc}</div>}
      </div>
    </button>
  );
}

function StatTile({ label, value, color }: { label: string; value: string; color: "green" | "red" | "blue" }) {
  const c = ACCENT_MAP[color];
  return (
    <div className="glass clip-hud rounded-xl border border-white/10 p-3 text-center">
      <div className={cn("font-tech text-2xl font-bold", c.text)}>{value}</div>
      <div className="mt-0.5 font-tech text-[9px] uppercase leading-tight text-cyan-200/40">{label}</div>
    </div>
  );
}
