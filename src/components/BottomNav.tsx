import { useApp } from "../context/AppContext";
import { cn } from "../utils/cn";
import { IconCamera, IconGrid, IconSettings, IconShield, IconTerminal, IconWave } from "./Icons";

export type Panel = "home" | "modules" | "camera" | "log" | "trace" | "settings";

const ITEMS: {
  id: Panel;
  labelKey: "navHome" | "navModules" | "navCamera" | "navLog" | "navTrace" | "navSettings";
  Icon: typeof IconShield;
}[] = [
  { id: "home", labelKey: "navHome", Icon: IconShield },
  { id: "modules", labelKey: "navModules", Icon: IconGrid },
  { id: "camera", labelKey: "navCamera", Icon: IconCamera },
  { id: "log", labelKey: "navLog", Icon: IconTerminal },
  { id: "trace", labelKey: "navTrace", Icon: IconWave },
  { id: "settings", labelKey: "navSettings", Icon: IconSettings },
];

export function BottomNav({ panel, onChange }: { panel: Panel; onChange: (p: Panel) => void }) {
  const { t } = useApp();
  return (
    <nav className="fixed inset-x-0 bottom-0 z-40">
      <div className="mx-auto max-w-[520px] px-2 pb-[calc(env(safe-area-inset-bottom)+9px)] pt-2">
        <div className="glass-strong flex items-stretch justify-between gap-0.5 rounded-2xl border border-cyan-500/15 px-1 py-1.5 shadow-[0_-6px_30px_rgba(0,0,0,0.6)]">
          {ITEMS.map(({ id, labelKey, Icon }) => {
            const active = panel === id;
            return (
              <button
                key={id}
                type="button"
                onClick={() => onChange(id)}
                aria-label={t(labelKey)}
                className={cn(
                  "relative flex flex-1 flex-col items-center gap-1 rounded-xl px-0.5 py-2 transition",
                  active ? "text-glow-blue" : "text-cyan-200/45 hover:text-cyan-200/75",
                )}
              >
                {active && (
                  <span className="absolute inset-x-1 inset-y-0 rounded-xl border border-neon-blue/50 bg-neon-blue/5 shadow-glow-blue" />
                )}
                <Icon className={cn("relative h-6 w-6", active && "animate-pulse-glow")} strokeWidth={active ? 2 : 1.7} />
                <span className="relative font-display text-[12px] font-semibold leading-none tracking-wide whitespace-nowrap">
                  {t(labelKey)}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
