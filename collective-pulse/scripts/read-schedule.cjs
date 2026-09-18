// Read the official schedule and print a validated snapshot; never edits files.
// Usage: node scripts/read-schedule.cjs --fetch
const fs = require("node:fs");

function plainText(value) {
  const entities = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " };
  return value
    .replace(/<[^>]*>/g, " ")
    .replace(/&(#x[\da-f]+|#\d+|\w+);/gi, (whole, entity) => {
      if (entity.startsWith("#")) {
        return String.fromCodePoint(
          entity[1].toLowerCase() === "x"
            ? parseInt(entity.slice(2), 16)
            : parseInt(entity.slice(1), 10),
        );
      }
      return entities[entity] ?? whole;
    })
    .replace(/\s+/g, " ")
    .trim();
}

function parseSchedule(html) {
  const dayPattern =
    /<div[^>]*>\s*(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday),\s*(\d+) September\s*<\/div>/g;
  const headings = [...html.matchAll(dayPattern)];
  if (headings.length !== 7)
    throw new Error("Expected all seven festival dates; source structure may have changed.");
  const days = headings.map((heading, index) => {
    const date = `2026-09-${heading[2].padStart(2, "0")}`;
    const section = html.slice(heading.index, headings[index + 1]?.index ?? html.length);
    // Date labels use the same listing wrapper as events but have no title.
    const items = section
      .split(/<div class="jet-listing-grid__item[^>]*data-post-id="/)
      .slice(1)
      .filter((item) => /<h5\b/.test(item));
    const events = items.map((item) => {
      const id = item.match(/^(\d+)"/)?.[1];
      const title = plainText(item.match(/<h5[^>]*>([\s\S]*?)<\/h5>/)?.[1] ?? "");
      const time = plainText(
        item.match(
          /<div class="elementor-heading-title[^>]*>\s*(\d{1,2}:\d{2}(?:\s*[-–]\s*\d{1,2}:\d{2})?)\s*<\/div>/,
        )?.[1] ?? "",
      );
      const track = plainText(
        item.match(/<p[^>]*>\s*<strong>\s*Track\s*(\d+):?\s*<\/strong>/)?.[1] ?? "",
      );
      const venue = plainText(
        item.match(/<p[^>]*>\s*<strong>\s*Venue:\s*<\/strong>([\s\S]*?)<\/p>/)?.[1] ?? "",
      );
      const room = plainText(
        item.match(/<p[^>]*>\s*<strong>\s*Room:\s*<\/strong>([\s\S]*?)<\/p>/)?.[1] ?? "",
      );
      const summary = plainText(item.split(/<strong>\s*Full description/i)[0]);
      const sessions = [
        ...summary.matchAll(
          /(?:Morning|Afternoon) Session:\s*(\d{2}:\d{2})\s*[-–]\s*(\d{2}:\d{2})/g,
        ),
      ].map((match) => ({ start: match[1], end: match[2] }));
      if (!id || !title || !time || !track || !venue)
        throw new Error(`Incomplete event ${id ?? "unknown"} on ${date}`);
      const [start, end] = time.split(/\s*[-–]\s*/);
      // Preserve missing end times; do not invent durations for start-only events.
      return {
        id,
        title,
        start,
        end: end ?? null,
        track: Number(track),
        venue,
        room,
        ...(sessions.length ? { sessions } : {}),
      };
    });
    if (events.length === 0) throw new Error(`No events found on ${date}`);
    return { date, weekday: heading[1], events };
  });
  return { source: "https://vfcd.events/schedule/", checkedAt: new Date().toISOString(), days };
}

if (require.main === module) {
  // Native PowerShell pipes can corrupt Vietnamese text; keep curl's UTF-8 bytes.
  const html = process.argv.includes("--fetch")
    ? require("node:child_process").execFileSync(
        "curl.exe",
        ["-fsSL", "https://vfcd.events/schedule/"],
        { encoding: "utf8", maxBuffer: 8 * 1024 * 1024 },
      )
    : fs.readFileSync(0, "utf8");
  process.stdout.write(JSON.stringify(parseSchedule(html), null, 2) + "\n");
}
module.exports = { parseSchedule, plainText };
