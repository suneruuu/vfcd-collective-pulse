import { CONFIG } from "../../config/installation.js";
import { clamp } from "../../../shared/math.js";
export function createCampaign(runtime, {}) {
  function getCampaignTiming(now) {
    const rawDay = Math.floor((now - runtime.campaignStartMs) / CONFIG.DAY_MS);
    const firstOpenMs = runtime.campaignStartMs + CONFIG.OPEN_HOUR * 3600000;
    const finalCloseMs = runtime.campaignEndMs - CONFIG.DAY_MS + CONFIG.CLOSE_HOUR * 3600000;
    const before = now < firstOpenMs;
    const complete = now >= finalCloseMs;
    const displayDayIndex = before
      ? 0
      : complete
        ? CONFIG.CAMPAIGN_DAYS - 1
        : clamp(rawDay, 0, CONFIG.CAMPAIGN_DAYS - 1);
    const displayDayStart = runtime.campaignStartMs + displayDayIndex * CONFIG.DAY_MS;
    const openMs = displayDayStart + CONFIG.OPEN_HOUR * 3600000;
    const closeMs = displayDayStart + CONFIG.CLOSE_HOUR * 3600000;
    const active = !before && !complete && now >= openMs && now < closeMs;
    const activeDayIndex = active ? displayDayIndex : null;
    const nextOpenMs =
      complete || active
        ? null
        : before
          ? firstOpenMs
          : now < openMs
            ? openMs
            : openMs + CONFIG.DAY_MS;
    const preOpening = !active && !complete && (before || now < openMs);
    const phase = before
      ? "before-event"
      : active
        ? "open"
        : preOpening
          ? "before-day"
          : "after-day";
    const liveSecond = before
      ? 0
      : clamp((Math.min(now, closeMs) - displayDayStart) / 1000, 0, CONFIG.DAY_SECONDS);
    return {
      before,
      complete,
      active,
      preOpening,
      phase,
      nextOpenMs,
      openMs,
      closeMs,
      activeDayIndex,
      displayDayIndex,
      displayDayStart,
      liveSecond,
    };
  }
  function overviewElapsedMs(timestamp) {
    const votingDayMs = (CONFIG.CLOSE_HOUR - CONFIG.OPEN_HOUR) * 3600000;
    const dayIndex = Math.floor((timestamp - runtime.campaignStartMs) / CONFIG.DAY_MS);
    if (dayIndex < 0) return 0;
    if (dayIndex >= CONFIG.CAMPAIGN_DAYS) return CONFIG.CAMPAIGN_DAYS * votingDayMs;
    const openMs = runtime.campaignStartMs + dayIndex * CONFIG.DAY_MS + CONFIG.OPEN_HOUR * 3600000;
    return dayIndex * votingDayMs + Math.min(votingDayMs, Math.max(0, timestamp - openMs));
  }
  return {
    getCampaignTiming,
    overviewElapsedMs,
  };
}
