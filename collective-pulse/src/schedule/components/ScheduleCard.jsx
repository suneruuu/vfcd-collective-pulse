export function ScheduleCard({ event }) {
  const nina = /Nina Next Space/i.test(event.venue);
  const location = event.venue.split(",")[0];
  const sessions = event.sessions ?? [{ start: event.start, end: event.end }];
  const time = sessions
    .map((session) => (session.end ? session.start + " \u2013 " + session.end : session.start))
    .join(", ");
  const label =
    event.title +
    ". Track " +
    event.track +
    ". " +
    time +
    ". " +
    event.venue +
    (event.room && event.room !== "-" ? ". Room " + event.room : "");
  const bars = event.bars ?? [{ x: event.x ?? 0, width: event.width ?? 386 }];
  return (
    <article
      className="schedule-card"
      title={label}
      aria-label={label}
      style={{
        "--event-x": event.x ?? 0,
        "--event-width": event.width ?? 386,
        "--event-y": event.y ?? 14,
        "--label-offset": (event.labelX ?? event.x ?? 0) - (event.x ?? 0),
        "--label-width": event.labelWidth ?? 386,
        "--title-offset": event.titleOffset ?? 58,
        "--title-tracking": event.titleTracking ?? 0,
        "--bar-height": event.barHeight ?? 6,
        "--caption-gap": event.captionGap ?? 2,
      }}
    >
      <div className="schedule-event-bars" aria-hidden="true">
        {bars.map((bar, index) => (
          <div
            key={index}
            className="schedule-event-bar"
            style={{
              "--bar-offset": bar.x - (event.x ?? 0),
              "--bar-width": bar.width,
            }}
          />
        ))}
      </div>
      <div className="schedule-card-caption">
        <strong className="schedule-card-track">
          Track {event.track}
          <span aria-hidden="true"> |</span>
        </strong>
        <p className="schedule-card-title">
          {event.title}
          {!nina && <span className="schedule-card-location"> (at {location})</span>}
        </p>
      </div>
      <time className="sr-only">{time}</time>
    </article>
  );
}
