import { useEffect, useRef, useSyncExternalStore } from "react";
import { createInstallation } from "../createInstallation.js";
import { createExternalStore } from "../../services/externalStore.js";
import { createPromptSynchronizer } from "../../services/promptSynchronizer.js";
import { promptApi } from "../../services/promptApi.js";
export function useInstallation(host) {
  const store = useRef(null);
  if (!store.current) store.current = createExternalStore(null);
  const engineRef = useRef(null);
  const snapshot = useSyncExternalStore(
    store.current.subscribe,
    store.current.getSnapshot,
    store.current.getSnapshot,
  );
  useEffect(() => {
    let cancelled = false,
      instance,
      sync;
    const cleanupListeners = [];
    const listen = (target, type, action) => {
      target.addEventListener(type, action);
      cleanupListeners.push(() => target.removeEventListener(type, action));
    };
    import("p5")
      .then(({ default: P5 }) => {
        if (cancelled) return;
        instance = new P5((p) => {
          const engine = createInstallation({
            p,
            storage: window.localStorage,
            pixelRatio: window.devicePixelRatio || 1,
            onSnapshot: store.current.publish,
            focusCanvas: () => host.current?.querySelector("canvas")?.focus(),
          });
          engineRef.current = engine;
          p.preload = engine.renderer.preload;
          p.setup = () => {
            if (cancelled) return;
            engine.setup();
            sync = createPromptSynchronizer({
              api: promptApi,
              installation: engine,
            });
            sync.start();
            listen(window, "online", sync.syncOnce);
            listen(window, "blur", () => engine.input.resetInputSampling());
            listen(document, "visibilitychange", () => engine.input.resetInputSampling());
            listen(window, "beforeunload", engine.persistence.saveState);
          };
          p.draw = engine.draw;
          p.windowResized = engine.windowResized;
          p.keyPressed = (event) =>
            event?.target?.closest("input, textarea, select")
              ? true
              : engine.input.keyPressed(event);
          p.keyReleased = engine.input.keyReleased;
          for (const name of ["mousePressed", "doubleClicked", "mouseWheel"])
            p[name] = (event) =>
              event?.target?.tagName === "CANVAS" ? engine.input[name](event) : true;
          p.mouseDragged = engine.input.mouseDragged;
          p.mouseReleased = engine.input.mouseReleased;
        }, host.current);
      })
      .catch((error) => {
        if (!cancelled) {
          console.error("Could not start the installation", error);
          store.current.publish({
            ...store.current.getSnapshot(),
            error: "Could not start the display. Reload the page to try again.",
          });
        }
      });
    return () => {
      cancelled = true;
      sync?.stop();
      cleanupListeners.forEach((remove) => remove());
      if (engineRef.current?.runtime.state) engineRef.current.persistence.saveState();
      instance?.remove();
      engineRef.current = null;
    };
  }, [host]);
  return {
    snapshot,
    invoke: (action, ...args) => engineRef.current?.actions[action]?.(...args),
  };
}
