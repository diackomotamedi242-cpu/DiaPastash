import { useApp } from "../context/AppContext";
import { ConnectionPill } from "./ConnectionPill";
import { IconGlobe, IconPower, IconShield } from "./Icons";

export function TopBar() {
  const { t, lang, toggleLang, logout } = useApp();

  return (
    <header className="sticky top-0 z-40 border-b border-cyan-500/15 bg-bg/70 backdrop-blur-xl">
      <div className="mx-auto flex max-w-[480px] items-center justify-between gap-2 px-4 py-2.5">
        {/* Brand */}
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-neon-green/40 bg-black/40 shadow-glow-green">
            <IconShield className="h-5 w-5 text-glow-green" />
          </div>
          <div className="leading-none">
            <div className="font-brand text-base font-bold text-glow-blue">
              DIA<span className="text-glow-green">PASTASH</span>
            </div>
            <div className="mt-0.5 hidden font-tech text-[9px] uppercase tracking-[0.3em] text-cyan-200/40 sm:block">
              {t("appTagline")}
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1.5">
          <ConnectionPill compact />
          <button
            type="button"
            onClick={toggleLang}
            aria-label="language"
            className="glass flex h-9 items-center gap-1.5 rounded-lg border border-white/10 px-2.5 font-tech text-xs text-cyan-200/80 transition hover:border-neon-blue/50 hover:text-glow-blue"
          >
            <IconGlobe className="h-4 w-4" />
            {lang === "fa" ? "EN" : "فا"}
          </button>
          <button
            type="button"
            onClick={logout}
            aria-label={t("logout")}
            className="glass flex h-9 w-9 items-center justify-center rounded-lg border border-white/10 text-cyan-200/70 transition hover:border-neon-red/50 hover:text-glow-red"
          >
            <IconPower className="h-4 w-4" />
          </button>
        </div>
      </div>
    </header>
  );
}
