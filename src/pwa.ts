/**
 * PWA bootstrap (single-file friendly).
 * ---------------------------------------------------------------------------
 * Because this app is bundled into a single index.html, we build the web app
 * manifest at runtime from a Blob and inject the brand icon as an inline SVG
 * data URI — no external files required. This powers "Add to Home Screen" /
 * installability without a separately-served manifest.
 *
 * `applyAppIcon()` swaps in a user-uploaded icon (data URL) and regenerates the
 * manifest so the installed app shows the custom icon too.
 */

const DEFAULT_ICON_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#050507"/><stop offset="1" stop-color="#0b0b18"/>
    </linearGradient>
    <linearGradient id="edge" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#39FF14"/><stop offset="1" stop-color="#00FFFF"/>
    </linearGradient>
    <filter id="g" x="-50%" y="-50%" width="200%" height="200%">
      <feGaussianBlur stdDeviation="9" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
    </filter>
  </defs>
  <rect width="512" height="512" rx="116" fill="url(#bg)"/>
  <g stroke="#00FFFF" stroke-opacity="0.07" stroke-width="1">
    <path d="M0 128h512M0 256h512M0 384h512M128 0v512M256 0v512M384 0v512"/>
  </g>
  <g filter="url(#g)" fill="none" stroke="url(#edge)" stroke-width="15" stroke-linejoin="round" stroke-linecap="round">
    <path d="M256 92 L122 148 V280 C122 376 180 436 256 470 C332 436 390 376 390 280 V148 Z"/>
  </g>
  <g filter="url(#g)" font-family="Rajdhani, Arial, sans-serif">
    <text x="256" y="328" font-size="206" font-weight="700" text-anchor="middle" fill="#39FF14">D</text>
  </g>
</svg>`;

const defaultIconUri = `data:image/svg+xml,${encodeURIComponent(DEFAULT_ICON_SVG)}`;
let currentIcon = defaultIconUri;

function mimeOf(href: string): string {
  const m = /^data:([^;,]+)/i.exec(href);
  if (m) return m[1];
  if (/\.png$/i.test(href)) return "image/png";
  if (/\.jpe?g$/i.test(href)) return "image/jpeg";
  if (/\.svg$/i.test(href)) return "image/svg+xml";
  return "image/png";
}

/** Create or replace a <link> in <head>. */
function setLink(rel: string, href: string, attrs: Record<string, string> = {}): void {
  if (typeof document === "undefined") return;
  let link = document.head.querySelector<HTMLLinkElement>(`link[rel="${rel}"]`);
  if (!link) {
    link = document.createElement("link");
    link.rel = rel;
    document.head.appendChild(link);
  }
  link.href = href;
  for (const [k, v] of Object.entries(attrs)) link.setAttribute(k, v);
}

function setMeta(name: string, content: string): void {
  if (typeof document === "undefined") return;
  let m = document.head.querySelector<HTMLMetaElement>(`meta[name="${name}"]`);
  if (!m) {
    m = document.createElement("meta");
    m.setAttribute("name", name);
    document.head.appendChild(m);
  }
  m.setAttribute("content", content);
}

function writeManifest(icon: string): void {
  const type = mimeOf(icon);
  const manifest = {
    name: "DiaPastash — IoT Security Dashboard",
    short_name: "DiaPastash",
    description: "Cyberpunk IoT security dashboard with real-time MQTT control.",
    start_url: ".",
    scope: ".",
    display: "standalone",
    orientation: "portrait",
    background_color: "#050507",
    theme_color: "#050507",
    categories: ["productivity", "utilities", "security"],
    icons: [
      { src: icon, sizes: "192x192", type, purpose: "any" },
      { src: icon, sizes: "512x512", type, purpose: "any" },
      { src: icon, sizes: "512x512", type, purpose: "maskable" },
    ],
  };
  try {
    const blob = new Blob([JSON.stringify(manifest)], { type: "application/manifest+json" });
    const url = URL.createObjectURL(blob);
    setLink("manifest", url);
  } catch {
    /* Blob unavailable — skip manifest */
  }
}

/** Apply the brand icon everywhere (favicon, apple-touch-icon, manifest). */
function publishIcon(icon: string): void {
  currentIcon = icon;
  const type = mimeOf(icon);
  setLink("icon", icon, { type });
  setLink("apple-touch-icon", icon);
  writeManifest(icon);
}

export function initPwa(): void {
  if (typeof document === "undefined") return;

  setMeta("apple-mobile-web-app-capable", "yes");
  setMeta("mobile-web-app-capable", "yes");
  setMeta("apple-mobile-web-app-status-bar-style", "black-translucent");
  setMeta("apple-mobile-web-app-title", "DiaPastash");

  publishIcon(currentIcon);
}

/**
 * Swap in a custom icon (e.g. a user-uploaded data URL). Pass an empty string
 * to revert to the default DiaPastash glyph. Safe to call repeatedly.
 */
export function applyAppIcon(iconUrl: string | undefined | null): void {
  publishIcon(iconUrl && iconUrl.trim() ? iconUrl.trim() : defaultIconUri);
}

export { defaultIconUri as PWA_ICON_URI };
