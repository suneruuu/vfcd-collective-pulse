export function createFormatting(runtime, { campaign, clock = Date }) {
  // -----------------------------------------------------------------------------
  // FORMATTING
  // -----------------------------------------------------------------------------

  function formatClock(timestamp) {
    const formatter = new Intl.DateTimeFormat("en-GB", {
      timeZone: "Asia/Ho_Chi_Minh",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    });
    return formatter.format(new clock(timestamp));
  }
  function formatDate(timestamp) {
    const formatter = new Intl.DateTimeFormat("en-GB", {
      timeZone: "Asia/Ho_Chi_Minh",
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
    return formatter.format(new clock(timestamp));
  }
  function formatCampaignElapsed(now) {
    const totalSeconds = Math.floor(campaign.overviewElapsedMs(now) / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  }
  // -----------------------------------------------------------------------------
  // TIMED OPENING / CLOSING SCREENS
  // -----------------------------------------------------------------------------

  function formatOpeningCountdown(remainingMs) {
    const seconds = Math.ceil(Math.max(0, remainingMs) / 1000);
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor(seconds / 60) % 60;
    return [hours, minutes, seconds % 60]
      .map((value) => String(value).padStart(2, "0"))
      .join(" : ");
  }
  return {
    formatClock,
    formatDate,
    formatCampaignElapsed,
    formatOpeningCountdown,
  };
}
