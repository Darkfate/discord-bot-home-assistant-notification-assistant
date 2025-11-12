import { type ClassValue, clsx } from "clsx";

export function cn(...inputs: ClassValue[]) {
  return clsx(inputs);
}

export function formatDate(date: string | null): string {
  if (!date) return 'N/A';
  return new Date(date).toLocaleString();
}

export function formatRelativeTime(date: string | null): string {
  if (!date) return 'N/A';

  const now = new Date();
  const target = new Date(date);
  const diffMs = target.getTime() - now.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMs < 0) {
    // Past time
    const absDiffMins = Math.abs(diffMins);
    const absDiffHours = Math.abs(diffHours);
    const absDiffDays = Math.abs(diffDays);

    if (absDiffMins < 1) return 'just now';
    if (absDiffMins < 60) return `${absDiffMins} minute${absDiffMins > 1 ? 's' : ''} ago`;
    if (absDiffHours < 24) return `${absDiffHours} hour${absDiffHours > 1 ? 's' : ''} ago`;
    return `${absDiffDays} day${absDiffDays > 1 ? 's' : ''} ago`;
  } else {
    // Future time
    if (diffMins < 1) return 'in less than a minute';
    if (diffMins < 60) return `in ${diffMins} minute${diffMins > 1 ? 's' : ''}`;
    if (diffHours < 24) return `in ${diffHours} hour${diffHours > 1 ? 's' : ''}`;
    return `in ${diffDays} day${diffDays > 1 ? 's' : ''}`;
  }
}

export function getStatusColor(status: string): string {
  switch (status) {
    case 'pending':
      return 'bg-blue-100 text-blue-800 border-blue-300';
    case 'processing':
      return 'bg-purple-100 text-purple-800 border-purple-300';
    case 'sent':
      return 'bg-green-100 text-green-800 border-green-300';
    case 'failed':
      return 'bg-red-100 text-red-800 border-red-300';
    case 'cancelled':
      return 'bg-gray-100 text-gray-800 border-gray-300';
    default:
      return 'bg-gray-100 text-gray-800 border-gray-300';
  }
}

export function getSeverityColor(severity: string): string {
  switch (severity) {
    case 'info':
      return 'bg-blue-500 text-white';
    case 'warning':
      return 'bg-amber-500 text-white';
    case 'error':
      return 'bg-red-500 text-white';
    default:
      return 'bg-blue-500 text-white';
  }
}

export function getHealthColor(health: string): string {
  switch (health) {
    case 'healthy':
      return 'text-green-600';
    case 'degraded':
      return 'text-amber-600';
    case 'unhealthy':
      return 'text-red-600';
    default:
      return 'text-gray-600';
  }
}

export function getHealthIcon(health: string): string {
  switch (health) {
    case 'healthy':
      return '🟢';
    case 'degraded':
      return '🟡';
    case 'unhealthy':
      return '🔴';
    default:
      return '⚪';
  }
}
