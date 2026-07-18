import { useEffect, useState } from "react";
import type { TranslationKey } from "../i18n/translations";

/** Re-renders the calling component on an interval so relative times stay fresh. */
export function useNow(intervalMs = 1000): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}

/** Human relative time using the active translation dictionary. */
export function formatRelative(
  ts: number | undefined,
  now: number,
  t: (k: TranslationKey) => string,
): string {
  if (!ts) return "—";
  const diff = Math.max(0, now - ts);
  const secs = Math.floor(diff / 1000);
  if (secs < 5) return t("justNow");
  if (secs < 60) return `${secs} ${t("secondsAgo")}`;
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins} ${t("minutesAgo")}`;
  const hrs = Math.floor(mins / 60);
  return `${hrs} ${t("hoursAgo")}`;
}
