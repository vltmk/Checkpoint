/**
 * Solar Hijri (Jalali / Shamsi) & Gregorian Calendar Utilities
 * Zero-dependency, pure mathematical conversion algorithms.
 */

// Month Names
export const SHAMSI_MONTHS = [
  'فروردین',
  'اردیبهشت',
  'خرداد',
  'تیر',
  'مرداد',
  'شهریور',
  'مهر',
  'آبان',
  'آذر',
  'دی',
  'بهمن',
  'اسفند',
];

export const GREGORIAN_MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

// Weekdays (Saturday-first for Shamsi, Sunday-first for Gregorian)
export const SHAMSI_WEEKDAYS = [
  { label: 'ش', full: 'شنبه', index: 0 },
  { label: 'ی', full: 'یکشنبه', index: 1 },
  { label: 'د', full: 'دوشنبه', index: 2 },
  { label: 'س', full: 'سه‌شنبه', index: 3 },
  { label: 'چ', full: 'چهارشنبه', index: 4 },
  { label: 'پ', full: 'پنج‌شنبه', index: 5 },
  { label: 'ج', full: 'جمعه', index: 6, isWeekend: true },
];

export const GREGORIAN_WEEKDAYS = [
  { label: 'Su', full: 'Sunday', index: 0 },
  { label: 'Mo', full: 'Monday', index: 1 },
  { label: 'Tu', full: 'Tuesday', index: 2 },
  { label: 'We', full: 'Wednesday', index: 3 },
  { label: 'Th', full: 'Thursday', index: 4 },
  { label: 'Fr', full: 'Friday', index: 5 },
  { label: 'Sa', full: 'Saturday', index: 6 },
];

/**
 * Converts Gregorian date to Jalali (Solar Hijri)
 * Inputs: gy (year), gm (month: 1-12), gd (day: 1-31)
 * Returns: { jy, jm, jd }
 */
export function gregorianToJalali(gy, gm, gd) {
  const g_d_m = [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334];
  let jy;
  if (gy > 1600) {
    jy = 979;
    gy -= 1600;
  } else {
    jy = 0;
    gy -= 621;
  }
  const gy2 = gm > 2 ? gy + 1 : gy;
  let days =
    365 * gy +
    Math.floor((gy2 + 3) / 4) -
    Math.floor((gy2 + 99) / 100) +
    Math.floor((gy2 + 399) / 400) -
    80 +
    gd +
    g_d_m[gm - 1];
  jy += 33 * Math.floor(days / 12053);
  days %= 12053;
  jy += 4 * Math.floor(days / 1461);
  days %= 1461;
  if (days > 365) {
    jy += Math.floor((days - 1) / 365);
    days = (days - 1) % 365;
  }
  const jm = days < 186 ? 1 + Math.floor(days / 31) : 7 + Math.floor((days - 186) / 30);
  const jd = 1 + (days < 186 ? days % 31 : (days - 186) % 30);
  return { jy, jm, jd };
}

/**
 * Converts Jalali (Solar Hijri) date to Gregorian
 * Inputs: jy (year), jm (month: 1-12), jd (day: 1-31)
 * Returns: { gy, gm, gd } (1-indexed month)
 */
export function jalaliToGregorian(jy, jm, jd) {
  let gy;
  if (jy > 979) {
    gy = 1600;
    jy -= 979;
  } else {
    gy = 621;
  }
  let days =
    365 * jy +
    Math.floor(jy / 33) * 8 +
    Math.floor(((jy % 33) + 3) / 4) +
    78 +
    jd +
    (jm < 7 ? (jm - 1) * 31 : (jm - 7) * 30 + 186);
  gy += 400 * Math.floor(days / 146097);
  days %= 146097;
  if (days > 36524) {
    gy += 100 * Math.floor(--days / 36524);
    days %= 36524;
    if (days >= 365) days++;
  }
  gy += 4 * Math.floor(days / 1461);
  days %= 1461;
  if (days > 365) {
    gy += Math.floor((days - 1) / 365);
    days = (days - 1) % 365;
  }
  let gd = days + 1;
  const sal_a = [
    0,
    31,
    (gy % 4 === 0 && gy % 100 !== 0) || gy % 400 === 0 ? 29 : 28,
    31,
    30,
    31,
    30,
    31,
    31,
    30,
    31,
    30,
    31,
  ];
  let gm;
  for (gm = 1; gm < 13 && gd > sal_a[gm]; gm++) {
    gd -= sal_a[gm];
  }
  return { gy, gm, gd };
}

