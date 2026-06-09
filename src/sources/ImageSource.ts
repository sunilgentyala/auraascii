import * as THREE from 'three';
import { BaseSource } from './BaseSource';
import {
  validateMediaFile,
  ALLOWED_IMAGE_TYPES,
  MAX_IMAGE_BYTES,
} from '@utils/sanitize';

/**
 * Static image source — PNG, JPEG, WebP, AVIF.
 *
 * Security notes:
 * - MIME type validated against an explicit allowlist before the blob URL
 *   is created.  SVG is excluded so no embedded script can execute via
 *   the HTMLImageElement that THREE.TextureLoader creates internally.
 * - Blob URL is revoked immediately after the GPU texture upload completes;
 *   it is never stored or accessible after construction.
 * - No EXIF or metadata is parsed; the file is treated as opaque binary
 *   data handed directly to the browser's image decoder.
 */
export class ImageSource extends BaseSource {
  private constructor(texture: THREE.Texture) {
    super(texture);
  }

  static async fromFile(file: File): Promise<ImageSource> {
    const check = validateMediaFile(file, ALLOWED_IMAGE_TYPES, MAX_IMAGE_BYTES);
    if (!check.ok) throw new Error(check.error);

    const blobUrl = URL.createObjectURL(file);

    return new Promise<ImageSource>((resolve, reject) => {
      const loader = new THREE.TextureLoader();
      loader.load(
        blobUrl,
        (tex) => {
          URL.revokeObjectURL(blobUrl); // revoke as soon as data is on the GPU
          tex.minFilter   = THREE.LinearFilter;
          tex.magFilter   = THREE.LinearFilter;
          tex.colorSpace  = THREE.SRGBColorSpace;
          tex.needsUpdate = true;
          resolve(new ImageSource(tex));
        },
        undefined,
        () => {
          URL.revokeObjectURL(blobUrl);
          reject(new Error('Image failed to decode. The file may be corrupt.'));
        },
      );
    });
  }

  start():   Promise<void> { return Promise.resolve(); }
  stop():    void {}
  tick():    void {}

  dispose(): void {
    this._texture.dispose();
  }
}
