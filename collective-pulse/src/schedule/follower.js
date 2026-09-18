export function createScheduleFollower() {
  let pausedUntil = 0,
    previousDate = null,
    previousMinute = null,
    previousScale = null;
  return {
    pause: (now) => {
      pausedUntil = now + 30000;
    },
    target({ now, date, today, markerY, clientHeight }) {
      const changedDay = date !== previousDate;
      if (changedDay) {
        previousDate = date;
        pausedUntil = 0;
      }
      const minute = Math.floor(now / 60000),
        scale = clientHeight / 251;
      if (
        now < pausedUntil ||
        (!changedDay && minute === previousMinute && scale === previousScale)
      )
        return null;
      previousMinute = minute;
      previousScale = scale;
      return today ? Math.max(0, markerY - 61.5) * scale : 0;
    },
  };
}