/**
 * Checks if a Jalali year is a leap year (کبیسه)
 */
export function isJalaliLeapYear(jy) {
  const g30 = jalaliToGregorian(jy, 12, 30);
  const g1Next = jalaliToGregorian(jy + 1, 1, 1);
  const d30 = new Date(g30.gy, g30.gm - 1, g30.gd);
  const dNext = new Date(g1Next.gy, g1Next.gm - 1, g1Next.gd);
  return dNext.getTime() - d30.getTime() === 86400000;
}

/**
 * Returns number of days in a specific Jalali month
 */
export function getJalaliMonthDays(jy, jm) {
  if (jm <= 6) return 31;
  if (jm <= 11) return 30;
  return isJalaliLeapYear(jy) ? 30 : 29;
}

/**
 * Returns number of days in a specific Gregorian month
 */
export function getGregorianMonthDays(gy, gm) {
  return new Date(gy, gm, 0).getDate();
}

/**
 * Converts JS Date object to Jalali { jy, jm, jd }
 */
export function dateToJalali(date = new Date()) {
  const d = typeof date === 'string' || typeof date === 'number' ? new Date(date) : date;
  if (isNaN(d.getTime())) {
    const fallback = new Date();
    return gregorianToJalali(fallback.getFullYear(), fallback.getMonth() + 1, fallback.getDate());
  }
  return gregorianToJalali(d.getFullYear(), d.getMonth() + 1, d.getDate());
}

/**
 * Converts Jalali { jy, jm, jd, hours, minutes } to JS Date
 */
export function jalaliToDate(jy, jm, jd, hours = 0, minutes = 0) {
  const { gy, gm, gd } = jalaliToGregorian(jy, jm, jd);
  return new Date(gy, gm - 1, gd, hours, minutes, 0, 0);
}

/**
 * Builds the 35 or 42 cell grid for a Shamsi month
 */
export function getShamsiMonthGrid(jy, jm, todayDate = new Date()) {
  const todayJalali = dateToJalali(todayDate);
  const daysInMonth = getJalaliMonthDays(jy, jm);

  // Day of week for 1st of this month
  const firstDayGregorian = jalaliToGregorian(jy, jm, 1);
  const jsDay = new Date(firstDayGregorian.gy, firstDayGregorian.gm - 1, firstDayGregorian.gd).getDay();
  // Saturday = 0, Sunday = 1, ..., Friday = 6
  const startDayOffset = (jsDay + 1) % 7;

  // Previous month details for leading buffer days
  const prevJm = jm === 1 ? 12 : jm - 1;
  const prevJy = jm === 1 ? jy - 1 : jy;
  const daysInPrevMonth = getJalaliMonthDays(prevJy, prevJm);

  const grid = [];

  // 1. Previous month leading days
  for (let i = startDayOffset - 1; i >= 0; i--) {
    const jd = daysInPrevMonth - i;
    const g = jalaliToGregorian(prevJy, prevJm, jd);
    const dayOfWeek = (startDayOffset - 1 - i) % 7;
    grid.push({
      jy: prevJy,
      jm: prevJm,
      jd,
      isCurrentMonth: false,
      isPrevMonth: true,
      isNextMonth: false,
      isToday: todayJalali.jy === prevJy && todayJalali.jm === prevJm && todayJalali.jd === jd,
      isWeekend: dayOfWeek === 6,
      gregorian: g,
    });
  }

  // 2. Current month days
  for (let jd = 1; jd <= daysInMonth; jd++) {
    const g = jalaliToGregorian(jy, jm, jd);
    const dayOfWeek = (startDayOffset + jd - 1) % 7;
    grid.push({
      jy,
      jm,
      jd,
      isCurrentMonth: true,
      isPrevMonth: false,
      isNextMonth: false,
      isToday: todayJalali.jy === jy && todayJalali.jm === jm && todayJalali.jd === jd,
      isWeekend: dayOfWeek === 6,
      gregorian: g,
    });
  }

  // 3. Next month trailing days to fill out the 6-row (42 cells) or 5-row (35 cells) grid
  const nextJm = jm === 12 ? 1 : jm + 1;
  const nextJy = jm === 12 ? jy + 1 : jy;
  const targetLength = grid.length > 35 ? 42 : 35;
  const remaining = targetLength - grid.length;

  for (let jd = 1; jd <= remaining; jd++) {
    const g = jalaliToGregorian(nextJy, nextJm, jd);
    const dayOfWeek = grid.length % 7;
    grid.push({
      jy: nextJy,
      jm: nextJm,
      jd,
      isCurrentMonth: false,
      isPrevMonth: false,
      isNextMonth: true,
      isToday: todayJalali.jy === nextJy && todayJalali.jm === nextJm && todayJalali.jd === jd,
      isWeekend: dayOfWeek === 6,
      gregorian: g,
    });
  }

  return grid;
}

