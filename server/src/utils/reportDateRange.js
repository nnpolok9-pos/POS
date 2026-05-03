const REPORT_TIMEZONE_OFFSET_MINUTES = Number(process.env.REPORT_TIMEZONE_OFFSET_MINUTES || 420);

const parseDateParts = (dateValue) => {
  const match = String(dateValue || "").match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) {
    return null;
  }

  return {
    year: Number(match[1]),
    month: Number(match[2]),
    day: Number(match[3])
  };
};

const buildTimezoneDayRange = (dateValue) => {
  const parts = parseDateParts(dateValue);
  if (!parts) {
    return null;
  }

  const startUtcMs =
    Date.UTC(parts.year, parts.month - 1, parts.day, 0, 0, 0, 0) -
    REPORT_TIMEZONE_OFFSET_MINUTES * 60 * 1000;

  return {
    start: new Date(startUtcMs),
    end: new Date(startUtcMs + 24 * 60 * 60 * 1000 - 1)
  };
};

const buildTimezoneDateRange = (from, to) => {
  const today = new Date();
  const todayIso = new Date(today.getTime() + REPORT_TIMEZONE_OFFSET_MINUTES * 60 * 1000).toISOString().slice(0, 10);

  const startRange = buildTimezoneDayRange(from || todayIso);
  const endRange = buildTimezoneDayRange(to || todayIso);

  if (!startRange || !endRange) {
    return null;
  }

  return {
    start: startRange.start,
    end: endRange.end
  };
};

module.exports = {
  REPORT_TIMEZONE_OFFSET_MINUTES,
  buildTimezoneDayRange,
  buildTimezoneDateRange
};
