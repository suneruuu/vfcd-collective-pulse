export function createReordering({
  getPrompts,
  isDisabled,
  move,
  onChange,
  scheduler = globalThis,
}) {
  let active = null,
    frame = null,
    visual = { draggedId: null, targetId: null };
  const indexOf = (id) => getPrompts().findIndex((prompt) => prompt.id === id);
  function publish(draggedId, targetId) {
    if (visual.draggedId === draggedId && visual.targetId === targetId) return;
    visual = { draggedId, targetId };
    onChange(visual);
  }
  function finish(notify = true) {
    const previous = active;
    active = null;
    if (frame !== null) scheduler.cancelAnimationFrame(frame);
    frame = null;
    if (previous?.handle.hasPointerCapture?.(previous.pointerId))
      previous.handle.releasePointerCapture(previous.pointerId);
    if (notify) publish(null, null);
  }
  function targetAt(x, y) {
    const row = active.viewport.ownerDocument.elementFromPoint(x, y)?.closest(".question-row");
    return row && active.viewport.contains(row) && indexOf(row.dataset.id) >= 0
      ? row.dataset.id
      : null;
  }
  function updateTarget() {
    active.targetId = targetAt(active.x, active.y);
    publish(active.id, active.targetId);
  }
  function tick() {
    frame = null;
    if (!active?.dragging) return;
    if (isDisabled() || indexOf(active.id) < 0) {
      finish();
      return;
    }
    const rect = active.viewport.getBoundingClientRect();
    const edge = Math.min(32, rect.height / 4);
    if (
      edge > 0 &&
      active.x >= rect.left &&
      active.x <= rect.right &&
      active.y >= rect.top - edge &&
      active.y <= rect.bottom + edge
    ) {
      const delta =
        active.y < rect.top + edge
          ? -Math.min(12, Math.ceil(((rect.top + edge - active.y) / edge) * 12))
          : active.y > rect.bottom - edge
            ? Math.min(12, Math.ceil(((active.y - rect.bottom + edge) / edge) * 12))
            : 0;
      active.viewport.scrollTop += delta;
    }
    updateTarget();
    frame = scheduler.requestAnimationFrame(tick);
  }
  const matches = (event) => active?.pointerId === event.pointerId;
  return {
    cancel: () => finish(),
    dispose: () => finish(false),
    handleProps(id) {
      return {
        draggable: false,
        onDragStart: (event) => event.preventDefault(),
        onKeyDown(event) {
          if (isDisabled() || !["ArrowUp", "ArrowDown"].includes(event.key)) return;
          const index = indexOf(id);
          if (index < 0) return;
          event.preventDefault();
          finish();
          move(id, index + (event.key === "ArrowUp" ? -1 : 1));
        },
        onPointerDown(event) {
          if (isDisabled() || active || event.button !== 0 || event.isPrimary === false) return;
          const handle = event.currentTarget;
          const viewport = handle.closest(".queue-list-viewport");
          if (!viewport || indexOf(id) < 0) return;
          event.preventDefault();
          handle.focus({ preventScroll: true });
          active = {
            id,
            handle,
            viewport,
            pointerId: event.pointerId,
            startX: event.clientX,
            startY: event.clientY,
            x: event.clientX,
            y: event.clientY,
            dragging: false,
            targetId: null,
          };
          handle.setPointerCapture(event.pointerId);
        },
        onPointerMove(event) {
          if (!matches(event)) return;
          if (isDisabled() || indexOf(active.id) < 0) {
            finish();
            return;
          }
          active.x = event.clientX;
          active.y = event.clientY;
          if (!active.dragging) {
            if (Math.hypot(active.x - active.startX, active.y - active.startY) < 5) return;
            active.dragging = true;
          }
          event.preventDefault();
          updateTarget();
          if (frame === null) frame = scheduler.requestAnimationFrame(tick);
        },
        onPointerUp(event) {
          if (!matches(event)) return;
          const dragged = active.id;
          const target =
            active.dragging && !isDisabled() ? targetAt(event.clientX, event.clientY) : null;
          const targetIndex = target === null ? -1 : indexOf(target);
          finish();
          if (targetIndex >= 0 && indexOf(dragged) >= 0 && dragged !== target)
            move(dragged, targetIndex);
        },
        onPointerCancel(event) {
          if (matches(event)) finish();
        },
        onLostPointerCapture(event) {
          if (matches(event)) finish();
        },
      };
    },
  };
}
