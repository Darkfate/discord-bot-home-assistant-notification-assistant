/**
 * Date Parser Utility
 *
 * Parses human-readable time strings into Date objects for scheduling notifications.
 *
 * Supported formats:
 * - "now" or "immediate" → current time
 * - "5m" or "5 minutes" → 5 minutes from now
 * - "2h" or "2 hours" → 2 hours from now
 * - "1d" or "1 day" → 1 day from now
 * - "2024-12-25T10:00:00Z" → ISO 8601 date string
 * - Date object → returned as-is
 */

/**
 * Parse a scheduled time input into a Date object
 *
 * @param input - Time string or Date object
 * @returns Parsed Date object
 * @throws Error if the input format is invalid
 */
export function parseScheduledTime(input: string | Date): Date {
  // If already a Date object, return it
  if (input instanceof Date) {
    return input;
  }

  const now = new Date();

  // Handle "now" or "immediate"
  if (input === 'now' || input === 'immediate') {
    return now;
  }

  // Handle relative time formats: "5m", "2h", "1d"
  const shortRelativeMatch = input.match(/^(\d+)(m|h|d)$/);
  if (shortRelativeMatch) {
    const value = parseInt(shortRelativeMatch[1], 10);
    const unit = shortRelativeMatch[2];

    switch (unit) {
      case 'm':
        return new Date(now.getTime() + value * 60 * 1000);
      case 'h':
        return new Date(now.getTime() + value * 60 * 60 * 1000);
      case 'd':
        return new Date(now.getTime() + value * 24 * 60 * 60 * 1000);
    }
  }

  // Handle long-form relative time: "5 minutes", "2 hours", "1 day"
  const longRelativeMatch = input.match(/^(\d+)\s+(minute|minutes|hour|hours|day|days)$/i);
  if (longRelativeMatch) {
    const value = parseInt(longRelativeMatch[1], 10);
    const unit = longRelativeMatch[2].toLowerCase();

    if (unit.startsWith('minute')) {
      return new Date(now.getTime() + value * 60 * 1000);
    } else if (unit.startsWith('hour')) {
      return new Date(now.getTime() + value * 60 * 60 * 1000);
    } else if (unit.startsWith('day')) {
      return new Date(now.getTime() + value * 24 * 60 * 60 * 1000);
    }
  }

  // Handle ISO string or other date formats
  try {
    const parsed = new Date(input);
    if (isNaN(parsed.getTime())) {
      throw new Error(`Invalid date format: ${input}`);
    }
    return parsed;
  } catch (error) {
    throw new Error(`Unable to parse date: ${input}`);
  }
}

/**
 * Format a Date object into a human-readable relative time string
 *
 * @param date - Date to format
 * @returns Human-readable string (e.g., "in 5 minutes", "in 2 hours")
 */
export function formatRelativeTime(date: Date): string {
  const now = new Date();
  const diffMs = date.getTime() - now.getTime();

  if (diffMs < 0) {
    return 'overdue';
  }

  const diffMinutes = Math.floor(diffMs / (60 * 1000));
  const diffHours = Math.floor(diffMs / (60 * 60 * 1000));
  const diffDays = Math.floor(diffMs / (24 * 60 * 60 * 1000));

  if (diffMinutes < 1) {
    return 'in less than a minute';
  } else if (diffMinutes < 60) {
    return `in ${diffMinutes} minute${diffMinutes === 1 ? '' : 's'}`;
  } else if (diffHours < 24) {
    return `in ${diffHours} hour${diffHours === 1 ? '' : 's'}`;
  } else {
    return `in ${diffDays} day${diffDays === 1 ? '' : 's'}`;
  }
}
