/**
 * Format numerical amounts to Indian Rupee (INR) format
 */
export function formatCurrency(amount, showSign = false) {
  if (amount === undefined || amount === null || isNaN(amount)) {
    return '₹0.00';
  }

  const absAmount = Math.abs(amount);
  const formatted = new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(absAmount);

  if (showSign) {
    if (amount > 0) return `+${formatted}`;
    if (amount < 0) return `-${formatted}`;
  }
  return formatted;
}

/**
 * Format ISO date string or timestamp into a clean human readable string with full date & time
 */
export function formatDate(isoString) {
  if (!isoString) return '';
  const date = new Date(isoString);
  if (isNaN(date.getTime())) return String(isoString);

  const now = new Date();
  const isToday =
    date.getDate() === now.getDate() &&
    date.getMonth() === now.getMonth() &&
    date.getFullYear() === now.getFullYear();

  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  const isYesterday =
    date.getDate() === yesterday.getDate() &&
    date.getMonth() === yesterday.getMonth() &&
    date.getFullYear() === yesterday.getFullYear();

  const timeStr = date.toLocaleTimeString('en-IN', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });

  const dayStr = date.toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
  });

  if (isToday) {
    return `Today, ${timeStr} (${dayStr})`;
  }
  if (isYesterday) {
    return `Yesterday, ${timeStr} (${dayStr})`;
  }

  const weekday = date.toLocaleDateString('en-IN', { weekday: 'short' });
  const yearStr = date.getFullYear() !== now.getFullYear() ? ` ${date.getFullYear()}` : '';

  return `${weekday}, ${dayStr}${yearStr} • ${timeStr}`;
}

/**
 * Short date formatting with time for compact table / report views
 */
export function formatShortDate(isoString) {
  if (!isoString) return '';
  const date = new Date(isoString);
  if (isNaN(date.getTime())) return String(isoString);

  const dayStr = date.toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: '2-digit',
  });

  const timeStr = date.toLocaleTimeString('en-IN', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });

  return `${dayStr}, ${timeStr}`;
}
