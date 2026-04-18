/** Visit/session times use 24h "HH:mm". Returns true for times strictly before 12:00. */
export function isStrictlyBeforeNoon(time: string): boolean {
  const m = String(time).trim().match(/^(\d{1,2}):(\d{2})/);
  if (!m) return false;
  const h = parseInt(m[1], 10);
  const min = parseInt(m[2], 10);
  if (Number.isNaN(h) || Number.isNaN(min)) return false;
  return h * 60 + min < 12 * 60;
}
