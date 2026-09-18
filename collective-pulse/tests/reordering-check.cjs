const assert = require("node:assert/strict");
const { createReordering } = require("./helpers/load-module.cjs")(
  "src/prompts/createReordering.js",
);
function fixture() {
  let prompts = ["a", "b", "c", "d", "e", "f"].map((id) => ({ id })),
    disabled = false,
    hitOverride;
  const moves = [],
    changes = [],
    captured = new Set(),
    frames = new Map();
  let frameId = 0;
  const viewport = {
    scrollTop: 0,
    getBoundingClientRect: () => ({ left: 0, right: 500, top: 50, bottom: 250, height: 200 }),
    contains: (row) => row.owner === viewport,
    ownerDocument: {
      elementFromPoint(x, y) {
        if (hitOverride !== undefined) return hitOverride;
        if (x < 0 || x > 500 || y < 50 || y > 250) return null;
        const prompt = prompts[Math.floor((y - 50 + viewport.scrollTop) / 60)];
        return prompt ? element(prompt.id) : null;
      },
    },
  };
  function element(id, owner = viewport) {
    const row = { dataset: { id }, owner };
    return { closest: () => row };
  }
  const handle = {
    closest: () => viewport,
    focus() {},
    setPointerCapture: (id) => captured.add(id),
    hasPointerCapture: (id) => captured.has(id),
    releasePointerCapture: (id) => captured.delete(id),
  };
  const controller = createReordering({
    getPrompts: () => prompts,
    isDisabled: () => disabled,
    move: (id, index) => moves.push([id, index]),
    onChange: (visual) => changes.push(visual),
    scheduler: {
      requestAnimationFrame(callback) {
        frames.set(++frameId, callback);
        return frameId;
      },
      cancelAnimationFrame: (id) => frames.delete(id),
    },
  });
  function event(y = 80, extras = {}) {
    return {
      button: 0,
      pointerId: 1,
      pointerType: "mouse",
      isPrimary: true,
      clientX: 20,
      clientY: y,
      currentTarget: handle,
      preventDefault() {
        this.prevented = true;
      },
      ...extras,
    };
  }
  function tick() {
    for (const [id, callback] of [...frames]) {
      frames.delete(id);
      callback();
    }
  }
  return {
    controller,
    event,
    moves,
    changes,
    captured,
    frames,
    viewport,
    tick,
    element,
    setPrompts: (value) => {
      prompts = value;
    },
    setDisabled: (value) => {
      disabled = value;
    },
    setHit: (value) => {
      hitOverride = value;
    },
  };
}
for (const pointerType of ["mouse", "touch", "pen"]) {
  const f = fixture(),
    props = f.controller.handleProps("a");
  props.onPointerDown(f.event(80, { pointerType }));
  assert(f.captured.has(1), pointerType + " captures the pointer on the handle");
  props.onPointerMove(f.event(140, { pointerType }));
  assert.deepEqual(f.changes.at(-1), { draggedId: "a", targetId: "b" });
  props.onPointerUp(f.event(140, { pointerType }));
  assert.deepEqual(f.moves, [["a", 1]], pointerType + " saves one reorder");
  assert.equal(f.frames.size, 0);
  assert.equal(f.captured.size, 0);
  assert.deepEqual(f.changes.at(-1), { draggedId: null, targetId: null });
  // Another drag on the same handle must work without remounting.
  props.onPointerDown(f.event(80, { pointerType }));
  props.onPointerMove(f.event(200, { pointerType }));
  props.onPointerUp(f.event(200, { pointerType }));
  assert.deepEqual(f.moves.at(-1), ["a", 2]);
  const nativeDrag = f.event();
  props.onDragStart(nativeDrag);
  assert(nativeDrag.prevented && props.draggable === false);
}
{
  const f = fixture(),
    props = f.controller.handleProps("a");
  props.onPointerDown(f.event());
  props.onPointerMove(f.event(82));
  props.onPointerUp(f.event(82));
  assert.equal(f.moves.length, 0, "A click or slight movement must not reorder");
  props.onPointerDown(f.event());
  props.onPointerMove(f.event(140));
  props.onPointerUp(f.event(140, { clientX: 700 }));
  assert.equal(f.moves.length, 0, "Release outside the queue must not use a stale target");
  assert.equal(f.frames.size, 0);
}
for (const cancelEvent of ["onPointerCancel", "onLostPointerCapture"]) {
  const f = fixture(),
    props = f.controller.handleProps("a");
  props.onPointerDown(f.event());
  props.onPointerMove(f.event(140));
  props[cancelEvent](f.event(140));
  props.onPointerUp(f.event(140));
  assert.equal(f.moves.length, 0, cancelEvent + " must cancel without saving");
  assert.equal(f.frames.size, 0);
  props.onPointerDown(f.event());
  props.onPointerMove(f.event(140));
  props.onPointerUp(f.event(140));
  assert.equal(f.moves.length, 1, "A cancelled drag must not block the next drag");
}
{
  const f = fixture(),
    props = f.controller.handleProps("a");
  props.onPointerDown(f.event(80, { button: 2 }));
  props.onPointerDown(f.event(80, { isPrimary: false }));
  assert.equal(f.captured.size, 0);
  props.onPointerDown(f.event());
  props.onPointerMove(f.event(140));
  props.onPointerMove(f.event(200, { pointerId: 2 }));
  props.onPointerUp(f.event(200, { pointerId: 2 }));
  assert.equal(f.moves.length, 0, "Another pointer cannot finish the active drag");
  props.onPointerUp(f.event(140));
  assert.deepEqual(f.moves, [["a", 1]]);
}
{
  const f = fixture(),
    props = f.controller.handleProps("a");
  props.onPointerDown(f.event());
  props.onPointerMove(f.event(140));
  f.setHit(f.element("b"));
  f.setPrompts(["new", "a", "b", "c"].map((id) => ({ id })));
  props.onPointerUp(f.event(140));
  assert.deepEqual(f.moves, [["a", 2]], "A poll during dragging must use the latest queue index");
}
{
  const f = fixture(),
    props = f.controller.handleProps("a");
  props.onPointerDown(f.event());
  props.onPointerMove(f.event(140));
  f.setHit(f.element("b"));
  f.setPrompts([{ id: "a" }, { id: "c" }]);
  props.onPointerUp(f.event(140));
  assert.equal(f.moves.length, 0, "A removed target cannot be saved");
}
{
  const f = fixture(),
    props = f.controller.handleProps("a");
  props.onPointerDown(f.event());
  props.onPointerMove(f.event(140));
  f.setHit(f.element("b", {}));
  props.onPointerUp(f.event(140));
  assert.equal(f.moves.length, 0, "Rows outside this queue cannot receive a drop");
}
for (const end of ["move", "up", "frame", "cancel"]) {
  const f = fixture(),
    props = f.controller.handleProps("a");
  props.onPointerDown(f.event());
  props.onPointerMove(f.event(140));
  f.setDisabled(true);
  if (end === "move") props.onPointerMove(f.event(140));
  if (end === "up") props.onPointerUp(f.event(140));
  if (end === "frame") f.tick();
  if (end === "cancel") f.controller.cancel();
  props.onPointerUp(f.event(140));
  assert.equal(f.moves.length, 0, "Saving or disconnecting must cancel a drag");
  assert.equal(f.frames.size, 0);
  props.onPointerDown(f.event());
  assert.equal(f.captured.size, 0, "Disabled handles cannot start a drag");
}
{
  const f = fixture(),
    props = f.controller.handleProps("a");
  props.onPointerDown(f.event());
  props.onPointerMove(f.event(248));
  for (let i = 0; i < 6; i++) f.tick();
  assert(f.viewport.scrollTop > 60, "Holding at the edge scrolls without additional pointer moves");
  props.onPointerUp(f.event(248));
  assert.deepEqual(f.moves, [["a", 4]], "Drop follows the newly revealed row after scrolling");
  assert.equal(f.frames.size, 0);
}
{
  const f = fixture(),
    props = f.controller.handleProps("c");
  f.viewport.scrollTop = 120;
  props.onPointerDown(f.event());
  props.onPointerMove(f.event(52));
  for (let i = 0; i < 6; i++) f.tick();
  assert(f.viewport.scrollTop < 60, "The top edge scrolls upward");
  props.onPointerUp(f.event(52));
  assert.deepEqual(f.moves, [["c", 0]]);
}
{
  const f = fixture(),
    props = f.controller.handleProps("a");
  props.onKeyDown(f.event(80, { key: "ArrowDown" }));
  assert.deepEqual(f.moves, [["a", 1]], "Keyboard reordering remains available");
  f.setDisabled(true);
  props.onKeyDown(f.event(80, { key: "ArrowDown" }));
  assert.equal(f.moves.length, 1);
  f.setDisabled(false);
  props.onPointerDown(f.event());
  props.onPointerMove(f.event(140));
  const changes = f.changes.length;
  f.controller.dispose();
  assert.equal(f.frames.size, 0);
  assert.equal(f.captured.size, 0);
  assert.equal(f.changes.length, changes, "Unmount cleanup must not publish React state");
}
console.log(
  "Reordering checks passed: mouse, touch, pen, repeated drags, cancellation, polling, disabled state, scrolling, and keyboard.",
);
