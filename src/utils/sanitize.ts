// Media file validation — all user-supplied File inputs pass through here
// before any blob URL is created, any ArrayBuffer is read, or any texture
// is allocated.  Defense-in-depth: MIME type + byte size + filename pattern.

export const ALLOWED_IMAGE_TYPES = new Set<string>([
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/avif',
]);

export const ALLOWED_GIF_TYPES = new Set<string>(['image/gif']);

export const ALLOWED_VIDEO_TYPES = new Set<string>([
  'video/mp4',
  'video/webm',
]);

export const MAX_IMAGE_BYTES = 50  * 1024 * 1024;   // 50 MB
export const MAX_GIF_BYTES   = 50  * 1024 * 1024;   // 50 MB
export const MAX_VIDEO_BYTES = 500 * 1024 * 1024;   // 500 MB

// Prevents GPU memory exhaustion from oversized source textures
export const MAX_DIMENSION = 8192;

export type ValidationResult =
  | { ok: true }
  | { ok: false; error: string };

/**
 * Validates a user-supplied File against a MIME allowlist and a byte-size cap.
 * Also rejects filenames that contain path traversal or shell-injection characters.
 */
export function validateMediaFile(
  file: File,
  allowedTypes: ReadonlySet<string>,
  maxBytes: number,
): ValidationResult {
  if (!allowedTypes.has(file.type)) {
    return { ok: false, error: `File type "${file.type}" is not accepted.` };
  }

  if (file.size === 0) {
    return { ok: false, error: 'The file is empty.' };
  }

  if (file.size > maxBytes) {
    const mb = (maxBytes / (1024 * 1024)).toFixed(0);
    return { ok: false, error: `File exceeds the ${mb} MB limit.` };
  }

  // Reject names with path separators, null bytes, or common shell metacharacters
  if (/[/\\<>:"|?*\x00]/.test(file.name)) {
    return { ok: false, error: 'Filename contains disallowed characters.' };
  }

  return { ok: true };
}

/** Clamp a pixel dimension to sane GPU bounds. */
export function clampDimension(n: number, max = MAX_DIMENSION): number {
  return Math.max(1, Math.min(max, Math.floor(n)));
}

/** Route a File to the correct source type, or null for unsupported formats. */
export function detectMediaCategory(
  file: File,
): 'image' | 'gif' | 'video' | null {
  if (ALLOWED_GIF_TYPES.has(file.type))   return 'gif';
  if (ALLOWED_IMAGE_TYPES.has(file.type)) return 'image';
  if (ALLOWED_VIDEO_TYPES.has(file.type)) return 'video';
  return null;
}
