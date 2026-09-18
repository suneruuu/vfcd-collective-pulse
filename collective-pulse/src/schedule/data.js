// Curated from the seven daily panels in Figma, node 191:4576.
// Keep event copy and timeline coordinates aligned with the design; no website fetch.
const NINA = "NINA Next Space";

function event(id, track, title, venue, start, end, layout) {
  return { id, track, title, venue, start, end, layout };
}

function exhibition(id, width) {
  return event(id, 1, "Exhibition: Living Festival", NINA, "09:00", "18:00", {
    x: 0,
    width,
    y: 14,
    labelWidth: 212,
  });
}

export const FESTIVAL_SCHEDULE = Object.freeze({
  source: "https://www.figma.com/design/nFZuVD1N9s30u72fi6eyIW/VFCD-Installation?node-id=191-4576",
  days: [
    {
      date: "2026-09-21",
      weekday: "Monday",
      nodeId: "191:4529",
      events: [
        exhibition("191:4551", 348),
        event("191:4554", 2, "VFCD Opening Ceremony & Key Note", NINA, "13:00", "17:00", {
          x: 156,
          width: 154,
          y: 53,
          labelWidth: 195,
          titleOffset: 57,
        }),
        event("191:4535", 3, "Street Objects & The New Comfort", "Ném Space", "10:00", "12:00", {
          x: 39,
          width: 77,
          y: 169,
          labelX: 43,
          labelWidth: 265,
          titleOffset: 59,
        }),
      ],
    },
    {
      date: "2026-09-22",
      weekday: "Tuesday",
      nodeId: "191:4217",
      events: [
        exhibition("191:4233", 350),
        event("191:4249", 2, "Forum: Festival Futures Forwards", NINA, "09:00", "17:00", {
          x: 0,
          width: 311,
          y: 53,
          labelWidth: 256,
        }),
        event(
          "191:4244",
          3,
          "Living in the BLANK",
          "Sanuki Daisuke Architects Studio",
          "10:00",
          "12:00",
          { x: 40, width: 76, y: 169, labelWidth: 285, titleOffset: 59, captionGap: 3 },
        ),
        event("191:4245", 3, "22＋1", "Gallery Medium", "16:00", "18:00", {
          x: 270,
          width: 78,
          y: 226,
          labelX: 138,
          labelWidth: 212,
        }),
      ],
    },
    {
      date: "2026-09-23",
      weekday: "Wednesday",
      nodeId: "191:4268",
      events: [
        exhibition("191:4285", 348),
        {
          ...event(
            "191:4316",
            3,
            "Living Threads - Fragmented Scrolls: Reflective Needlecraft in the Cracks of Everyday Life",
            NINA,
            "10:30",
            "12:00",
            {
              x: 58,
              width: 58,
              y: 53,
              labelWidth: 338,
              bars: [
                { x: 58, width: 58 },
                { x: 252, width: 59 },
              ],
            },
          ),
          sessions: [
            { start: "10:30", end: "12:00" },
            { start: "15:30", end: "17:00" },
          ],
        },
        event("191:4304", 3, "Short Film Session", NINA, "14:00", "17:00", {
          x: 195,
          width: 116,
          y: 109,
          labelWidth: 166,
        }),
        event(
          "191:4311",
          3,
          "The Design Intelligence Lab: Codifying Design Intelligence through Cross-Cultural Architectural Practice",
          "Out2Design Studio",
          "10:00",
          "13:00",
          { x: 39, width: 116, y: 169, labelWidth: 348, titleOffset: 59 },
        ),
        event("191:4315", 3, "The Lab: An Evolving Practice", "The Lab", "14:00", "16:00", {
          x: 193,
          width: 78,
          y: 242,
          labelX: 195,
          labelWidth: 208,
          titleOffset: 59,
        }),
      ],
    },
    {
      date: "2026-09-24",
      weekday: "Thursday",
      nodeId: "191:4324",
      events: [
        exhibition("191:4341", 348),
        event("191:4364", 3, "Design Is a Verb", "Laita Design Studio", "10:00", "12:00", {
          x: 39,
          width: 77,
          y: 169,
          labelWidth: 343,
        }),
        event("191:4368", 3, "Learning [From] Everyday", "TOTO Showroom", "14:00", "16:00", {
          x: 193,
          width: 78,
          y: 208,
          labelWidth: 194,
          titleOffset: 57,
        }),
      ],
    },
    {
      date: "2026-09-25",
      weekday: "Friday",
      nodeId: "191:4372",
      events: [
        exhibition("191:4388", 346),
        event(
          "191:4409",
          3,
          "Reviving Urban Memory: Adaptive Reuse and the Living City at Tempo Nexus",
          "Tempo Nexus Reading Room",
          "10:00",
          "12:00",
          { x: 39, width: 77, y: 169, labelWidth: 348 },
        ),
      ],
    },
    {
      date: "2026-09-26",
      weekday: "Saturday",
      nodeId: "191:4416",
      events: [
        exhibition("191:4432", 346),
        event("191:4435", 3, "Experimental Digital Arts", NINA, "10:00", "13:00", {
          x: 39,
          width: 115,
          y: 53,
          labelX: 41,
          labelWidth: 212,
        }),
        event("191:4438", 3, "Creative Expression Session", NINA, "14:00", "17:00", {
          x: 193,
          width: 116,
          y: 92,
          labelWidth: 194,
          titleOffset: 56,
        }),
        event("191:4464", 3, "Hao Si Phuong Gallery", "AD+ studio", "10:00", "13:00", {
          x: 39,
          width: 115,
          y: 169,
          labelWidth: 343,
        }),
        event(
          "191:4442",
          3,
          "Mạch Ngầm [counter-place]",
          "Nguyễn Art Foundation",
          "14:00",
          "16:00",
          {
            x: 193,
            width: 75,
            y: 209,
            labelWidth: 194,
            titleOffset: 56,
            barHeight: 4,
            captionGap: 3,
          },
        ),
      ],
    },
    {
      date: "2026-09-27",
      weekday: "Sunday",
      nodeId: "191:4471",
      ninaHeight: 189,
      events: [
        exhibition("191:4487", 346),
        event("191:4490", 3, "Performance Art", NINA, "10:00", "13:00", {
          x: 39,
          width: 115,
          y: 53,
          labelX: 41,
          labelWidth: 212,
        }),
        event("191:4493", 3, "Urban Art", NINA, "14:00", "17:00", {
          x: 194,
          width: 115,
          y: 92,
          labelX: 196,
          labelWidth: 190,
        }),
        event(
          "191:4496",
          3,
          "Breathe The Idea: The thinking, making and shaping behind VFCD’s visual identity",
          NINA,
          "17:00",
          "19:00",
          {
            x: 309,
            width: 78,
            y: 131,
            labelX: 93,
            labelWidth: 294,
            titleOffset: 56,
            captionGap: 4,
            // Preserve the design's two-line caption with browser font metrics.
            titleTracking: -0.1,
          },
        ),
        event("191:4522", 3, "Invisible Reflection", "Vin Gallery", "10:00", "12:00", {
          x: 39,
          width: 77,
          y: 203,
          labelWidth: 343,
        }),
        event(
          "191:4500",
          3,
          "Living Space: How Architecture Shapes the Way We Live",
          "Kaze Studio",
          "14:00",
          "16:00",
          {
            x: 193,
            width: 78,
            y: 243,
            labelWidth: 193,
            titleOffset: 56,
            barHeight: 4,
            captionGap: 3,
          },
        ),
      ],
    },
  ],
});
