import fs from 'fs';
import path from 'path';
import EventLogger from '../services/event-logger';

const logFilePath = path.join(__dirname, '../../event-log.jsonl');

describe('EventLogger', () => {
  beforeEach(() => {
    // Clear the log file before each test
    if (fs.existsSync(logFilePath)) {
      fs.unlinkSync(logFilePath);
    }
    // Reset the singleton instance for testing
    jest.resetModules();
  });

  it('should append events to the log file', () => {
    const eventLogger = require('../services/event-logger').default;
    eventLogger.logEvent('TEST_EVENT_1', { data: 'test1' });
    eventLogger.logEvent('TEST_EVENT_2', { data: 'test2' });

    const fileContent = fs.readFileSync(logFilePath, 'utf-8');
    const lines = fileContent.split('\n').filter(Boolean);

    expect(lines.length).toBe(2);
    const event1 = JSON.parse(lines[0]);
    const event2 = JSON.parse(lines[1]);

    expect(event1.eventType).toBe('TEST_EVENT_1');
    expect(event1.data.data).toBe('test1');
    expect(event2.eventType).toBe('TEST_EVENT_2');
    expect(event2.data.data).toBe('test2');
  });

  it('should load existing events from the log file on initialization', () => {
    // Pre-populate the log file
    const initialEvent = {
      timestamp: new Date().toISOString(),
      eventType: 'PRE_EXISTING_EVENT',
      gameId: null,
      data: {},
      sequence: 0,
    };
    fs.writeFileSync(logFilePath, JSON.stringify(initialEvent) + '\n');

    const eventLogger = require('../services/event-logger').default;
    const events = eventLogger.getEvents();

    expect(events.length).toBe(1);
    expect(events[0].eventType).toBe('PRE_EXISTING_EVENT');

    eventLogger.logEvent('NEW_EVENT', { data: 'new' });

    const fileContent = fs.readFileSync(logFilePath, 'utf-8');
    const lines = fileContent.split('\n').filter(Boolean);

    expect(lines.length).toBe(2);
  });

  it('should clear the log file', () => {
    const eventLogger = require('../services/event-logger').default;
    eventLogger.logEvent('TEST_EVENT_1', { data: 'test1' });
    eventLogger.clear();

    const fileContent = fs.readFileSync(logFilePath, 'utf-8');
    expect(fileContent).toBe('');
    expect(eventLogger.getEvents().length).toBe(0);
  });
});
