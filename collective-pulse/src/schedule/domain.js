import { INSTALLATION_WEEK } from "../config/week.js";
import { FESTIVAL_SCHEDULE } from "./data.js";
export function vietnamScheduleDate(now) {
  return new Date(now + 7 * 60 * 60 * 1000).toISOString().slice(0, 10);
}
export function festivalDisplayDays(startDate = INSTALLATION_WEEK.START_DATE) {
  const startMs = new Date(`${startDate}T00:00:00+07:00`).getTime();
  const weekdayFormat = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Ho_Chi_Minh",
    weekday: "long",
  });
  return FESTIVAL_SCHEDULE.days.slice(0, INSTALLATION_WEEK.DAYS).map((day, index) => {
    const dayMs = startMs + index * 86400000;
    return {
      ...day,
      sourceDate: day.date,
      date: vietnamScheduleDate(dayMs),
      weekday: weekdayFormat.format(new Date(dayMs)),
    };
  });
}
export function festivalDayAt(now) {
  const date = vietnamScheduleDate(now);
  return (
    DISPLAY_SCHEDULE_DAYS.find((day) => day.date >= date) ??
    DISPLAY_SCHEDULE_DAYS[DISPLAY_SCHEDULE_DAYS.length - 1]
  );
}
export function scheduleMinutes(clock) {
  const [hours, minutes] = clock.split(":").map(Number);
  return hours * 60 + minutes;
}
export function buildScheduleAgenda(day) {
  const byStart = new Map();
  for (const event of day.events) {
    for (const session of event.sessions ?? [
      {
        start: event.start,
        end: event.end,
      },
    ]) {
      if (!byStart.has(session.start))
        byStart.set(session.start, {
          start: session.start,
          nina: [],
          satellite: [],
        });
      const column = /Nina Next Space/i.test(event.venue) ? "nina" : "satellite";
      byStart.get(session.start)[column].push({
        ...event,
        ...session,
      });
    }
  }
  const rows = [...byStart.values()].sort(
    (a, b) => scheduleMinutes(a.start) - scheduleMinutes(b.start),
  );
  let y = 0;
  for (const row of rows) {
    row.y = y;
    row.height = Math.max(1, row.nina.length, row.satellite.length) * 129;
    y += row.height;
  }
  const endMinute = Math.max(
    0,
    ...rows.map((row) => scheduleMinutes(row.start)),
    ...rows.flatMap((row) =>
      [...row.nina, ...row.satellite]
        .filter((event) => event.end)
        .map((event) => scheduleMinutes(event.end)),
    ),
  );
  return {
    rows,
    endY: y,
    endMinute,
  };
}
export function scheduleMarkerY(agenda, minute) {
  const points = agenda.rows.map((row) => ({
    minute: scheduleMinutes(row.start),
    y: row.y,
  }));
  points.push({
    minute: agenda.endMinute,
    y: agenda.endY,
  });
  if (points.length === 1 || minute <= points[0].minute) return 0;
  for (let index = 1; index < points.length; index++) {
    const next = points[index];
    const previous = points[index - 1];
    if (minute <= next.minute) {
      const progress = (minute - previous.minute) / Math.max(1, next.minute - previous.minute);
      return previous.y + progress * (next.y - previous.y);
    }
  }
  return agenda.endY;
}
export const DISPLAY_SCHEDULE_DAYS = Object.freeze(festivalDisplayDays());
