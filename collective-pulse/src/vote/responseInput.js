export function createResponseInput({ canVote, submit, now = Date.now }) {
  const held = new Map();
  let pending = [],
    lastSample = now();
  function reset() {
    pending = [];
    held.clear();
    lastSample = now();
  }
  function sample() {
    const current = now();
    if (!canVote()) {
      reset();
      return;
    }
    // Do not manufacture historical responses after a suspended tab or slow frame.
    if (current - lastSample < 1000) return;
    lastSample = current;
    const choices = pending.splice(0, 256);
    const pressed = new Set(choices);
    for (const choice of new Set(held.values())) if (!pressed.has(choice)) choices.push(choice);
    if (choices.length) submit(choices.slice(0, 256));
  }
  function press(source, choice) {
    sample();
    if (!canVote() || held.has(source) || (choice !== 1 && choice !== -1)) return;
    if (pending.length < 256) pending.push(choice);
    held.set(source, choice);
  }
  function release(source) {
    sample();
    held.delete(source);
  }
  function tap(choice) {
    sample();
    if (canVote() && pending.length < 256) pending.push(choice);
  }
  return { press, release, tap, sample, reset };
}
