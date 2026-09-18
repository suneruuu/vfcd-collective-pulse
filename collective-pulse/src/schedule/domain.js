import { INSTALLATION_WEEK } from "../config/week.js";
import { FESTIVAL_SCHEDULE } from "./data.js";

export const SCHEDULE_TIMELINE = Object.freeze({
  WIDTH: 386,
  DEFAULT_START: 9 * 60,
  DEFAULT_END: 19 * 60,
  MIN_NINA_HEIGHT: 155,
  MIN_ROW_HEIGHT: 39,
});

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

export const DISPLAY_SCHEDULE_DAYS = Object.freeze(festivalDisplayDays());

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

export function scheduleMarkerX(timeline, minute) {
  const progress = (minute - timeline.startMinute) / (timeline.endMinute - timeline.startMinute);
  return Math.max(0, Math.min(1, progress)) * SCHEDULE_TIMELINE.WIDTH;
}

export function buildScheduleTimeline(day) {
  const events = day.events
    .flatMap((event) =>
      (event.sessions ?? [{ start: event.start, end: event.end }]).map((session, index) => {
        const startMinute = scheduleMinutes(session.start);
        return {
          ...event,
          ...session,
          sessionKey: event.id + "-" + index,
          startMinute,
          // An event without a published end gets a one-hour visual bar.
          endMinute: session.end ? scheduleMinutes(session.end) : startMinute + 60,
        };
      }),
    )
    .sort((a, b) => a.startMinute - b.startMinute || a.track - b.track);
  const startMinute = Math.min(
    SCHEDULE_TIMELINE.DEFAULT_START,
    ...events.map((event) => Math.floor(event.startMinute / 60) * 60),
  );
  const endMinute = Math.max(
    SCHEDULE_TIMELINE.DEFAULT_END,
    ...events.map((event) => Math.ceil(event.endMinute / 60) * 60),
  );
  const timeline = { startMinute, endMinute };
  const hours = (endMinute - startMinute) / 60;
  const labelStep = hours > 11 ? 2 : 1;
  const tickMinutes = Array.from(
    { length: Math.floor(hours / labelStep) + 1 },
    (_, index) => startMinute + index * labelStep * 60,
  );
  if (tickMinutes.at(-1) !== endMinute) {
    tickMinutes[tickMinutes.length - 1] = endMinute;
  }
  const ticks = tickMinutes.map((minute) => {
    return {
      label: String(Math.floor(minute / 60)).padStart(2, "0") + ":00",
      x: scheduleMarkerX(timeline, minute),
    };
  });
  const place = (column, top) => {
    let y = top + 14;
    const placed = column.map((event) => {
      const x = scheduleMarkerX(timeline, event.startMinute);
      const width = scheduleMarkerX(timeline, event.endMinute) - x;
      const labelX = Math.min(x, SCHEDULE_TIMELINE.WIDTH - 160);
      const labelWidth = SCHEDULE_TIMELINE.WIDTH - labelX;
      const titleLines = Math.ceil(event.title.length / Math.max(1, (labelWidth - 58) / 6.5));
      const satellite = !/Nina Next Space/i.test(event.venue);
      const rowHeight = Math.max(
        SCHEDULE_TIMELINE.MIN_ROW_HEIGHT,
        12 + (titleLines + (satellite ? 1 : 0)) * 17,
      );
      const placedEvent = { ...event, x, width, labelX, labelWidth, y };
      y += rowHeight;
      return placedEvent;
    });
    return { events: placed, endY: y + 14 };
  };
  const nina = place(
    events.filter((event) => /Nina Next Space/i.test(event.venue)),
    0,
  );
  const ninaHeight = Math.max(SCHEDULE_TIMELINE.MIN_NINA_HEIGHT, nina.endY);
  const satellite = place(
    events.filter((event) => !/Nina Next Space/i.test(event.venue)),
    ninaHeight,
  );
  return {
    ...timeline,
    ticks,
    gridWidth: (388 * 600) / (endMinute - startMinute),
    gridOffsets: Array.from(
      { length: Math.ceil((endMinute - startMinute) / 600) },
      (_, index) => (index * SCHEDULE_TIMELINE.WIDTH * 600) / (endMinute - startMinute),
    ),
    nina: nina.events,
    satellite: satellite.events,
    ninaHeight,
    height: Math.max(333, satellite.endY),
  };
}
