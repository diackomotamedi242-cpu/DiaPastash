import { useApp } from "../../context/AppContext";
import { PanelHeader } from "../PanelHeader";
import { ModuleCard } from "../ModuleCard";
import { IconRefresh, IconGrid } from "../Icons";
import { cn } from "../../utils/cn";

export function ModulesPanel() {
  const { t, modules, refreshModules, refreshingModules } = useApp();

  const handleRefresh = async () => {
    const ok = await refreshModules();
    if (ok) {
      // Success — fresh state will arrive over Socket.IO (modules:sync /
      // module:updated / security:event). No UI faking happens here.
    }
    // On error the button just re-enables; a localized toast can be added later.
    void ok;
  };

  return (
    <div className="animate-rise">
      <PanelHeader title={t("modulesTitle")} desc={t("modulesDesc")} Icon={IconGrid} accent="blue" />

      <button
        type="button"
        onClick={handleRefresh}
        disabled={refreshingModules}
        className={cn(
          "mb-3 flex w-full items-center justify-center gap-2 rounded-lg border py-2 font-display text-[11px] font-bold uppercase tracking-wider transition active:scale-[0.98] disabled:opacity-60",
          refreshingModules
            ? "border-neon-yellow/50 bg-neon-yellow/5 text-glow-yellow"
            : "border-neon-blue/50 bg-neon-blue/5 text-glow-blue hover:bg-neon-blue/10",
        )}
      >
        <IconRefresh className={cn("h-4 w-4", refreshingModules && "animate-spin")} />
        {refreshingModules ? t("refreshing") : t("refreshModules")}
      </button>

      <div className="grid grid-cols-1 gap-3">
        {modules.map((m) => (
          <ModuleCard key={m.id} module={m} />
        ))}
      </div>
    </div>
  );
}
