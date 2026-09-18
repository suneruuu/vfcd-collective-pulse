import { useEffect, useRef, useSyncExternalStore } from "react";
import { createQueueManager } from "../createQueueManager.js";
import { promptApi } from "../../services/promptApi.js";
export function usePromptQueue() {
  const manager = useRef(null);
  if (!manager.current) manager.current = createQueueManager(promptApi);
  const state = useSyncExternalStore(
    manager.current.subscribe,
    manager.current.getSnapshot,
    manager.current.getSnapshot,
  );
  useEffect(() => {
    const queueManager = manager.current;
    queueManager.start();
    window.addEventListener("online", queueManager.refresh);
    return () => {
      queueManager.stop();
      window.removeEventListener("online", queueManager.refresh);
    };
  }, []);
  return {
    state,
    mutate: manager.current.mutate,
    move: manager.current.move,
  };
}
