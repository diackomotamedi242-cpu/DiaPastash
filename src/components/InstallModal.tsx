import { useState, type ReactNode } from "react";
import { useApp } from "../context/AppContext";
import { useInstallPrompt, type Platform } from "../hooks/useInstallPrompt";
import { cn } from "../utils/cn";
import { PWA_ICON_URI } from "../pwa";
import { IconShield } from "./Icons";

export function InstallModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t, settings } = useApp();
  const { canInstall, installed, promptInstall, platform } = useInstallPrompt();
  const [busy, setBusy] = useState(false);
  const icon = settings.appIconUrl || PWA_ICON_URI;

  if (!open) return null;

  const handleInstall = async () => {
    setBusy(true);
    await promptInstall();
    setBusy(false);
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center px-5">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="glass-strong clip-hud relative w-full max-w-sm animate-rise rounded-2xl border border-neon-green/30 p-6 text-center shadow-glow-green">
        <button
          type="button"
          onClick={onClose}
          className="absolute end-3 top-3 flex h-7 w-7 items-center justify-center rounded-full border border-white/10 font-tech text-xs text-cyan-200/60 hover:text-glow-red"
        >
          ✕
        </button>

        <img src={icon} alt="DiaPastash" className="mx-auto mb-3 h-20 w-20 rounded-2xl border border-neon-green/40 shadow-glow-green" />

        <h3 className="font-display text-xl font-bold tracking-wide text-glow-blue">{t("webAppSection")}</h3>
        <p className="mx-auto mt-2 max-w-[16rem] font-tech text-xs leading-relaxed text-cyan-200/50">
          {t("webAppDesc")}
        </p>

        {/* state badge */}
        <div className="mt-4">
          {installed ? (
            <Badge color="green">{t("installedBadge")}</Badge>
          ) : canInstall ? (
            <Badge color="blue">{t("canInstallBadge")}</Badge>
          ) : (
            <Badge color="yellow">PWA · manual</Badge>
          )}
        </div>

        {/* primary action */}
        <div className="mt-5">
          {installed ? (
            <button
              type="button"
              onClick={onClose}
              className="w-full rounded-lg border border-neon-green/40 bg-neon-green/10 py-3 font-display text-sm font-bold uppercase tracking-widest text-glow-green transition active:scale-[0.98]"
            >
              ✓ {t("close")}
            </button>
          ) : canInstall ? (
            <button
              type="button"
              onClick={handleInstall}
              disabled={busy}
              className="flex w-full items-center justify-center gap-2 rounded-lg border border-neon-green/60 bg-neon-green/10 py-3 font-display text-sm font-bold uppercase tracking-widest text-glow-green shadow-glow-green transition active:scale-[0.98] disabled:opacity-60"
            >
              <IconShield className="h-5 w-5" />
              {busy ? t("installing") : t("installApp")}
            </button>
          ) : (
            <div className="rounded-lg border border-white/10 bg-black/30 p-3 text-start">
              <p className="font-tech text-[11px] leading-relaxed text-cyan-200/60">
                {platform === "ios" ? t("iosSteps") : platform === "android" ? t("androidSteps") : t("desktopSteps")}
              </p>
              <PlatformTag platform={platform} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Badge({ children, color }: { children: ReactNode; color: "green" | "blue" | "yellow" }) {
  const map = {
    green: "border-neon-green/40 text-glow-green",
    blue: "border-neon-blue/40 text-glow-blue",
    yellow: "border-neon-yellow/40 text-glow-yellow",
  } as const;
  return (
    <span className={cn("inline-block rounded-full border bg-black/40 px-4 py-1 font-tech text-[11px] uppercase tracking-wider", map[color])}>
      {children}
    </span>
  );
}

function PlatformTag({ platform }: { platform: Platform }) {
  const label = platform === "ios" ? "iOS · Safari" : platform === "android" ? "Android · Chrome" : "Desktop";
  return (
    <div className="mt-2 text-center font-tech text-[10px] uppercase tracking-wider text-cyan-200/30" dir="ltr">
      {label}
    </div>
  );
}
