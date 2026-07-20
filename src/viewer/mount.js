/**
 * Reserved mount for a future interactive 3D panel.
 *
 * Contract:
 * - DOM id: element-viewer-3d
 * - Each metal already carries metal.viewer.physicalSample and metal.viewer.atomicModel
 */

export const VIEWER_SLOT_ID = "element-viewer-3d";

export function getViewerMount(root = document) {
  return root.getElementById(VIEWER_SLOT_ID);
}
