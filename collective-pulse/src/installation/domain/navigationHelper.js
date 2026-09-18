import { CONFIG } from "../../config/installation.js";

export function createNavigationHelper(runtime, { clock = Date } = {}) {
  function interact() {
    runtime.navigationHelperLastInteractionAt = clock.now();
  }

  function setHovered(hovered) {
    runtime.navigationHelperHovered = hovered;
    interact();
  }

  function toggle() {
    runtime.navigationHelperVisible = !runtime.navigationHelperVisible;
    interact();
  }

  function update(now = clock.now()) {
    if (!runtime.navigationHelperVisible || runtime.navigationHelperHovered) return;
    if (now - runtime.navigationHelperLastInteractionAt >= CONFIG.NAVIGATION_HELPER_IDLE_MS) {
      runtime.navigationHelperVisible = false;
    }
  }

  interact();
  return { interact, setHovered, toggle, update };
}
