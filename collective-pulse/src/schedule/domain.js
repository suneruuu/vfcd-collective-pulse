import { INSTALLATION_WEEK } from "../config/week.js";
import { FESTIVAL_SCHEDULE } from "./data.js";

export const SCHEDULE_TIMELINE = Object.freeze({
  WIDTH: 386,
  DEFAULT_START: 9 * 60,
  DEFAULT_END: 19 * 60,
  MIN_NINA_HEIGHT: 155,
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

export function festivalDayAt(now, selectedDayIndex = null) {
  if (Number.isInteger(selectedDayIndex) && DISPLAY_SCHEDULE_DAYS[selectedDayIndex]) {
    return DISPLAY_SCHEDULE_DAYS[selectedDayIndex];
  }
  const date = vietnamScheduleDate(now);
  return (
    DISPLAY_SCHEDULE_DAYS.find((day) => day.date >= date) ??
    DISPLAY_SCHEDULE_DAYS[DISPLAY_SCHEDULE_DAYS.length - 1]
  );
}

export function scheduleMarkerX(timeline, minute) {
  const progress = (minute - timeline.startMinute) / (timeline.endMinute - timeline.startMinute);
  return Math.max(0, Math.min(1, progress)) * SCHEDULE_TIMELINE.WIDTH;
}

export function buildScheduleTimeline(day) {
  const events = day.events
    .filter((event) => ![4, 5].includes(Number(event.track)))
    .map((event) => ({
      ...event,
      ...event.layout,
      sessionKey: event.id,
      labelX: event.layout.labelX ?? event.layout.x,
    }));
  const timeline = {
    startMinute: SCHEDULE_TIMELINE.DEFAULT_START,
    endMinute: SCHEDULE_TIMELINE.DEFAULT_END,
  };
  return {
    ...timeline,
    ticks: Array.from({ length: 11 }, (_, index) => ({
      label: String(9 + index).padStart(2, "0") + ":00",
      x: scheduleMarkerX(timeline, (9 + index) * 60),
    })),
    gridWidth: 388,
    gridOffsets: [0],
    nina: events.filter((event) => /Nina Next Space/i.test(event.venue)),
    satellite: events.filter((event) => !/Nina Next Space/i.test(event.venue)),
    ninaHeight: day.ninaHeight ?? SCHEDULE_TIMELINE.MIN_NINA_HEIGHT,
    height: 333,
  };
}
