/**
 * Image helpers — turn an uploaded file into a compact data URL suitable for
 * persisting in localStorage (e.g. as the app / PWA icon).
 */

export interface ResizedImage {
  dataUrl: string;
  width: number;
  height: number;
  bytes: number;
}

/**
 * Read a File (image) and downscale it so the longest edge is ≤ maxDim, then
 * encode to JPEG (quality 0.92). JPEG keeps localStorage small for photo icons.
 * Falls back to the original data URL if the canvas path is unavailable.
 */
export function fileToResizedDataUrl(file: File, maxDim = 512): Promise<ResizedImage> {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith("image/")) {
      reject(new Error("not-an-image"));
      return;
    }

    const reader = new FileReader();
    reader.onerror = () => reject(new Error("read-failed"));
    reader.onload = () => {
      const src = reader.result as string;
      const img = new Image();
      img.onerror = () => reject(new Error("decode-failed"));
      img.onload = () => {
        let { width, height } = img;
        const scale = Math.min(1, maxDim / Math.max(width, height));
        width = Math.round(width * scale);
        height = Math.round(height * scale);

        try {
          const canvas = document.createElement("canvas");
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext("2d");
          if (!ctx) {
            resolve({ dataUrl: src, width: img.width, height: img.height, bytes: src.length });
            return;
          }
          // Fill a dark background so transparent PNGs look right on the dark theme.
          ctx.fillStyle = "#050507";
          ctx.fillRect(0, 0, width, height);
          ctx.drawImage(img, 0, 0, width, height);
          const dataUrl = canvas.toDataURL("image/jpeg", 0.92);
          resolve({ dataUrl, width, height, bytes: dataUrl.length });
        } catch {
          resolve({ dataUrl: src, width: img.width, height: img.height, bytes: src.length });
        }
      };
      img.src = src;
    };
    reader.readAsDataURL(file);
  });
}

/** Human-readable size for the "saved icon" preview caption. */
export function fmtBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}
