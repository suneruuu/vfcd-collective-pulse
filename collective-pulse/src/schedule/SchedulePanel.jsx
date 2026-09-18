import { useEffect, useMemo, useRef } from "react";
import { useClock } from "../hooks/useClock.js";
import {
  vietnamScheduleDate,
  festivalDayAt,
  buildScheduleAgenda,
  scheduleMarkerY,
  scheduleMinutes,
} from "./domain.js";
import { createScheduleFollower } from "./follower.js";
import { ScheduleAgenda } from "./components/ScheduleAgenda.jsx";
export function SchedulePanel({ now: externalNow, visible = true, phase }) {
  const now = useClock(externalNow);
  const day = festivalDayAt(now),
    date = vietnamScheduleDate(now);
  const agenda = useMemo(() => buildScheduleAgenda(day), [day]);
  const viewport = useRef(null),
    follower = useRef(createScheduleFollower());
  const minute = ((now + 7 * 3600000) % 86400000) / 60000;
  const markerY = scheduleMarkerY(agenda, minute);
  const markerHidden =
    date !== day.date ||
    !agenda.rows.length ||
    minute < scheduleMinutes(agenda.rows[0].start) ||
    minute > agenda.endMinute;
  useEffect(() => {
    if (!visible || !viewport.current) return;
    const target = follower.current.target({
      now,
      date: day.date,
      today: date === day.date,
      markerY,
      clientHeight: viewport.current.clientHeight,
    });
    if (target !== null) viewport.current.scrollTop = target;
  }, [now, visible, day.date, date, markerY]);
  const pause = () => follower.current.pause(Date.now());
  const dateLabel = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Ho_Chi_Minh",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date(day.date + "T00:00:00+07:00"));
  return (
    <aside
      id="festival-schedule"
      hidden={!visible}
      data-phase={phase}
      aria-label={"VFCD schedule for " + day.weekday + ", " + day.date}
    >
      <header className="schedule-header">
        <img className="schedule-live-icon" src="/assets/live.svg" width="20" height="20" alt="" />
        <span id="schedule-weekday">{day.weekday}</span>
        <time id="schedule-date">{dateLabel}</time>
      </header>
      <div className="schedule-venue schedule-venue-nina">Nina Next Space</div>
      <div className="schedule-venue schedule-venue-satellite">Satellite Venues</div>
      <div
        id="schedule-scroll"
        ref={viewport}
        tabIndex="0"
        role="region"
        aria-label="Daily agenda; scroll for more events"
        onWheelCapture={pause}
        onTouchStartCapture={pause}
        onPointerDownCapture={pause}
        onKeyDownCapture={pause}
      >
        <ScheduleAgenda agenda={agenda} />
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
          style={{
            "--now-y": "calc(" + markerY + " * var(--sy))",
          }}
        >
          <img src="/assets/schedule-now.svg" width="383.333" height="10.6667" alt="" />
        </div>
      </div>
      {["nina", "satellite"].map((venue) => (
        <div
          key={venue}
          className={"schedule-column-rule schedule-column-rule-" + venue}
          aria-hidden="true"
        >
          <img src="/assets/schedule-column-rule.svg" width="251" height="2" alt="" />
        </div>
      ))}
      <a
        className="schedule-source"
        href="https://vfcd.events/schedule/"
        target="_blank"
        rel="noopener noreferrer"
      >
        Full schedule
      </a>
      <span id="schedule-status">
        {date < day.date ? "Upcoming" : date > day.date ? "Festival ended" : "Today"}
      </span>
    </aside>
  );
}
