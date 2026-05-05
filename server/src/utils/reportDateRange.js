const REPORT_TIMEZONE_OFFSET_MINUTES = Number(process.env.REPORT_TIMEZONE_OFFSET_MINUTES || 420);
const ONE_DAY_MS = 24 * 60 * 60 * 1000;

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
    end: new Date(startUtcMs + ONE_DAY_MS - 1)
  };
};

const getTimezoneDateString = (date = new Date()) =>
  new Date(date.getTime() + REPORT_TIMEZONE_OFFSET_MINUTES * 60 * 1000).toISOString().slice(0, 10);

const buildTimezoneTodayRange = (date = new Date()) => buildTimezoneDayRange(getTimezoneDateString(date));

const buildTimezoneMonthRange = (date = new Date()) => {
  const shiftedDate = new Date(date.getTime() + REPORT_TIMEZONE_OFFSET_MINUTES * 60 * 1000);
  const monthStartString = `${shiftedDate.getUTCFullYear()}-${String(shiftedDate.getUTCMonth() + 1).padStart(2, "0")}-01`;
  const monthStartRange = buildTimezoneDayRange(monthStartString);
  const todayRange = buildTimezoneTodayRange(date);

  if (!monthStartRange || !todayRange) {
    return null;
  }

  return {
    start: monthStartRange.start,
    end: todayRange.end
  };
};

const buildTimezoneDateRange = (from, to) => {
  const todayIso = getTimezoneDateString();

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
  getTimezoneDateString,
  buildTimezoneDayRange,
  buildTimezoneTodayRange,
  buildTimezoneMonthRange,
  buildTimezoneDateRange
};
