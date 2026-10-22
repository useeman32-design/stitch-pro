/**
 * Turns a freshly-picked artwork image into a small, durable thumbnail
 * suitable for real persistence (AsyncStorage via designsService).
 *
 * Why this is needed: `expo-image-picker`'s result `uri` is not durable
 * across reloads/relaunches — on web it's a `blob:` URL tied to the current
 * document (invalidated on refresh), and on native it can point into a
 * cache directory that isn't guaranteed to survive. A `data:` URI embeds
 * the actual bytes as a string, so it round-trips through JSON/AsyncStorage
 * and keeps working after a reload on any platform. It's deliberately
 * downscaled + compressed first (the backend's own digitizing pipeline
 * only ever looks at up to ~150px anyway, see stitchpro-backend's
 * DEFAULT_MAX_DIM) so a multi-megabyte camera photo doesn't bloat local
 * storage.
 */

import * as ImageManipulator from 'expo-image-manipulator';

const MAX_DIMENSION = 480;
const JPEG_QUALITY = 0.72;

export async function createPersistableThumbnail(uri: string): Promise<string> {
  try {
    const result = await ImageManipulator.manipulateAsync(
      uri,
      [{ resize: { width: MAX_DIMENSION } }],
      {
        compress: JPEG_QUALITY,
        format: ImageManipulator.SaveFormat.JPEG,
        base64: true,
      }
    );
    if (result.base64) {
      return `data:image/jpeg;base64,${result.base64}`;
    }
    return uri;
  } catch {
    // Best-effort only — if manipulation fails for any reason (unsupported
    // platform quirk, corrupt image, etc.) fall back to the original uri so
    // design creation never breaks; it just won't survive a reload.
    return uri;
  }
}
