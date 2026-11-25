// --- Gregorian formatting ---
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
export const WEEKDAYS_LONG = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
export const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
export const MONTHS_LONG =['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

export function headerDate(d: Date) {
  return `${WEEKDAYS[d.getDay()]} ${d.getDate()} ${MONTHS[d.getMonth()]}`;
}

export function monthKey(ms: number) {
  const d = new Date(ms);
  return `${d.getFullYear()}-${d.getMonth()}`;
}

export function monthLabel(ms: number) {
  const d = new Date(ms);
  return `${MONTHS_LONG[d.getMonth()]} ${d.getFullYear()}`;
}

export function sameDay(a: number, b: number) {
  const x = new Date(a), y = new Date(b);
  return x.getFullYear() === y.getFullYear() && x.getMonth() === y.getMonth() && x.getDate() === y.getDate();
}

// Day column: "24" over "Today" / "Tue" / "2019"
export function dayParts(ms: number, now = Date.now()) {
  const d = new Date(ms);
  const n = new Date(now);
  let sub = WEEKDAYS[d.getDay()];
  if (sameDay(ms, now)) sub = 'Today';
  else if (d.getFullYear() !== n.getFullYear()) sub = `${MONTHS[d.getMonth()]} '${String(d.getFullYear()).slice(2)}`;
  return { day: String(d.getDate()), sub };
}

// "12 Mar" this year, "12 Mar 2019" otherwise
export function shortDate(ms: number, now = Date.now()) {
  const d = new Date(ms);
  const base = `${d.getDate()} ${MONTHS[d.getMonth()]}`;
  return d.getFullYear() === new Date(now).getFullYear() ? base : `${base} ${d.getFullYear()}`;
}

// "Friday 12 March 2027"
export function fullDate(ms: number) {
  const d = new Date(ms);
  return `${WEEKDAYS_LONG[d.getDay()]} ${d.getDate()} ${MONTHS_LONG[d.getMonth()]} ${d.getFullYear()}`;
}

export function startOfDay(ms: number) {
  const d = new Date(ms);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

export function longDate(ms: number) {
  const d = new Date(ms);
  const h = d.getHours(), m = String(d.getMinutes()).padStart(2, '0');
  return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}, ${h}:${m}`;
}

export function relativeTime(ms: number, now = Date.now()) {
  const s = Math.round((now - ms) / 1000);
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  if (s < 86400) return `${Math.floor(s / 3600)} h ago`;
  return `${Math.floor(s / 86400)} d ago`;
}

// --- Hijri date (tabular Islamic calendar, adjustable by ±2 days to match your masjid) ---
const HIJRI_AR = ['محرم', 'صفر', 'ربيع الأول', 'ربيع الآخر', 'جمادى الأولى', 'جمادى الآخرة', 'رجب', 'شعبان', 'رمضان', 'شوال', 'ذو القعدة', 'ذو الحجة'];
const HIJRI_EN = ['Muharram', 'Safar', 'Rabi al-Awwal', 'Rabi al-Akhir', 'Jumada al-Ula', 'Jumada al-Akhirah', 'Rajab', 'Shaban', 'Ramadan', 'Shawwal', 'Dhu al-Qadah', 'Dhu al-Hijjah'];
const AR_DIGITS = '٠١٢٣٤٥٦٧٨٩';

function toArabicDigits(n: number) {
  return String(n).replace(/\d/g, (x) => AR_DIGITS[Number(x)]);
}

// Julian day number of a local calendar date
function jdn(y: number, m: number, d: number) {
  const a = Math.floor((14 - m) / 12);
  const yy = y + 4800 - a;
  const mm = m + 12 * a - 3;
  return d + Math.floor((153 * mm + 2) / 5) + 365 * yy + Math.floor(yy / 4) - Math.floor(yy / 100) + Math.floor(yy / 400) - 32045;
}

export function hijri(date: Date, adjustDays = 0) {
  let l = jdn(date.getFullYear(), date.getMonth() + 1, date.getDate()) + adjustDays - 1948440 + 10632;
  const n = Math.floor((l - 1) / 10631);
  l = l - 10631 * n + 354;
  const j = Math.floor((10985 - l) / 5316) * Math.floor((50 * l) / 17719) + Math.floor(l / 5670) * Math.floor((43 * l) / 15238);
  l = l - Math.floor((30 - j) / 15) * Math.floor((17719 * j) / 50) - Math.floor(j / 16) * Math.floor((15238 * j) / 43) + 29;
  const month = Math.floor((24 * l) / 709);
  const day = l - Math.floor((709 * month) / 24);
  const year = 30 * n + j - 30;
  return {
    day, month, year,
    arabic: `${toArabicDigits(day)} ${HIJRI_AR[month - 1]} ${toArabicDigits(year)}`,
    english: `${day} ${HIJRI_EN[month - 1]} ${year}`,
  };
}
