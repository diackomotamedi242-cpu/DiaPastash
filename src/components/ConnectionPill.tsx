import { useApp } from "../context/AppContext";
import type { MqttStatus } from "../types";
import type { TranslationKey } from "../i18n/translations";
import { cn } from "../utils/cn";

/** Map MQTT status → label key + neon colour family. */
export function getConnectionMeta(status: MqttStatus): {
  labelKey: TranslationKey;
  color: "green" | "yellow" | "red" | "blue";
} {
  switch (status) {
    case "connected":
      return { labelKey: "connConnected", color: "green" };
    case "connecting":
      return { labelKey: "connConnecting", color: "yellow" };
    case "reconnecting":
      return { labelKey: "connReconnecting", color: "yellow" };
    case "error":
      return { labelKey: "connError", color: "red" };
    case "closed":
      return { labelKey: "connClosed", color: "red" };
    default:
      return { labelKey: "connDisconnected", color: "red" };
  }
}

const COLOR = {
  green: { text: "text-glow-green", dot: "bg-neon-green" },
  yellow: { text: "text-glow-yellow", dot: "bg-neon-yellow" },
  red: { text: "text-glow-red", dot: "bg-neon-red" },
  blue: { text: "text-glow-blue", dot: "bg-neon-blue" },
};

export function ConnectionPill({ compact = false }: { compact?: boolean }) {
  const { mqttStatus, t } = useApp();
  const meta = getConnectionMeta(mqttStatus);
  const c = COLOR[meta.color];
  const live = mqttStatus === "connected";

  return (
    <div
      className={cn(
        "glass-strong inline-flex items-center gap-2 rounded-full border px-3 py-1.5",
        meta.color === "green" ? "border-neon-green" : "border-white/10",
      )}
    >
      <span className="relative flex h-2 w-2">
        {live && (
          <span className={cn("absolute inline-flex h-full w-full animate-ping rounded-full opacity-70", c.dot)} />
        )}
        <span className={cn("relative inline-flex h-2 w-2 rounded-full", c.dot)} />
      </span>
      <span className={cn("font-tech text-[11px] uppercase tracking-wider", c.text)}>
        {!compact && <span className="opacity-60">MQTT · </span>}
        {t(meta.labelKey)}
      </span>
    </div>
  );
}
