import { useApp } from "../context/AppContext";
import { findModuleDef } from "../config";
import { useNow, formatRelative } from "../hooks/useNow";
import { SEVERITY_STYLES } from "../utils/severity";
import { cn } from "../utils/cn";
import type { ModuleState, ModuleType } from "../types";
import { IconGrid, IconLaser, IconMotion, IconRfid, IconUltrasonic } from "./Icons";

const ICON_BY_TYPE: Record<ModuleType, typeof IconGrid> = {
  motion: IconMotion,
  ultrasonic: IconUltrasonic,
  laser: IconLaser,
  rfid: IconRfid,
  generic: IconGrid,
};

export function ModuleCard({ module }: { module: ModuleState }) {
  const { t } = useApp();
  const now = useNow(1000);
  const def = findModuleDef(module.id);
  const Icon = ICON_BY_TYPE[module.type] ?? IconGrid;

  const hasData = !!module.updatedAt;
  const style = SEVERITY_STYLES[module.severity];

  const statusText = !hasData
    ? t("statusWaiting")
    : module.severity === "alarm"
      ? t("statusTriggered")
      : module.severity === "warning"
        ? t("statusWarning")
        : t("statusOk");

  const alarm = hasData && module.severity === "alarm";

  return (
    <div
      className={cn(
        "glass clip-hud relative overflow-hidden rounded-2xl border p-4 transition-all",
        hasData ? style.border : "border-white/10",
        alarm && style.glow,
        alarm && "animate-pulse-glow",
      )}
    >
      {/* faint corner accent */}
      <div
        className="pointer-events-none absolute -right-6 -top-6 h-20 w-20 rounded-full blur-2xl"
        style={{ background: hasData ? `${style.raw}22` : "transparent" }}
      />

      <div className="relative flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div
            className={cn(
              "flex h-11 w-11 items-center justify-center rounded-xl border bg-black/40",
              hasData ? style.border : "border-white/10",
            )}
          >
            <Icon className={cn("h-6 w-6", hasData ? style.text : "text-cyan-200/40")} />
          </div>
          <div className="leading-tight">
            <div className="font-display text-base font-semibold text-cyan-50">
              {def ? t(def.nameKey) : module.id}
            </div>
            <div className="font-tech text-[10px] uppercase tracking-wider text-cyan-200/40">
              {def ? t(def.modelKey) : "—"}
            </div>
          </div>
        </div>
        <span className="rounded-md border border-white/10 bg-black/40 px-2 py-0.5 font-tech text-[10px] tracking-wider text-cyan-200/60">
          {module.id}
        </span>
      </div>

      {/* status line */}
      <div className="relative mt-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className={cn("h-2 w-2 rounded-full", hasData ? style.dot : "bg-cyan-200/30")} />
          <span className={cn("font-display text-lg font-bold", hasData ? style.text : "text-cyan-200/40")}>
            {statusText}
          </span>
        </div>
        {module.event && hasData && (
          <span className="max-w-[45%] truncate font-tech text-[10px] uppercase tracking-wider text-cyan-200/40">
            {module.event}
          </span>
        )}
      </div>

      {/* value line */}
      <div className="relative mt-2 min-h-[28px]">
        {module.type === "ultrasonic" && module.value ? (
          <div className="flex items-baseline gap-1.5">
            <span className="font-tech text-2xl font-bold text-glow-blue">{module.value}</span>
            <span className="font-tech text-xs text-cyan-200/50">cm</span>
          </div>
        ) : module.type === "rfid" && module.value ? (
          <div className="font-tech text-sm tracking-wider text-glow-pink" dir="ltr">
            {module.value}
          </div>
        ) : !hasData ? (
          <p className="font-tech text-[11px] text-cyan-200/30">{t("moduleOffline")}</p>
        ) : null}
      </div>

      <div className="relative mt-3 flex items-center justify-between border-t border-white/5 pt-2 font-tech text-[10px] uppercase tracking-wider text-cyan-200/30">
        <span>{t("lastUpdate")}</span>
        <span>{hasData ? formatRelative(module.updatedAt, now, t) : "—"}</span>
      </div>
    </div>
  );
}
