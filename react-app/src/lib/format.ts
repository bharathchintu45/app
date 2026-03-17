export function digitsOnly(s: string) {
  let out = "";
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (c >= "0" && c <= "9") out += c;
  }
  return out;
}

export function clamp(n: number, min: number, max: number) {
  return Math.min(Math.max(n, min), max);
}

export function padZero(n: number) {
  return n < 10 ? "0" + n : String(n);
}

export function formatINR(amount: number) {
  return "₹" + amount.toLocaleString("en-IN");
}

export function formatDateTimeIndia(isoStringOrTimestamp: string | number) {
  if (!isoStringOrTimestamp) return "—";
  const d = new Date(isoStringOrTimestamp);
  if (isNaN(d.getTime())) return String(isoStringOrTimestamp);
  return d.toLocaleString("en-IN", {
    timeZone: "Asia/Kolkata",
    day: "2-digit",
    month: "2-digit",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

export function formatTimeIndia(isoStringOrTimestamp: string | number) {
  if (!isoStringOrTimestamp) return "—";
  const d = new Date(isoStringOrTimestamp);
  if (isNaN(d.getTime())) return String(isoStringOrTimestamp);
  return d.toLocaleTimeString("en-IN", {
    timeZone: "Asia/Kolkata",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

export function formatDateIndia(isoStringOrTimestamp: string | number) {
  if (!isoStringOrTimestamp) return "—";
  const d = new Date(isoStringOrTimestamp);
  if (isNaN(d.getTime())) return String(isoStringOrTimestamp);
  return d.toLocaleDateString("en-IN", {
    timeZone: "Asia/Kolkata",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

export function dayKey(d: Date) {
  return `${d.getFullYear()}-${padZero(d.getMonth() + 1)}-${padZero(d.getDate())}`;
}

export function addDays(date: Date, days: number) {
  const n = new Date(date.getTime());
  n.setDate(n.getDate() + days);
  return n;
}

export function parseDateKeyToDate(dk: string) {
  const [y, m, d] = dk.split("-").map(Number);
  if (!y || !m || !d) return new Date();
  return new Date(y, m - 1, d);
}

export function slotLabel(s: import("../types").Slot) {
  if (s === "Slot1") return "Breakfast";
  if (s === "Slot2") return "Lunch";
  if (s === "Slot3") return "Dinner";
  return s;
}
