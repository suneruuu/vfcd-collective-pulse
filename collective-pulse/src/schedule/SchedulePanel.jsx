import { useMemo, useRef, useEffect } from "react";
import { useClock } from "../hooks/useClock.js";
import {
  vietnamScheduleDate,
  festivalDayAt,
  buildScheduleTimeline,
  scheduleMarkerX,
} from "./domain.js";
import { ScheduleAgenda } from "./components/ScheduleAgenda.jsx";

export function SchedulePanel({ now: externalNow, visible = true, phase }) {
  const now = useClock(externalNow);
  const day = festivalDayAt(now);
  const date = vietnamScheduleDate(now);
  const timeline = useMemo(() => buildScheduleTimeline(day), [day]);
  const viewport = useRef(null);
  const minute = ((now + 7 * 3600000) % 86400000) / 60000;
  const markerX = scheduleMarkerX(timeline, minute);
  const markerHidden =
    date !== day.date ||
    !day.events.length ||
    minute < timeline.startMinute ||
    minute > timeline.endMinute;
  useEffect(() => {
    if (viewport.current) viewport.current.scrollTop = 0;
  }, [day.date]);
  const dateLabel = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Ho_Chi_Minh",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date(day.date + "T00:00:00+07:00"));
  const status = date < day.date ? "Upcoming" : date > day.date ? "Festival ended" : "Today";
  return (
    <aside
      id="festival-schedule"
      hidden={!visible}
      data-phase={phase}
      aria-label={"VFCD schedule for " + day.weekday + ", " + day.date}
    >
      <header className="schedule-header">
        <img
          className="schedule-live-icon"
          src="/assets/schedule-live.svg"
          width="20"
          height="20"
          alt=""
        />
        <span id="schedule-weekday">{day.weekday}</span>
        <time id="schedule-date" dateTime={day.date}>
          {dateLabel}
        </time>
      </header>
      <div className="schedule-axis" aria-label="Vietnam time">
        {timeline.ticks.map((tick) => (
          <time key={tick.label} style={{ "--tick-x": tick.x }}>
            {tick.label}
          </time>
        ))}
      </div>
      <div className="schedule-grid" aria-hidden="true">
        {timeline.gridOffsets.map((offset) => (
          <img
            key={offset}
            className="schedule-timeline-grid"
            src="/assets/schedule-timeline-grid.svg"
            width="388"
            height="333"
            alt=""
            style={{ "--grid-x": offset, "--grid-width": timeline.gridWidth }}
          />
        ))}
      </div>
      <div
        id="schedule-scroll"
        ref={viewport}
        tabIndex="0"
        role="region"
        aria-label="Daily timeline; scroll for more events"
      >
        <ScheduleAgenda timeline={timeline} />
      </div>
      <div
        id="schedule-now"
        role="img"
        aria-label={
          "Current Vietnam time " +
          String(Math.floor(minute / 60)).padStart(2, "0") +
          ":" +
          String(Math.floor(minute % 60)).padStart(2, "0")
        }
        hidden={markerHidden}
        style={{ "--now-x": markerX }}
      >
        <img src="/assets/schedule-timeline-now.svg" width="362.333" height="10.6667" alt="" />
      </div>
      <a
        className="schedule-source sr-only"
        href="https://vfcd.events/schedule/"
        target="_blank"
        rel="noopener noreferrer"
      >
        Full schedule
      </a>
      <span id="schedule-status" className="sr-only">
        {status}
      </span>
    </aside>
  );
}
