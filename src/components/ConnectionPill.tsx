import { useApp } from "../context/AppContext";
import type { TranslationKey } from "../i18n/translations";
import { cn } from "../utils/cn";

/** Derive a backend/device connection summary from the system snapshot. */
function getConnectionMeta(
  demo: boolean,
  backendOnline: boolean,
  deviceOnline: boolean,
): { labelKey: TranslationKey; color: "green" | "yellow" | "red" } {
  if (demo) return { labelKey: "demoBadge", color: "yellow" };
  if (!backendOnline) return { labelKey: "connDisconnected", color: "red" };
  if (!deviceOnline) return { labelKey: "deviceOffline", color: "yellow" };
  return { labelKey: "connConnected", color: "green" };
}

const COLOR = {
  green: { text: "text-glow-green", dot: "bg-neon-green", border: "border-neon-green" },
  yellow: { text: "text-glow-yellow", dot: "bg-neon-yellow", border: "border-neon-yellow/50" },
  red: { text: "text-glow-red", dot: "bg-neon-red", border: "border-neon-red/50" },
};

export function ConnectionPill({ compact = false }: { compact?: boolean }) {
  const { system, t } = useApp();
  const meta = getConnectionMeta(system.demo, system.backendOnline, system.deviceOnline);
  const c = COLOR[meta.color];
  const live = meta.color === "green";

  return (
    <div
      className={cn(
        "glass-strong inline-flex items-center gap-2 rounded-full border px-3 py-1.5",
        c.border,
      )}
    >
      <span className="relative flex h-2 w-2">
        {live && (
          <span className={cn("absolute inline-flex h-full w-full animate-ping rounded-full opacity-70", c.dot)} />
        )}
        <span className={cn("relative inline-flex h-2 w-2 rounded-full", c.dot)} />
      </span>
      <span className={cn("font-tech text-[11px] uppercase", c.text)}>
        {!compact && <span className="opacity-60">● </span>}
        {t(meta.labelKey)}
      </span>
    </div>
  );
}
