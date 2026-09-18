export function ScheduleCard({ event }) {
  const nina = /Nina Next Space/i.test(event.venue);
  const location = event.venue.split(",")[0];
  const time = event.end ? event.start + " \u2013 " + event.end : event.start;
  const label =
    event.title +
    ". Track " +
    event.track +
    ". " +
    time +
    ". " +
    event.venue +
    (event.room && event.room !== "-" ? ". Room " + event.room : "");
  return (
    <article
      className="schedule-card"
      title={label}
      aria-label={label}
      style={{
        "--event-x": event.x ?? 0,
        "--event-width": event.width ?? 386,
        "--event-y": event.y ?? 14,
        "--label-offset": (event.labelX ?? 0) - (event.x ?? 0),
        "--label-width": event.labelWidth ?? 386,
      }}
    >
      <div className="schedule-event-bar" aria-hidden="true" />
      <div className="schedule-card-caption">
        <strong className="schedule-card-track">
          Track {event.track}
          <span aria-hidden="true"> |</span>
        </strong>
        <p className="schedule-card-title">
          {event.title}
          {!nina && <span className="schedule-card-location">(at {location})</span>}
        </p>
      </div>
      <time className="sr-only">{time}</time>
    </article>
  );
}
