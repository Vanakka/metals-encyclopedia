/** Resolve specimen image URLs and warm the browser cache for snappy navigation. */

import sampleImages from "../data/sample-images.json";

const localMap = sampleImages?.images || {};
const warmed = new Set();

/** Prefer same-origin /samples/* when fetched; else Commons URL. */
export function displayImageUrl(metal) {
  if (!metal) return null;
  const local = localMap[metal.key];
  if (local) return local;
  return metal.imageUrl || null;
}

export function warmImage(url) {
  if (!url || warmed.has(url)) return;
  warmed.add(url);
  const img = new Image();
  img.decoding = "async";
  img.src = url;
}

/** Warm a list of metals (current series / visible cards). */
export function warmMetalImages(list, { limit = 40 } = {}) {
  if (!Array.isArray(list)) return;
  for (const metal of list.slice(0, limit)) {
    const url = displayImageUrl(metal);
    if (url) warmImage(url);
  }
}
