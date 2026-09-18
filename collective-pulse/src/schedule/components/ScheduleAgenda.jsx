import { ScheduleCard } from "./ScheduleCard.jsx";
export function ScheduleAgenda({ agenda }) {
  const endClock =
    String(Math.floor(agenda.endMinute / 60)).padStart(2, "0") +
    ":" +
    String(agenda.endMinute % 60).padStart(2, "0");
  return (
    <div id="schedule-events">
      {agenda.rows.map((row) => (
        <div
          key={row.start}
          className="schedule-row"
          style={{
            "--row-height": row.height,
          }}
        >
          <time className="schedule-time">{row.start}</time>
          <div className="schedule-lane">
            {row.nina.map((event, index) => (
              <ScheduleCard key={event.id + "-" + index} event={event} />
            ))}
          </div>
          <div className="schedule-lane">
            {row.satellite.map((event, index) => (
              <ScheduleCard key={event.id + "-" + index} event={event} />
            ))}
          </div>
        </div>
      ))}
      <div className="schedule-end">
        <time className="schedule-time">{endClock}</time>
      </div>
    </div>
  );
}
