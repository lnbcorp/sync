export function generateCode() {
  // 6-digit numeric code, pad leading zeros
  const n = Math.floor(Math.random() * 1000000);
  return String(n).padStart(6, '0');
}
