import { useEffect, useRef, useState } from "react";
import { createReordering } from "../createReordering.js";
export function useReordering({ prompts, disabled, move }) {
  const [visual, setVisual] = useState({ draggedId: null, targetId: null });
  const latest = useRef(null);
  latest.current = { prompts, disabled, move };
  const controller = useRef(null);
  if (!controller.current)
    controller.current = createReordering({
      getPrompts: () => latest.current.prompts,
      isDisabled: () => latest.current.disabled,
      move: (id, index) => latest.current.move(id, index),
      onChange: setVisual,
    });
  const reordering = controller.current;
  useEffect(() => {
    if (disabled) reordering.cancel();
  }, [disabled, reordering]);
  useEffect(() => () => reordering.dispose(), [reordering]);
  return { ...visual, handleProps: reordering.handleProps };
}
