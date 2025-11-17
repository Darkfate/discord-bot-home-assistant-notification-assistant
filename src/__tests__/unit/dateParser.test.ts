import { describe, it, expect } from '@jest/globals';
import { parseScheduledTime, formatRelativeTime } from '../../utils/dateParser.js';

describe('dateParser', () => {
  describe('parseScheduledTime', () => {
    it('should return Date object as-is', () => {
      const date = new Date('2024-12-25T10:00:00Z');
      const result = parseScheduledTime(date);
      expect(result).toBe(date);
    });

    it('should handle "now"', () => {
      const before = Date.now();
      const result = parseScheduledTime('now');
      const after = Date.now();

      expect(result.getTime()).toBeGreaterThanOrEqual(before);
      expect(result.getTime()).toBeLessThanOrEqual(after);
    });

    it('should handle "immediate"', () => {
      const before = Date.now();
      const result = parseScheduledTime('immediate');
      const after = Date.now();

      expect(result.getTime()).toBeGreaterThanOrEqual(before);
      expect(result.getTime()).toBeLessThanOrEqual(after);
    });

    it('should parse "5m" correctly', () => {
      const before = Date.now() + 5 * 60 * 1000;
      const result = parseScheduledTime('5m');
      const after = Date.now() + 5 * 60 * 1000;

      expect(result.getTime()).toBeGreaterThanOrEqual(before - 100);
      expect(result.getTime()).toBeLessThanOrEqual(after + 100);
    });

    it('should parse "2h" correctly', () => {
      const before = Date.now() + 2 * 60 * 60 * 1000;
      const result = parseScheduledTime('2h');
      const after = Date.now() + 2 * 60 * 60 * 1000;

      expect(result.getTime()).toBeGreaterThanOrEqual(before - 100);
      expect(result.getTime()).toBeLessThanOrEqual(after + 100);
    });

    it('should parse "1d" correctly', () => {
      const before = Date.now() + 24 * 60 * 60 * 1000;
      const result = parseScheduledTime('1d');
      const after = Date.now() + 24 * 60 * 60 * 1000;

      expect(result.getTime()).toBeGreaterThanOrEqual(before - 100);
      expect(result.getTime()).toBeLessThanOrEqual(after + 100);
    });

    it('should parse "5 minutes" correctly', () => {
      const before = Date.now() + 5 * 60 * 1000;
      const result = parseScheduledTime('5 minutes');
      const after = Date.now() + 5 * 60 * 1000;

      expect(result.getTime()).toBeGreaterThanOrEqual(before - 100);
      expect(result.getTime()).toBeLessThanOrEqual(after + 100);
    });

    it('should parse "1 minute" correctly', () => {
      const before = Date.now() + 60 * 1000;
      const result = parseScheduledTime('1 minute');
      const after = Date.now() + 60 * 1000;

      expect(result.getTime()).toBeGreaterThanOrEqual(before - 100);
      expect(result.getTime()).toBeLessThanOrEqual(after + 100);
    });

    it('should parse "2 hours" correctly', () => {
      const before = Date.now() + 2 * 60 * 60 * 1000;
      const result = parseScheduledTime('2 hours');
      const after = Date.now() + 2 * 60 * 60 * 1000;

      expect(result.getTime()).toBeGreaterThanOrEqual(before - 100);
      expect(result.getTime()).toBeLessThanOrEqual(after + 100);
    });

    it('should parse "1 hour" correctly', () => {
      const before = Date.now() + 60 * 60 * 1000;
      const result = parseScheduledTime('1 hour');
      const after = Date.now() + 60 * 60 * 1000;

      expect(result.getTime()).toBeGreaterThanOrEqual(before - 100);
      expect(result.getTime()).toBeLessThanOrEqual(after + 100);
    });

    it('should parse "3 days" correctly', () => {
      const before = Date.now() + 3 * 24 * 60 * 60 * 1000;
      const result = parseScheduledTime('3 days');
      const after = Date.now() + 3 * 24 * 60 * 60 * 1000;

      expect(result.getTime()).toBeGreaterThanOrEqual(before - 100);
      expect(result.getTime()).toBeLessThanOrEqual(after + 100);
    });

    it('should parse "1 day" correctly', () => {
      const before = Date.now() + 24 * 60 * 60 * 1000;
      const result = parseScheduledTime('1 day');
      const after = Date.now() + 24 * 60 * 60 * 1000;

      expect(result.getTime()).toBeGreaterThanOrEqual(before - 100);
      expect(result.getTime()).toBeLessThanOrEqual(after + 100);
    });

    it('should parse ISO date string', () => {
      const result = parseScheduledTime('2024-12-25T10:00:00Z');
      expect(result.toISOString()).toBe('2024-12-25T10:00:00.000Z');
    });

    it('should throw error for invalid format', () => {
      expect(() => parseScheduledTime('invalid')).toThrow('Unable to parse date');
    });

    it('should throw error for invalid relative format', () => {
      expect(() => parseScheduledTime('abc123')).toThrow('Unable to parse date');
    });
  });

  describe('formatRelativeTime', () => {
    it('should return "overdue" for past dates', () => {
      const pastDate = new Date(Date.now() - 1000);
      expect(formatRelativeTime(pastDate)).toBe('overdue');
    });

    it('should return "in less than a minute" for very soon', () => {
      const soonDate = new Date(Date.now() + 30 * 1000);
      expect(formatRelativeTime(soonDate)).toBe('in less than a minute');
    });

    it('should format minutes correctly', () => {
      // Add 500ms buffer to prevent timing issues causing rounding down
      const date = new Date(Date.now() + 5 * 60 * 1000 + 500);
      expect(formatRelativeTime(date)).toBe('in 5 minutes');
    });

    it('should format single minute correctly', () => {
      // Add 500ms buffer to prevent timing issues causing rounding down
      const date = new Date(Date.now() + 1 * 60 * 1000 + 500);
      expect(formatRelativeTime(date)).toBe('in 1 minute');
    });

    it('should format hours correctly', () => {
      // Add 500ms buffer to prevent timing issues causing rounding down
      const date = new Date(Date.now() + 2 * 60 * 60 * 1000 + 500);
      expect(formatRelativeTime(date)).toBe('in 2 hours');
    });

    it('should format single hour correctly', () => {
      // Add 500ms buffer to prevent timing issues causing rounding down
      const date = new Date(Date.now() + 1 * 60 * 60 * 1000 + 500);
      expect(formatRelativeTime(date)).toBe('in 1 hour');
    });

    it('should format days correctly', () => {
      // Add 500ms buffer to prevent timing issues causing rounding down
      const date = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000 + 500);
      expect(formatRelativeTime(date)).toBe('in 3 days');
    });

    it('should format single day correctly', () => {
      // Add 500ms buffer to prevent timing issues causing rounding down
      const date = new Date(Date.now() + 1 * 24 * 60 * 60 * 1000 + 500);
      expect(formatRelativeTime(date)).toBe('in 1 day');
    });
  });
});
