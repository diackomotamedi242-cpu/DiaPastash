import type { SVGProps } from "react";
import { cn } from "../utils/cn";

type Accent = "green" | "blue" | "red" | "pink" | "yellow";

const ACCENT: Record<Accent, { box: string; title: string }> = {
  green: { box: "border-neon-green/40 shadow-glow-green", title: "text-glow-green" },
  blue: { box: "border-neon-blue/40 shadow-glow-blue", title: "text-glow-blue" },
  red: { box: "border-neon-red/40 shadow-glow-red", title: "text-glow-red" },
  pink: { box: "border-neon-pink/40 shadow-glow-pink", title: "text-glow-pink" },
  yellow: { box: "border-neon-yellow/40 shadow-glow-yellow", title: "text-glow-yellow" },
};

export function PanelHeader({
  title,
  desc,
  Icon,
  accent = "blue",
}: {
  title: string;
  desc?: string;
  Icon: (p: SVGProps<SVGSVGElement>) => React.ReactElement;
  accent?: Accent;
}) {
  const a = ACCENT[accent];
  return (
    <div className="mb-4 flex items-center gap-3">
      <div className={cn("flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border bg-black/40", a.box)}>
        <Icon className={cn("h-6 w-6", a.title)} />
      </div>
      <div className="min-w-0">
        <h2 className={cn("font-display text-xl font-bold tracking-wide", a.title)}>{title}</h2>
        {desc && <p className="truncate font-tech text-[11px] uppercase tracking-wider text-cyan-200/40">{desc}</p>}
      </div>
    </div>
  );
}
