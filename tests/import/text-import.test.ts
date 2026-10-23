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

  it('unfolds calendar lines and converts TZID event times to UTC without recurrence expansion',()=>{
    const ics='BEGIN:VCALENDAR\r\nBEGIN:VEVENT\r\nUID:abc\r\nSUMMARY:Long calendar\r\n event\r\nDESCRIPTION:First\\nSecond\r\nDTSTART;TZID=Asia/Kolkata:20241012T093000\r\nRRULE:FREQ=DAILY;COUNT=4\r\nEND:VEVENT\r\nEND:VCALENDAR';
    const items=parseTextImport('events.ics',ics);
    expect(items).toHaveLength(1);
    expect(items[0].title).toBe('Long calendarevent');
    expect(items[0].content).toBe('First\nSecond');
    expect(items[0].occurredAt).toBe('2024-10-12T04:00:00.000Z');
    const later=ics.replace('20241012T093000','20241013T093000');
    expect(parseTextImport('events.ics',later)[0].captureKey).not.toBe(items[0].captureKey);
  });

  it('rejects unsupported formats and malformed calendars',()=>{
    expect(()=>parseTextImport('data.csv','x')).toThrow('Unsupported import type');
    expect(()=>parseTextImport('empty.ics','BEGIN:VCALENDAR\nEND:VCALENDAR')).toThrow('No VEVENT');
    expect(()=>parseTextImport('empty.html','<html></html>')).toThrow('No HTTP or HTTPS bookmarks');
  });
});
