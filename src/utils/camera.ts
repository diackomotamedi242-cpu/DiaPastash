/**
 * Camera stream module — pluggable placeholder.
 * ---------------------------------------------------------------------------
 * `initCameraStream(streamUrl, options)` is intentionally a no-op shell so a
 * future ESP32-S3-CAM feed (MJPEG <img> loop or WebRTC) can be dropped in
 * without touching the UI. See the TODO markers for the two integration paths.
 */

export type CameraKind = "mjpeg" | "webrtc" | "unknown";

export interface CameraHandle {
  kind: CameraKind;
  /** Attach the live stream into this element. */
  attach: (target: HTMLElement) => Promise<void>;
  /** Stop the stream and release resources. */
  destroy: () => void;
}

export interface CameraOptions {
  kind?: CameraKind;
  onError?: (err: Error) => void;
}

/**
 * Build a camera handle for the given stream URL.
 *
 * TODO (MJPEG): set `target.innerHTML = '<img src=streamUrl>'` with a
 *   reloading/crossorigin strategy and listen for `onerror` to retry.
 *
 * TODO (WebRTC): create an RTCPeerConnection, `createOffer`/`setLocalDescription`,
 *   signal the SDP via an MQTT/WS signalling channel, `ontrack` → attach the
 *   MediaStream to a <video> element inside `target`.
 */
export async function initCameraStream(
  _streamUrl: string,
  _options: CameraOptions = {},
): Promise<CameraHandle> {
  const kind: CameraKind = _options.kind ?? "unknown";

  return {
    kind,
    async attach(_target: HTMLElement) {
      // Intentionally empty — wire the chosen transport here later.
      // _options.onError?.(new Error("Camera transport not implemented"));
    },
    destroy() {
      // Tear down the stream / peer connection here later.
    },
  };
}
