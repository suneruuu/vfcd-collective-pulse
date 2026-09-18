import { CONFIG, YES, NO } from "../../config/installation.js";
import { clamp } from "../../../shared/math.js";
export function createVoting(runtime, { campaign }) {
  function rebuildDerived() {
    const days = Array.from(
      {
        length: CONFIG.CAMPAIGN_DAYS,
      },
      () => [],
    );
    let yes = 0;
    let no = 0;
    let runningYes = 0;
    let runningNo = 0;
    let lastLeader = 0;
    for (const vote of runtime.state.votes) {
      const timestamp = vote[0];
      const choice = vote[1];
      const dayIndex = Math.floor((timestamp - runtime.campaignStartMs) / CONFIG.DAY_MS);
      if (dayIndex < 0 || dayIndex >= CONFIG.CAMPAIGN_DAYS) continue;
      days[dayIndex].push(vote);
      if (choice === YES) {
        yes++;
        runningYes++;
      } else {
        no++;
        runningNo++;
      }
      if (runningYes > runningNo) lastLeader = YES;
      if (runningNo > runningYes) lastLeader = NO;
    }
    runtime.state.lastLeader = lastLeader || runtime.state.lastLeader || 0;
    const dayData = days.map((votes, dayIndex) => buildDayData(votes, dayIndex));
    runtime.derived = {
      yes,
      no,
      total: yes + no,
      days: dayData,
      overview: buildOverviewData(dayData),
    };
  }
  function buildDayData(votes, dayIndex) {
    const dayStart = runtime.campaignStartMs + dayIndex * CONFIG.DAY_MS;
    const groups = [];
    let currentGroup = null;
    let yes = 0;
    let no = 0;
    for (const vote of votes) {
      const second = clamp(Math.floor((vote[0] - dayStart) / 1000), 0, CONFIG.DAY_SECONDS - 1);
      if (!currentGroup || currentGroup.second !== second) {
        currentGroup = {
          second,
          events: [],
          yesCount: 0,
          noCount: 0,
          bars: [],
          startValue: 0,
          endValue: 0,
          lastChoiceAfter: 0,
        };
        groups.push(currentGroup);
      }
      currentGroup.events.push(vote[1]);
      if (vote[1] === YES) {
        currentGroup.yesCount++;
        yes++;
      } else {
        currentGroup.noCount++;
        no++;
      }
    }
    let value = 0;
    let minValue = 0;
    let maxValue = 0;
    for (const group of groups) {
      group.startValue = value;
      group.bars = [
        {
          choice: YES,
          count: group.yesCount,
        },
        {
          choice: NO,
          count: group.noCount,
        },
      ].filter((bar) => bar.count > 0);
      for (const bar of group.bars) {
        value += bar.choice * bar.count * CONFIG.STEP_Y;
        minValue = Math.min(minValue, value);
        maxValue = Math.max(maxValue, value);
      }
      group.endValue = value;
      group.lastChoiceAfter = group.bars[group.bars.length - 1].choice;
    }
    return {
      dayIndex,
      votes,
      groups,
      yes,
      no,
      total: votes.length,
      finalValue: value,
      minValue,
      maxValue,
    };
  }
  function overviewGroupIsOpen(group) {
    return group.second >= CONFIG.OPEN_HOUR * 3600 && group.second < CONFIG.CLOSE_HOUR * 3600;
  }
  function buildOverviewData(days) {
    // Use the daily graph's YES/NO aggregation order, carrying the balance
    // continuously through the week rather than resetting it at midnight.
    const totalSteps = days.reduce(
      (count, day) =>
        count +
        day.groups.reduce(
          (sum, group) => sum + (overviewGroupIsOpen(group) ? group.bars.length : 0),
          0,
        ),
      0,
    );
    const pointLimit = 1800;
    const bucketCount = pointLimit / 4;
    const duration = CONFIG.CAMPAIGN_DAYS * (CONFIG.CLOSE_HOUR - CONFIG.OPEN_HOUR) * 3600000;
    const buckets = [];
    let points = [];
    let value = 0;
    let minValue = 0;
    let maxValue = 0;
    let index = 0;
    for (const day of days) {
      const dayStart = runtime.campaignStartMs + day.dayIndex * CONFIG.DAY_MS;
      for (const group of day.groups) {
        // Exclude out-of-hours legacy samples from this chart without deleting
        // them from the saved votes or changing the daily graph and totals.
        if (!overviewGroupIsOpen(group)) continue;
        const timestamp = dayStart + group.second * 1000;
        for (const bar of group.bars) {
          value += bar.choice * bar.count * CONFIG.STEP_Y;
          minValue = Math.min(minValue, value);
          maxValue = Math.max(maxValue, value);
          const point = {
            timestamp,
            value,
            index: index++,
          };
          if (totalSteps <= pointLimit) {
            points.push(point);
            continue;
          }
          // Keep first/min/max/last in chronological order in each time bucket.
          // Unlike stride sampling, this cannot discard a bucket's sharp peak.
          const bucketIndex = Math.min(
            bucketCount - 1,
            Math.max(
              0,
              Math.floor((campaign.overviewElapsedMs(timestamp) / duration) * bucketCount),
            ),
          );
          const bucket = buckets[bucketIndex];
          if (!bucket) {
            buckets[bucketIndex] = {
              first: point,
              min: point,
              max: point,
              last: point,
            };
          } else {
            if (point.value < bucket.min.value) bucket.min = point;
            if (point.value > bucket.max.value) bucket.max = point;
            bucket.last = point;
          }
        }
      }
    }
    if (totalSteps > pointLimit) {
      points = buckets.flatMap((bucket) => {
        const unique = new Map(
          [bucket.first, bucket.min, bucket.max, bucket.last].map((point) => [point.index, point]),
        );
        return [...unique.values()].sort((a, b) => a.index - b.index);
      });
    }
    return {
      points,
      minValue,
      maxValue,
      finalValue: value,
      totalSteps,
    };
  }
  function countVotesSince(startTimestamp, endTimestamp) {
    const votes = runtime.state.votes;
    let low = 0;
    let high = votes.length;
    while (low < high) {
      const middle = (low + high) >> 1;
      if (votes[middle][0] < startTimestamp) low = middle + 1;
      else high = middle;
    }
    let count = 0;
    for (let i = low; i < votes.length && votes[i][0] <= endTimestamp; i++) {
      count++;
    }
    return count;
  }
  function panelColorForTotals() {
    if (runtime.derived.yes > runtime.derived.no) return CONFIG.YES_COLOR;
    if (runtime.derived.no > runtime.derived.yes) return CONFIG.NO_COLOR;
    if (runtime.state.lastLeader === YES) return CONFIG.YES_COLOR;
    if (runtime.state.lastLeader === NO) return CONFIG.NO_COLOR;
    return CONFIG.TIE_PANEL_COLOR;
  }
  return {
    rebuildDerived,
    buildDayData,
    overviewGroupIsOpen,
    buildOverviewData,
    countVotesSince,
    panelColorForTotals,
  };
}
