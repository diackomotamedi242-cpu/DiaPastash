import { useEffect, useMemo, useRef, useState } from "react";
import { useApp } from "../../context/AppContext";
import { PanelHeader } from "../PanelHeader";
import { cn } from "../../utils/cn";
import type { TraceDir, TraceEntry } from "../../types";
import { IconTerminal, IconTrash } from "../Icons";

type Filter = "all" | "tx" | "rx" | "sys";

const FILTERS: { id: Filter; labelKey: "dirTx" | "dirRx" | "dirSys"; color: string }[] = [
  { id: "all", labelKey: "dirTx", color: "text-cyan-200/70 border-white/10" }, // "all" label handled separately
  { id: "tx", labelKey: "dirTx", color: "text-glow-yellow border-neon-yellow/40" },
  { id: "rx", labelKey: "dirRx", color: "text-glow-green border-neon-green/40" },
  { id: "sys", labelKey: "dirSys", color: "text-glow-pink border-neon-pink/40" },
];

const DIR_STYLE: Record<TraceDir, { arrow: string; text: string; label: string }> = {
  tx: { arrow: "▲", text: "text-glow-yellow", label: "TX" },
  rx: { arrow: "▼", text: "text-glow-green", label: "RX" },
  sys: { arrow: "◆", text: "text-glow-pink", label: "SYS" },
};

function stamp(ts: number) {
  const d = new Date(ts);
  const p = (n: number) => String(n).padStart(2, "0");
  const ms = String(d.getMilliseconds()).padStart(3, "0");
  return `${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}.${ms}`;
}

function fmtBytes(n: number) {
  if (n < 1024) return `${n} B`;
  return `${(n / 1024).toFixed(1)} KB`;
}

export function TracerPanel() {
  const { t, traces, traceStats, clearTraces, injectTestEvent } = useApp();
  const [filter, setFilter] = useState<Filter>("all");
  const [paused, setPaused] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  const filtered = useMemo(
    () => (filter === "all" ? traces : traces.filter((e) => e.dir === filter)),
    [traces, filter],
  );

  // Auto-scroll to newest when new traffic arrives (unless paused).
  useEffect(() => {
    if (!paused && bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: "smooth", block: "end" });
    }
  }, [filtered.length, paused]);

  return (
    <div className="animate-rise">
      <PanelHeader title={t("tracerTitle")} desc={t("tracerDesc")} Icon={IconTerminal} accent="pink" />

      {/* stat strip */}
      <div className="mb-3 grid grid-cols-4 gap-2">
        <Stat label={t("total")} value={String(traces.length)} cls="text-glow-blue" />
        <Stat label={t("dirTx")} value={String(traceStats.tx)} cls="text-glow-yellow" />
        <Stat label={t("dirRx")} value={String(traceStats.rx)} cls="text-glow-green" />
        <Stat label={t("bytes")} value={fmtBytes(traceStats.bytes)} cls="text-glow-pink" />
      </div>

      {/* toolbar */}
      <div className="mb-2.5 flex items-center justify-between gap-2">
        <div className="flex flex-wrap gap-1.5">
          <button
            type="button"
            onClick={() => setFilter("all")}
            className={cn(
              "rounded-md border px-2.5 py-1 font-tech text-[10px] uppercase tracking-wider transition",
              filter === "all" ? "text-glow-blue border-neon-blue/40 bg-black/40" : "border-white/5 text-cyan-200/30 hover:text-cyan-200/60",
            )}
          >
            ALL
          </button>
          {FILTERS.filter((f) => f.id !== "all").map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => setFilter(f.id)}
              className={cn(
                "rounded-md border px-2.5 py-1 font-tech text-[10px] uppercase tracking-wider transition",
                filter === f.id ? `${f.color} bg-black/40` : "border-white/5 text-cyan-200/30 hover:text-cyan-200/60",
              )}
            >
              {t(f.labelKey)}
            </button>
          ))}
        </div>
        <div className="flex gap-1.5">
          <button
            type="button"
            onClick={injectTestEvent}
            className="rounded-md border border-neon-pink/40 px-2 py-1 font-tech text-[10px] uppercase tracking-wider text-glow-pink transition hover:bg-neon-pink/10"
          >
            ▷ {t("simulate")}
          </button>
          <button
            type="button"
            onClick={() => setPaused((p) => !p)}
            className={cn(
              "rounded-md border px-2 py-1 font-tech text-[10px] uppercase tracking-wider transition",
              paused ? "text-glow-red border-neon-red/40" : "text-glow-green border-neon-green/40",
            )}
          >
            {paused ? `▶ ${t("resume")}` : `⏸ ${t("pause")}`}
          </button>
          <button
            type="button"
            onClick={clearTraces}
            className="flex items-center gap-1 rounded-md border border-white/10 px-2 py-1 font-tech text-[10px] uppercase tracking-wider text-cyan-200/50 transition hover:border-neon-red/40 hover:text-glow-red"
          >
            <IconTrash className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* status pill */}
      <div className="mb-2 flex items-center justify-between font-tech text-[10px] uppercase tracking-wider">
        <span className="flex items-center gap-1.5 text-cyan-200/40">
          <span className={cn("h-1.5 w-1.5 rounded-full", paused ? "bg-neon-red" : "animate-pulse-glow bg-neon-green")} />
          {paused ? t("paused") : t("live")}
        </span>
        <span className="text-cyan-200/30" dir="ltr">
          {filtered.length} / {traces.length}
        </span>
      </div>

      {/* terminal */}
      <div className="glass-strong clip-hud h-[56vh] overflow-y-auto rounded-2xl border border-white/10 p-3">
        {filtered.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-2 text-center">
            <span className="font-tech text-xs text-cyan-200/30">{t("emptyTrace")}</span>
            <span className="font-tech text-sm text-glow-green">
              <span className="animate-blink">▊</span>
            </span>
          </div>
        ) : (
          <ul className="space-y-0.5 font-tech text-[11px] leading-relaxed">
            {filtered.map((e) => (
              <TraceRow key={e.id} entry={e} open={openId === e.id} onToggle={() => setOpenId((id) => (id === e.id ? null : e.id))} />
            ))}
            <div ref={bottomRef} />
          </ul>
        )}
      </div>
    </div>
  );
}

