import { useState } from "react";
import { AppProvider, useApp } from "./context/AppContext";
import { Login } from "./components/Login";
import { TopBar } from "./components/TopBar";
import { BottomNav, type Panel } from "./components/BottomNav";
import { HomePanel } from "./components/panels/HomePanel";
import { ModulesPanel } from "./components/panels/ModulesPanel";
import { CameraPanel } from "./components/panels/CameraPanel";
import { EventLogPanel } from "./components/panels/EventLogPanel";
import { TracerPanel } from "./components/panels/TracerPanel";
import { SettingsPanel } from "./components/panels/SettingsPanel";
import { IconShield } from "./components/Icons";

function SessionSplash() {
  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden">
      <div className="pointer-events-none absolute inset-0 cyber-grid cyber-grid-anim opacity-70" />
      <div className="flex flex-col items-center gap-4">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-neon-green/40 bg-black/40 shadow-glow-green animate-pulse-glow">
          <IconShield className="h-8 w-8 text-glow-green" />
        </div>
        <div className="font-tech text-xs uppercase text-cyan-200/50">
          <span className="animate-blink">▊</span> authenticating session
        </div>
      </div>
    </div>
  );
}

function Dashboard({ panel, setPanel }: { panel: Panel; setPanel: (p: Panel) => void }) {
  return (
    <div className="scanlines relative min-h-screen">
      {/* animated cyber grid background */}
      <div className="pointer-events-none fixed inset-0 -z-10 cyber-grid cyber-grid-anim" />

      <TopBar />

      <main className="mx-auto max-w-[480px] px-4 pb-28 pt-4">
        {panel === "home" && <HomePanel />}
        {panel === "modules" && <ModulesPanel />}
        {panel === "camera" && <CameraPanel />}
        {panel === "log" && <EventLogPanel />}
        {panel === "trace" && <TracerPanel />}
        {panel === "settings" && <SettingsPanel />}
      </main>

      <BottomNav panel={panel} onChange={setPanel} />
    </div>
  );
}

function Shell() {
  const { authed, authChecking, lang } = useApp();
  const [panel, setPanel] = useState<Panel>("home");

  return (
    <div className={lang === "fa" ? "lang-fa" : "lang-en"}>
      {authChecking ? <SessionSplash /> : authed ? <Dashboard panel={panel} setPanel={setPanel} /> : <Login />}
    </div>
  );
}

export default function App() {
  return (
    <AppProvider>
      <Shell />
    </AppProvider>
  );
}
