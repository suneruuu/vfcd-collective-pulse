export function createExternalStore(initial) {
  let snapshot = initial;
  let signature = JSON.stringify(initial);
  const listeners = new Set();
  return {
    getSnapshot: () => snapshot,
    subscribe: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    publish(next) {
      const nextSignature = JSON.stringify(next);
      if (nextSignature === signature) return;
      snapshot = next;
      signature = nextSignature;
      listeners.forEach((listener) => listener());
    },
  };
}
