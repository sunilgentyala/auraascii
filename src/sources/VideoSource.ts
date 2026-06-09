import * as THREE from 'three';
import { BaseSource } from './BaseSource';
import {
  validateMediaFile,
  ALLOWED_VIDEO_TYPES,
  MAX_VIDEO_BYTES,
} from '@utils/sanitize';

/**
 * Video source — MP4/WebM file playback or live webcam stream.
 *
 * Uses THREE.VideoTexture, which overrides the `needsUpdate` getter to
 * return true whenever video.readyState >= HAVE_CURRENT_DATA.  This means
 * the Three.js render loop automatically uploads new frames to the GPU
 * without any explicit tick() work — VideoSource.tick() is a no-op.
 *
 * Security notes:
 * - File MIME type validated before blob URL creation.
 * - Blob URL revoked immediately after canplay fires.
 * - Video element is not appended to the DOM; it holds no reference to
 *   user credentials or cookie-bearing requests.
 * - crossOrigin = 'anonymous' prevents credential-bearing CORS requests
 *   if the src ever resolves cross-origin in the future.
 * - Webcam access requires a user gesture at the call site (enforced by
 *   the browser's autoplay policy).  This class never auto-requests the
 *   camera; fromWebcam() must be called in response to a UI event.
 * - getUserMedia is gated on secure context (HTTPS / localhost); an
 *   explicit check surfaces a clear error message instead of a silent
 *   browser rejection.
 * - All MediaStream tracks are stopped on dispose() so the OS camera
 *   indicator light turns off promptly.
 */
export class VideoSource extends BaseSource {
  private readonly video:  HTMLVideoElement;
  private readonly stream: MediaStream | null;

  private constructor(
    video: HTMLVideoElement,
    texture: THREE.VideoTexture,
    stream: MediaStream | null = null,
  ) {
    super(texture);
    this.video  = video;
    this.stream = stream;
  }

  // -------------------------------------------------------------------------
  // Factory methods
  // -------------------------------------------------------------------------

  static async fromFile(file: File): Promise<VideoSource> {
    const check = validateMediaFile(file, ALLOWED_VIDEO_TYPES, MAX_VIDEO_BYTES);
    if (!check.ok) throw new Error(check.error);

    const video  = VideoSource.makeVideoElement();
    const blobUrl = URL.createObjectURL(file);

    await new Promise<void>((resolve, reject) => {
      video.oncanplay = () => {
        URL.revokeObjectURL(blobUrl); // revoke once the browser has buffered enough
        resolve();
      };
      video.onerror = () => {
        URL.revokeObjectURL(blobUrl);
        reject(new Error('Video failed to load. The file may be corrupt or use an unsupported codec.'));
      };
      video.src = blobUrl;
      video.load();
    });

    const texture       = VideoSource.makeTexture(video);
    return new VideoSource(video, texture, null);
  }

  static async fromWebcam(): Promise<VideoSource> {
    if (!navigator.mediaDevices?.getUserMedia) {
      throw new Error(
        'Camera access requires a secure context (HTTPS or localhost). ' +
        'Reload the page over HTTPS to enable this feature.',
      );
    }

    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width:      { ideal: 1280 },
          height:     { ideal: 720 },
          facingMode: 'user',
        },
        audio: false,
      });
    } catch (err) {
      const msg = err instanceof DOMException ? err.message : 'Camera permission denied.';
      throw new Error(msg);
    }

    const video = VideoSource.makeVideoElement();
    video.srcObject = stream;

    await new Promise<void>((resolve) => {
      video.onloadedmetadata = () => resolve();
    });

    const texture = VideoSource.makeTexture(video);
    return new VideoSource(video, texture, stream);
  }

  // -------------------------------------------------------------------------
  // BaseSource API
  // -------------------------------------------------------------------------

  start(): Promise<void> {
    // play() returns a Promise; catch autoplay-policy rejections gracefully
    return this.video.play().catch(() => {
      console.warn(
        '[VideoSource] Autoplay was blocked. The user must interact with the page first.',
      );
    });
  }

  stop(): void {
    this.video.pause();
  }

  // THREE.VideoTexture auto-uploads new frames; no manual work needed here
  tick(): void {}

  dispose(): void {
    this.stop();
    this._texture.dispose();
    // Release webcam: stops the OS camera indicator immediately
    this.stream?.getTracks().forEach((t) => t.stop());
    this.video.srcObject = null;
    this.video.src       = '';
    this.video.load();     // abort any pending network request
  }

  // -------------------------------------------------------------------------

  private static makeVideoElement(): HTMLVideoElement {
    const v         = document.createElement('video');
    v.muted         = true;      // required for autoplay policy
    v.loop          = true;
    v.playsInline   = true;      // prevents full-screen on mobile Safari
    v.crossOrigin   = 'anonymous';
    return v;
  }

  private static makeTexture(video: HTMLVideoElement): THREE.VideoTexture {
    const tex       = new THREE.VideoTexture(video);
    tex.minFilter   = THREE.LinearFilter;
    tex.magFilter   = THREE.LinearFilter;
    tex.colorSpace  = THREE.SRGBColorSpace;
    return tex;
  }
}
