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
  const { authed, lang } = useApp();
  const [panel, setPanel] = useState<Panel>("home");

  return (
    <div className={lang === "fa" ? "lang-fa" : "lang-en"}>
      {authed ? <Dashboard panel={panel} setPanel={setPanel} /> : <Login />}
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
