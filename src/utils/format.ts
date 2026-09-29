/**
 * Shared formatting helpers. Keep locale/currency formatting centralized so
 * every screen displays numbers and money the same way.
 */

/** Formats an integer with thousands separators, e.g. 14985 -> "14,985". */
export function formatNumber(value: number): string {
  return Math.round(value).toLocaleString('en-US');
}

/**
 * Formats a value as Nigerian Naira, e.g. 125000 -> "₦125,000".
 * StitchPro's pricing tools (Cost Calculator, Jobs) always quote in NGN.
 */
export function formatNGN(value: number): string {
  const rounded = Math.round(value);
  return `₦${rounded.toLocaleString('en-NG')}`;
}

/** Formats a byte count into a human string, e.g. 1843200 -> "1.8 MB". */
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const units = ['KB', 'MB', 'GB'];
  let value = bytes / 1024;
  let unitIndex = 0;
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }
  return `${value.toFixed(1)} ${units[unitIndex]}`;
}
