import { useState, type FormEvent } from "react";
import { useApp } from "../context/AppContext";
import { IconEye, IconEyeOff, IconLock, IconShield, IconUser } from "./Icons";

export function Login() {
  const { login, enterDemo, t, lang, toggleLang } = useApp();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [errorKey, setErrorKey] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setErrorKey(null);
    const res = await login(username, password);
    if (!res.ok) setErrorKey(res.error ?? "authError");
    setBusy(false);
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden px-5 py-10">
      <div className="pointer-events-none absolute inset-0 cyber-grid cyber-grid-anim opacity-80" />
      <div className="pointer-events-none absolute -top-24 left-1/2 h-72 w-72 -translate-x-1/2 rounded-full bg-neon-green/10 blur-3xl" />

      <div className="relative w-full max-w-sm animate-rise">
        {/* Identity */}
        <div className="mb-7 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl border border-neon-green/40 bg-black/40 shadow-glow-green">
            <IconShield className="h-8 w-8 text-glow-green" />
          </div>
          <h1 className="font-brand text-3xl font-bold text-glow-blue animate-flicker">
            DIA<span className="text-glow-green">PASTASH</span>
          </h1>
          <p className="mt-2 font-tech text-xs uppercase text-cyan-200/60">{t("loginHint")}</p>
        </div>

        {/* Card */}
        <form
          onSubmit={onSubmit}
          className="glass-strong clip-hud space-y-4 rounded-2xl p-6 shadow-[0_0_40px_rgba(0,255,255,0.08)]"
        >
          <div className="flex items-center justify-between">
            <h2 className="font-display text-lg font-semibold text-glow-blue">{t("loginTitle")}</h2>
            <button
              type="button"
              onClick={toggleLang}
              className="glass rounded-md border border-white/10 px-2 py-1 font-tech text-[11px] text-cyan-200/80 hover:border-neon-blue/50 hover:text-glow-blue"
            >
              {lang === "fa" ? "EN" : "فا"}
            </button>
          </div>

          <Field label={t("username")}>
            <CredInput value={username} onChange={setUsername} Icon={IconUser} autoComplete="username" />
          </Field>

          <Field label={t("password")}>
            <CredInput
              value={password}
              onChange={setPassword}
              Icon={IconLock}
              type={showPw ? "text" : "password"}
              autoComplete="current-password"
              trailing={
                <button
                  type="button"
                  onClick={() => setShowPw((s) => !s)}
                  tabIndex={-1}
                  aria-label="toggle password"
                  className="text-cyan-200/40 transition hover:text-glow-blue"
                >
                  {showPw ? <IconEyeOff className="h-4 w-4" /> : <IconEye className="h-4 w-4" />}
                </button>
              }
            />
          </Field>

          {errorKey && (
            <p className="animate-pulse rounded-md border border-neon-red/40 bg-neon-red/5 px-3 py-2 text-center font-tech text-xs text-glow-red">
              ⚠ {t(errorKey as "authError")}
            </p>
          )}

          <button
            type="submit"
            disabled={busy}
            className="group relative w-full overflow-hidden rounded-lg border border-neon-green/60 bg-neon-green/10 py-3 font-display text-base font-bold uppercase text-glow-green shadow-glow-green transition active:scale-[0.98] disabled:opacity-60"
          >
            {busy ? t("loggingIn") : t("loginBtn")}
          </button>

          <button
            type="button"
            onClick={enterDemo}
            className="w-full text-center font-tech text-[10px] uppercase text-cyan-200/40 transition hover:text-glow-pink"
          >
            ◇ {t("enterDemo")}
          </button>

          <p className="pt-1 text-center font-tech text-[10px] uppercase text-cyan-200/30">{t("poweredBy")}</p>
        </form>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block font-tech text-[11px] uppercase text-cyan-200/70">{label}</span>
      {children}
    </label>
  );
}

/** Unified credential field shell — keeps username & password perfectly symmetric. */
function CredInput({
  value,
  onChange,
  Icon,
  type = "text",
  autoComplete,
  trailing,
}: {
  value: string;
  onChange: (v: string) => void;
  Icon: (p: { className?: string }) => React.ReactElement;
  type?: string;
  autoComplete?: string;
  trailing?: React.ReactNode;
}) {
  return (
    <div className="group relative flex items-center">
      <span className="pointer-events-none absolute start-3 text-cyan-200/40 transition group-focus-within:text-glow-green">
        <Icon className="h-[18px] w-[18px]" />
      </span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        type={type}
        autoComplete={autoComplete}
        dir="ltr"
        className="cyber-input ps-10 pe-10 text-start"
      />
      {trailing && <span className="absolute end-3">{trailing}</span>}
    </div>
  );
}
