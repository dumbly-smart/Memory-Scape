import { describe,expect,it } from 'vitest';
import { parseTextImport } from '../../lib/text-import';

describe('text import parsers',()=>{
  it('reads Markdown frontmatter and gives undated notes a stable duplicate key',()=>{
    const markdown='---\ntitle: River walk\noccurred_at: 2024-04-03T10:30:00Z\n---\n# Notes\n\nRemember the footbridge.';
    const item=parseTextImport('walk.md',markdown)[0];
    expect(item.title).toBe('River walk');
    expect(item.occurredAt).toBe('2024-04-03T10:30:00.000Z');
    expect(parseTextImport('walk.md',markdown)[0].captureKey).toBe(item.captureKey);
    const undated='# A stable note\n\nIts text does not change.';
    expect(parseTextImport('note.md',undated)[0].captureKey).toBe(parseTextImport('note.md',undated)[0].captureKey);
  });

  it('parses Netscape bookmark links and ignores unsafe schemes',()=>{
    const items=parseTextImport('bookmarks.html','<DL><A HREF="javascript:alert(1)">unsafe</A><A HREF="https://example.test/a">Useful &amp; clear</A></DL>');
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({title:'Useful & clear',sourceUrl:'https://example.test/a'});
  });

  it('expands bounded calendar recurrences and converts TZID event times to UTC',()=>{
    const ics='BEGIN:VCALENDAR\r\nBEGIN:VEVENT\r\nUID:abc\r\nSUMMARY:Long calendar\r\n event\r\nDESCRIPTION:First\\nSecond\r\nDTSTART;TZID=Asia/Kolkata:20241012T093000\r\nRRULE:FREQ=DAILY;COUNT=4\r\nEND:VEVENT\r\nEND:VCALENDAR';
    const items=parseTextImport('events.ics',ics);
    expect(items).toHaveLength(4);
    expect(items[0].title).toBe('Long calendarevent');
    expect(items[0].content).toBe('First\nSecond');
    expect(items.map(item=>item.occurredAt)).toEqual([
      '2024-10-12T04:00:00.000Z',
      '2024-10-13T04:00:00.000Z',
      '2024-10-14T04:00:00.000Z',
      '2024-10-15T04:00:00.000Z',
    ]);
    const later=ics.replace('20241012T093000','20241013T093000');
    expect(parseTextImport('events.ics',later)[0].captureKey).not.toBe(items[0].captureKey);
  });

  it('preserves local wall time across daylight-saving changes and applies EXDATE',()=>{
    const ics=['BEGIN:VCALENDAR','BEGIN:VEVENT','SUMMARY:Morning walk','DTSTART;TZID=America/New_York:20250302T090000','RRULE:FREQ=WEEKLY;COUNT=4','EXDATE;TZID=America/New_York:20250309T090000','END:VEVENT','END:VCALENDAR'].join('\n');
    const items=parseTextImport('dst.ics',ics);
    expect(items.map(item=>item.occurredAt)).toEqual(['2025-03-02T14:00:00.000Z','2025-03-16T13:00:00.000Z','2025-03-23T13:00:00.000Z']);
  });

  it('bounds open-ended recurring series to one year before and after the reference date',()=>{
    const ics=['BEGIN:VCALENDAR','BEGIN:VEVENT','SUMMARY:Weekly reflection','DTSTART:20240101T090000Z','RRULE:FREQ=WEEKLY','END:VEVENT','END:VCALENDAR'].join('\n');
    const items=parseTextImport('open-series.ics',ics,new Date('2024-06-01T00:00:00Z'));
    expect(items.length).toBeGreaterThan(70);
    expect(items.length).toBeLessThan(80);
    expect(items[0].occurredAt).toBe('2024-01-01T09:00:00.000Z');
    expect(items.at(-1)?.occurredAt).toBe('2025-05-26T09:00:00.000Z');
  });

  it('rejects unsupported formats and malformed calendars',()=>{
    expect(()=>parseTextImport('data.csv','x')).toThrow('Unsupported import type');
    expect(()=>parseTextImport('empty.ics','BEGIN:VCALENDAR\nEND:VCALENDAR')).toThrow('No VEVENT');
    expect(()=>parseTextImport('empty.html','<html></html>')).toThrow('No HTTP or HTTPS bookmarks');
  });
});
