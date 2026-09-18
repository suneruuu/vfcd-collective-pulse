export function getConnectionStatus({ queue, connected }) {
  const live = queue?.installation;
  const received = !!(connected && live?.online && live.revision === queue.revision);
  return {
    received,
    state: !connected ? "offline" : received ? "live" : "pending",
    text: !connected
      ? "Question service disconnected"
      : live?.cloud
        ? "Cloud connected · " + (live.active ? "voting open" : "outside voting hours")
        : !live?.online
          ? "Queue ready \u00b7 installation display offline"
          : !received
            ? "Saved \u00b7 waiting for installation to receive changes"
            : "Installation connected \u00b7 " +
              (live.active ? "voting open" : "outside voting hours"),
  };
}
