import { useApp } from "../../context/AppContext";
import { PanelHeader } from "../PanelHeader";
import { IconCamera } from "../Icons";

/**
 * LiveStreamPanel (ESP32-S3-CAM placeholder).
 * The actual transport is wired through `initCameraStream()` (see utils/camera.ts).
 * For now we render an "offline / coming soon" HUD box.
 */
export function CameraPanel() {
  const { t, settings } = useApp();
  return (
    <div className="animate-rise">
      <PanelHeader title={t("cameraTitle")} desc={`ESP32-S3-CAM · ${t("cameraId")}`} Icon={IconCamera} accent="pink" />

      {/* Placeholder stream box */}
      <div className="glass clip-hud relative aspect-video w-full overflow-hidden rounded-2xl border border-neon-pink/30">
        {/* moving scan line */}
        <div
          className="absolute inset-x-0 h-12 bg-gradient-to-b from-transparent via-neon-pink/10 to-transparent"
          style={{ animation: "scan 3.4s linear infinite" }}
        />
        <div
          className="absolute inset-x-0 h-px bg-neon-pink/60 shadow-[0_0_12px_#ff00ff]"
          style={{ animation: "scan 3.4s linear infinite" }}
        />

        {/* grid texture */}
        <div className="absolute inset-0 opacity-30 [background-image:linear-gradient(rgba(255,0,255,0.12)_1px,transparent_1px),linear-gradient(90deg,rgba(255,0,255,0.12)_1px,transparent_1px)] [background-size:24px_24px]" />

        {/* center content */}
        <div className="relative flex h-full flex-col items-center justify-center gap-3 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full border border-neon-pink/40 bg-black/50 shadow-glow-pink">
            <IconCamera className="h-8 w-8 text-glow-pink" />
          </div>
          <div>
            <div className="font-display text-2xl font-bold text-glow-red animate-pulse-glow">
              {t("cameraOffline")}
            </div>
            <div className="mt-1 font-tech text-sm uppercase tracking-[0.3em] text-glow-pink">
              {t("cameraComingSoon")}
            </div>
          </div>
        </div>

        {/* corner labels */}
        <div className="absolute left-3 top-3 flex items-center gap-1.5 font-tech text-[10px] uppercase tracking-widest text-glow-pink">
          <span className="h-2 w-2 animate-pulse rounded-full bg-neon-red" /> REC
        </div>
        <div className="absolute right-3 top-3 font-tech text-[10px] tracking-widest text-cyan-200/50" dir="ltr">
          {t("cameraId")} · OFFLINE
        </div>
        <div className="absolute bottom-3 left-1/2 -translate-x-1/2 font-tech text-[10px] uppercase tracking-widest text-cyan-200/30">
          {settings.broker}:{settings.port}
        </div>
      </div>

      <p className="mt-4 rounded-xl border border-white/10 bg-black/30 p-3 font-tech text-xs leading-relaxed text-cyan-200/50">
        {t("cameraDesc")}
      </p>
    </div>
  );
}
