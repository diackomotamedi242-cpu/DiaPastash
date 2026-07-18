import { useState } from "react";
import { useApp } from "../../context/AppContext";
import { PanelHeader } from "../PanelHeader";
import { SEVERITY_STYLES, SEVERITY_LABEL_KEY } from "../../utils/severity";
import { cn } from "../../utils/cn";
import type { LogEntry } from "../../types";
import { IconTerminal, IconTrash } from "../Icons";

type Filter = "all" | "alarm" | "warning" | "info";

const FILTERS: { id: Filter; label: string; color: string }[] = [
  { id: "all", label: "ALL", color: "text-cyan-200/70 border-white/10" },
  { id: "alarm", label: "ALARM", color: "text-glow-red border-neon-red/40" },
  { id: "warning", label: "WARN", color: "text-glow-yellow border-neon-yellow/40" },
  { id: "info", label: "INFO", color: "text-glow-blue border-neon-blue/40" },
];

function clock(ts: number) {
  const d = new Date(ts);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}

export function EventLogPanel() {
  const { t, logs, clearLogs } = useApp();
  const [filter, setFilter] = useState<Filter>("all");
  const [openId, setOpenId] = useState<string | null>(null);

  const filtered = logs.filter((e) => {
    if (filter === "all") return true;
    if (filter === "info") return e.severity === "info" || e.severity === "ok";
    return e.severity === filter;
  });

  return (
    <div className="animate-rise">
      <PanelHeader title={t("logTitle")} desc={t("logDesc")} Icon={IconTerminal} accent="green" />

      {/* toolbar */}
      <div className="mb-3 flex items-center justify-between gap-2">
        <div className="flex flex-wrap gap-1.5">
          {FILTERS.map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => setFilter(f.id)}
              className={cn(
                "rounded-md border px-2.5 py-1 font-tech text-[10px] uppercase tracking-wider transition",
                filter === f.id ? `${f.color} bg-black/40` : "border-white/5 text-cyan-200/30 hover:text-cyan-200/60",
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={() => {
            if (logs.length && window.confirm(t("confirmClear"))) clearLogs();
          }}
          className="flex items-center gap-1 rounded-md border border-white/10 px-2.5 py-1 font-tech text-[10px] uppercase tracking-wider text-cyan-200/50 transition hover:border-neon-red/40 hover:text-glow-red"
        >
          <IconTrash className="h-3.5 w-3.5" /> {t("clearLog")}
        </button>
      </div>

      {/* terminal */}
      <div className="glass-strong clip-hud h-[58vh] overflow-y-auto rounded-2xl border border-white/10 p-3">
        {filtered.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-2 text-center">
            <span className="font-tech text-xs text-cyan-200/30">{t("emptyLog")}</span>
            <span className="font-tech text-sm text-glow-green">
              <span className="animate-blink">▊</span>
            </span>
          </div>
        ) : (
          <ul className="space-y-1.5">
            {filtered.map((e) => (
              <LogRow
                key={e.id}
                entry={e}
                open={openId === e.id}
                onToggle={() => setOpenId((id) => (id === e.id ? null : e.id))}
              />
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function LogRow({ entry, open, onToggle }: { entry: LogEntry; open: boolean; onToggle: () => void }) {
  const { t } = useApp();
  const style = SEVERITY_STYLES[entry.severity];
  const dir = entry.outbound ? "↑" : "↓";
  const json = JSON.stringify(entry.event, null, 2);

  return (
    <li
      className="rounded-lg border border-white/5 bg-black/30 px-2.5 py-2 transition hover:bg-black/50"
      style={{ borderInlineStartWidth: 3, borderInlineStartColor: style.raw }}
    >
      <button type="button" onClick={onToggle} className="block w-full text-start">
        <div className="flex items-center gap-2">
          <span className="font-tech text-[10px] text-cyan-200/40" dir="ltr">
            {clock(entry.timestamp)}
          </span>
          <span className={cn("font-tech text-xs", entry.outbound ? "text-glow-yellow" : style.text)}>{dir}</span>
          <span className={cn("h-1.5 w-1.5 rounded-full", style.dot)} />
          <span className={cn("font-tech text-[10px] uppercase tracking-wider", style.text)}>
            {t(SEVERITY_LABEL_KEY[entry.severity])}
          </span>
          <span className="ml-auto font-tech text-[10px] text-cyan-200/30" dir="ltr">
            {entry.topic.split("/").pop()}
          </span>
        </div>
        <div className={cn("mt-1 truncate font-tech text-xs", style.text)} dir="ltr">
          {entry.summary}
        </div>
      </button>

      {open && (
        <div className="mt-2 space-y-1">
          <div className="font-tech text-[9px] uppercase tracking-wider text-cyan-200/30">
            {t("topic")}
          </div>
          <div className="font-tech text-[10px] text-cyan-200/50" dir="ltr">
            {entry.topic}
          </div>
          <div className="mt-1 overflow-x-auto rounded bg-black/60 p-2">
            <pre className="whitespace-pre font-tech text-[10px] leading-relaxed text-neon-green/80" dir="ltr">
              {json}
            </pre>
          </div>
        </div>
      )}
    </li>
  );
}
