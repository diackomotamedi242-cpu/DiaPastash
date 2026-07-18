import { useApp } from "../../context/AppContext";
import { PanelHeader } from "../PanelHeader";
import { ModuleCard } from "../ModuleCard";
import { IconBolt, IconGrid } from "../Icons";

export function ModulesPanel() {
  const { t, modules, injectTestEvent } = useApp();
  return (
    <div className="animate-rise">
      <div className="flex items-end justify-between gap-2">
        <PanelHeader title={t("modulesTitle")} desc={t("modulesDesc")} Icon={IconGrid} accent="blue" />
      </div>

      <button
        type="button"
        onClick={injectTestEvent}
        className="mb-3 flex w-full items-center justify-center gap-2 rounded-lg border border-neon-pink/40 bg-neon-pink/5 py-2 font-tech text-[11px] uppercase tracking-wider text-glow-pink transition active:scale-[0.98] hover:bg-neon-pink/10"
      >
        <IconBolt className="h-4 w-4" /> {t("simulate")}
      </button>

      <div className="grid grid-cols-1 gap-3">
        {modules.map((m) => (
          <ModuleCard key={m.id} module={m} />
        ))}
      </div>
    </div>
  );
}
