export function ScheduleCard({ event }) {
  const nina = /Nina Next Space/i.test(event.venue);
  const location = nina
    ? event.room && event.room !== "-"
      ? "Room " + event.room
      : "Nina Next Space"
    : event.venue.split(",")[0];
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
    <article className="schedule-card" title={label} aria-label={label}>
      <p className="schedule-card-title">{event.title}</p>
      <p className="schedule-card-track">Track {event.track}</p>
      <p className="schedule-card-detail">{time}</p>
      <p className="schedule-card-location">{location}</p>
    </article>
  );
}
