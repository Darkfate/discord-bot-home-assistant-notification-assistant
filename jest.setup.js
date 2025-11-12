// Jest setup file for global test configuration

// Mock console methods to reduce noise in tests (optional)
global.console = {
  ...console,
  log: () => {},
  error: () => {},
  warn: () => {},
  info: () => {},
  debug: () => {},
};
