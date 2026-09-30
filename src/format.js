/**
 * Clock times in ProSource house style (2026 brand guide, Writing and
 * Editorial Style): lowercase with a space and periods, always with minutes.
 * "9:00 a.m.", "3:30 p.m.", never "9am" or "3:30 PM".
 */
export const formatTime = (value) => {
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  const h = d.getHours();
  const m = String(d.getMinutes()).padStart(2, '0');
  return `${h % 12 || 12}:${m} ${h < 12 ? 'a.m.' : 'p.m.'}`;
};