function Stat({ label, value, cls }: { label: string; value: string; cls: string }) {
  return (
    <div className="glass clip-hud rounded-lg border border-white/10 px-2 py-1.5 text-center">
      <div className={cn("font-tech text-base font-bold leading-none", cls)} dir="ltr">{value}</div>
      <div className="mt-1 font-tech text-[8px] uppercase tracking-wider text-cyan-200/40">{label}</div>
    </div>
  );
}

function TraceRow({ entry, open, onToggle }: { entry: TraceEntry; open: boolean; onToggle: () => void }) {
  const s = DIR_STYLE[entry.dir];
  const body = entry.topic ?? entry.detail ?? "";
  const hasPayload = entry.payload != null && entry.payload !== "";

  return (
    <li>
      <button type="button" onClick={onToggle} className="group flex w-full items-start gap-2 rounded px-1.5 py-1 text-start hover:bg-white/5">
        <span className="shrink-0 text-cyan-200/30" dir="ltr">{stamp(entry.ts)}</span>
        <span className={cn("shrink-0 font-bold", s.text)}>{s.arrow}</span>
        <span className={cn("shrink-0 font-bold", s.text)}>{s.label}</span>
        <span className="shrink-0 text-glow-blue">{entry.kind}</span>
        <span className="min-w-0 flex-1 truncate text-cyan-100/70" dir="ltr">{body}</span>
      </button>
      {open && (
        <div className="mb-1 ml-[88px] mr-2 overflow-x-auto rounded bg-black/60 p-2">
          {hasPayload ? (
            <pre className="whitespace-pre-wrap break-all font-tech text-[10px] text-neon-green/80" dir="ltr">
              {entry.payload}
            </pre>
          ) : (
            <span className="font-tech text-[10px] text-cyan-200/30">— {entry.detail || "no payload"} —</span>
          )}
        </div>
      )}
    </li>
  );
}
