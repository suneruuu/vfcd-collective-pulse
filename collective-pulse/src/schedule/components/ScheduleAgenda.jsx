import { ScheduleCard } from "./ScheduleCard.jsx";

export function ScheduleAgenda({ timeline }) {
  return (
    <div id="schedule-events" style={{ "--timeline-height": timeline.height }}>
      <section className="schedule-lane schedule-lane-nina" aria-label="NINA Next Space events">
        <h2 className="schedule-venue schedule-venue-nina" style={{ "--venue-y": 52 }}>
          NINA Next Space
        </h2>
        {timeline.nina.map((event) => (
          <ScheduleCard key={event.sessionKey} event={event} />
        ))}
      </section>
      <img
        className="schedule-venue-rule"
        src="/assets/schedule-venue-rule.svg"
        width="435"
        height="2"
        alt=""
        aria-hidden="true"
        style={{ "--venue-rule-y": timeline.ninaHeight }}
      />
      <section
        className="schedule-lane schedule-lane-satellite"
        aria-label="Satellite venue events"
      >
        <h2
          className="schedule-venue schedule-venue-satellite"
          style={{ "--venue-y": timeline.ninaHeight + 14 }}
        >
          Satellite Venue
        </h2>
        {timeline.satellite.map((event) => (
          <ScheduleCard key={event.sessionKey} event={event} />
        ))}
      </section>
    </div>
  );
}
