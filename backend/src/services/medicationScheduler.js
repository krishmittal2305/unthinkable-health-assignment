// Translates a free-text prescription frequency into concrete reminder
// timestamps. This is a deliberately simple heuristic (fixed clock times per
// day, or a fixed hourly interval) — good enough for the assignment's scope,
// documented as a known simplification rather than hidden.

function parseFrequency(frequency) {
  const f = frequency.toLowerCase();

  const everyHoursMatch = f.match(/every\s*(\d+)\s*hours?/);
  if (everyHoursMatch) {
    return { type: "interval", intervalHours: Math.max(1, parseInt(everyHoursMatch[1], 10)) };
  }

  const nTimesMatch = f.match(/(\d+)\s*(?:x|times)/);
  if (nTimesMatch) {
    return { type: "daily", timesPerDay: Math.max(1, parseInt(nTimesMatch[1], 10)) };
  }

  if (/\bqid\b|four times/.test(f)) return { type: "daily", timesPerDay: 4 };
  if (/\btid\b|three times|thrice/.test(f)) return { type: "daily", timesPerDay: 3 };
  if (/\bbid\b|twice/.test(f)) return { type: "daily", timesPerDay: 2 };
  if (/\bod\b|once/.test(f)) return { type: "daily", timesPerDay: 1 };

  return { type: "daily", timesPerDay: 1 }; // safe fallback: better one reminder than none
}

// Fixed clock times (UTC hour-of-day) for common daily dose counts, spread
// across waking hours.
const DAILY_HOUR_SCHEDULES = {
  1: [9],
  2: [9, 21],
  3: [9, 15, 21],
  4: [8, 12, 16, 20],
};

function generateReminderTimes(startFrom, durationDays, schedule) {
  const times = [];

  if (schedule.type === "interval") {
    const totalDoses = Math.max(1, Math.floor((durationDays * 24) / schedule.intervalHours));
    let t = new Date(startFrom.getTime() + schedule.intervalHours * 3_600_000);
    for (let i = 0; i < totalDoses; i++) {
      times.push(new Date(t));
      t = new Date(t.getTime() + schedule.intervalHours * 3_600_000);
    }
    return times;
  }

  const hours = DAILY_HOUR_SCHEDULES[schedule.timesPerDay] ?? DAILY_HOUR_SCHEDULES[1];
  for (let day = 0; day < durationDays; day++) {
    for (const hour of hours) {
      const d = new Date(startFrom);
      d.setUTCDate(d.getUTCDate() + day);
      d.setUTCHours(hour, 0, 0, 0);
      if (d > startFrom) times.push(d); // don't schedule a dose time already past today
    }
  }
  return times;
}

function buildReminderSchedule(frequency, durationDays, startFrom = new Date()) {
  const schedule = parseFrequency(frequency);
  return generateReminderTimes(startFrom, durationDays, schedule);
}

module.exports = { parseFrequency, generateReminderTimes, buildReminderSchedule };