/**
 * Builds the 35 or 42 cell grid for a Gregorian month
 */
export function getGregorianMonthGrid(gy, gm, todayDate = new Date()) {
  const todayGy = todayDate.getFullYear();
  const todayGm = todayDate.getMonth() + 1;
  const todayGd = todayDate.getDate();

  const daysInMonth = getGregorianMonthDays(gy, gm);
  const firstDayJs = new Date(gy, gm - 1, 1).getDay(); // 0 = Sunday

  const prevGm = gm === 1 ? 12 : gm - 1;
  const prevGy = gm === 1 ? gy - 1 : gy;
  const daysInPrevMonth = getGregorianMonthDays(prevGy, prevGm);

  const grid = [];

  // Leading days
  for (let i = firstDayJs - 1; i >= 0; i--) {
    const gd = daysInPrevMonth - i;
    const dayOfWeek = (firstDayJs - 1 - i) % 7;
    grid.push({
      gy: prevGy,
      gm: prevGm,
      gd,
      isCurrentMonth: false,
      isPrevMonth: true,
      isNextMonth: false,
      isToday: todayGy === prevGy && todayGm === prevGm && todayGd === gd,
      isWeekend: dayOfWeek === 0 || dayOfWeek === 6,
    });
  }

  // Current month days
  for (let gd = 1; gd <= daysInMonth; gd++) {
    const dayOfWeek = (firstDayJs + gd - 1) % 7;
    grid.push({
      gy,
      gm,
      gd,
      isCurrentMonth: true,
      isPrevMonth: false,
      isNextMonth: false,
      isToday: todayGy === gy && todayGm === gm && todayGd === gd,
      isWeekend: dayOfWeek === 0 || dayOfWeek === 6,
    });
  }

  // Trailing days
  const nextGm = gm === 12 ? 1 : gm + 1;
  const nextGy = gm === 12 ? gy + 1 : gy;
  const targetLength = grid.length > 35 ? 42 : 35;
  const remaining = targetLength - grid.length;

  for (let gd = 1; gd <= remaining; gd++) {
    const dayOfWeek = grid.length % 7;
    grid.push({
      gy: nextGy,
      gm: nextGm,
      gd,
      isCurrentMonth: false,
      isPrevMonth: false,
      isNextMonth: true,
      isToday: todayGy === nextGy && todayGm === nextGm && todayGd === gd,
      isWeekend: dayOfWeek === 0 || dayOfWeek === 6,
    });
  }

  return grid;
}

/**
 * Returns human-readable relative label for a date (Today, Yesterday, X days ago)
 */
export function getRelativeDayLabel(date, isFa = true) {
  if (!date) return '';
  const d = typeof date === 'string' || typeof date === 'number' ? new Date(date) : date;
  if (isNaN(d.getTime())) return '';

  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const target = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const diffDays = Math.round((today.getTime() - target.getTime()) / (1000 * 60 * 60 * 24));

  if (diffDays === 0) {
    return isFa ? 'امروز' : 'Today';
  }
  if (diffDays === 1) {
    return isFa ? 'دیروز' : 'Yesterday';
  }
  if (diffDays === -1) {
    return isFa ? 'فردا' : 'Tomorrow';
  }
  if (diffDays > 1 && diffDays <= 7) {
    return isFa ? `${diffDays} روز پیش` : `${diffDays} days ago`;
  }
  if (diffDays > 7 && diffDays <= 30) {
    const weeks = Math.floor(diffDays / 7);
    return isFa ? `${weeks} هفته پیش` : `${weeks} wk ago`;
  }
  return '';
}
