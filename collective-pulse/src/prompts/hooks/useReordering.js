import { useRef, useState } from "react";
export function useReordering({ prompts, disabled, move }) {
  const [draggedId, setDraggedId] = useState(null),
    [targetId, setTargetId] = useState(null);
  const active = useRef(null),
    touchTarget = useRef(null);
  const finish = () => {
    active.current = null;
    touchTarget.current = null;
    setDraggedId(null);
    setTargetId(null);
  };
  const start = (id) => {
    active.current = id;
    setDraggedId(id);
  };
  const targetIndex = (id) => prompts.findIndex((prompt) => prompt.id === id);
  return {
    draggedId,
    targetId,
    handleProps(id) {
      return {
        draggable: !disabled,
        onKeyDown(event) {
          if (!disabled && ["ArrowUp", "ArrowDown"].includes(event.key)) {
            event.preventDefault();
            move(id, targetIndex(id) + (event.key === "ArrowUp" ? -1 : 1));
          }
        },
        onDragStart(event) {
          if (disabled) {
            event.preventDefault();
            return;
          }
          start(id);
          event.dataTransfer.setData("text/plain", id);
          event.dataTransfer.effectAllowed = "move";
        },
        onDragEnd: finish,
        onPointerDown(event) {
          if (disabled || event.pointerType === "mouse") return;
          event.preventDefault();
          start(id);
          event.currentTarget.setPointerCapture(event.pointerId);
        },
        onPointerMove(event) {
          if (!active.current || event.pointerType === "mouse") return;
          const row = document
            .elementFromPoint(event.clientX, event.clientY)
            ?.closest(".question-row");
          touchTarget.current = row?.dataset.id || null;
          setTargetId(touchTarget.current);
        },
        onPointerUp(event) {
          if (!active.current || event.pointerType === "mouse") return;
          const id = active.current,
            target = touchTarget.current;
          finish();
          if (target) move(id, targetIndex(target));
        },
        onPointerCancel: finish,
      };
    },
    rowProps(id) {
      return {
        onDragOver(event) {
          if (!active.current) return;
          event.preventDefault();
          setTargetId(id);
        },
        onDrop(event) {
          if (!active.current) return;
          event.preventDefault();
          const dragged = active.current;
          finish();
          move(dragged, targetIndex(id));
        },
      };
    },
  };
}
