import { createHash } from 'node:crypto';

export type ImportedMemory = { captureKey: string; title: string; content: string; occurredAt: string; sourceUrl?: string; sourceTitle?: string; format: 'markdown'|'text'|'bookmark'|'calendar' };

function keyFor(value: Omit<ImportedMemory, 'captureKey'>, includeEventTime=true): string {
  const bytes = createHash('sha256').update(JSON.stringify([value.format,value.title,value.content,value.sourceUrl ?? null,includeEventTime?value.occurredAt:null])).digest();
  bytes[6] = (bytes[6] & 0x0f) | 0x50;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = bytes.subarray(0,16).toString('hex');
  return `${hex.slice(0,8)}-${hex.slice(8,12)}-${hex.slice(12,16)}-${hex.slice(16,20)}-${hex.slice(20)}`;
}

function create(value: Omit<ImportedMemory, 'captureKey'>, includeEventTime=true): ImportedMemory {
  if (!value.title.trim()) value.title = 'Imported memory';
  if (value.content.length > 1_000_000) throw new Error('An imported entry exceeds the 1 MiB per-memory limit');
  return { ...value, captureKey: keyFor(value,includeEventTime) };
}

function decodeEntities(text: string): string {
  return text.replace(/&(#x[\da-f]+|#\d+|amp|lt|gt|quot|apos|nbsp);/gi, (_, entity: string) => {
    const named: Record<string,string> = { amp:'&',lt:'<',gt:'>',quot:'"',apos:"'",nbsp:' ' };
    if (entity[0] !== '#') return named[entity.toLowerCase()] ?? _;
    const code = entity[1]?.toLowerCase() === 'x' ? Number.parseInt(entity.slice(2),16) : Number.parseInt(entity.slice(1),10);
    return Number.isFinite(code) && code >= 0 && code <= 0x10ffff ? String.fromCodePoint(code) : _;
  });
}

function parseMarkdown(filename: string, source: string): ImportedMemory[] {
  let body = source;
  let metadata = '';
  const frontmatter = /^---\s*\r?\n([\s\S]*?)\r?\n---\s*\r?\n?/.exec(body);
  if (frontmatter) { metadata = frontmatter[1]; body = body.slice(frontmatter[0].length); }
  const frontmatterTitle=/^title:\s*["']?(.+?)["']?\s*$/mi.exec(metadata)?.[1]?.trim();
  const title = frontmatterTitle ?? /^\s*#\s+(.+?)\s*$/m.exec(body)?.[1]?.trim() ?? body.split(/\r?\n/).find(line => line.trim())?.replace(/^\s*[-*#>]+\s*/, '').trim() ?? filename.replace(/\.(md|markdown|txt)$/i,'');
  const dateValue = /^occurred_at:\s*["']?(.+?)["']?\s*$/mi.exec(metadata)?.[1]?.trim();
  const occurredAt = dateValue && Number.isFinite(Date.parse(dateValue)) ? new Date(dateValue).toISOString() : new Date().toISOString();
  return [create({ title: title.slice(0,500), content: body.trim(), occurredAt, format: /\.txt$/i.test(filename) ? 'text' : 'markdown' },Boolean(dateValue))];
}

function parseBookmarks(source: string): ImportedMemory[] {
  const output: ImportedMemory[] = [];
  const anchor = /<a\b([^>]*)>([\s\S]*?)<\/a\s*>/gi;
  for (const match of source.matchAll(anchor)) {
    const href = /\bhref\s*=\s*(["'])(.*?)\1/i.exec(match[1])?.[2] ?? /\bhref\s*=\s*([^\s>]+)/i.exec(match[1])?.[1];
    if (!href) continue;
    let url: URL;
    try { url = new URL(decodeEntities(href)); } catch { continue; }
    if (!['http:','https:'].includes(url.protocol)) continue;
    const title = decodeEntities(match[2].replace(/<[^>]*>/g,' ').replace(/\s+/g,' ').trim()) || url.hostname;
    const addDate = /\badd_date\s*=\s*(["']?)(\d+)\1/i.exec(match[1])?.[2];
    const occurredAt = addDate ? new Date(Number(addDate) * 1000).toISOString() : new Date().toISOString();
    output.push(create({ title: title.slice(0,500), content: `Saved bookmark: ${url.href}`, occurredAt, sourceUrl: url.href, sourceTitle: title, format:'bookmark' },false));
  }
  if (!output.length) throw new Error('No HTTP or HTTPS bookmarks were found in this HTML file');
  return output;
}

function unescapeIcs(value: string): string { return value.replace(/\\[nN]/g,'\n').replace(/\\,/g,',').replace(/\\;/g,';').replace(/\\\\/g,'\\'); }
function dateFromIcs(value: string, tzid?: string): string {
  if (/^\d{8}$/.test(value)) return `${value.slice(0,4)}-${value.slice(4,6)}-${value.slice(6,8)}T00:00:00.000Z`;
  const match = /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})(Z)?$/.exec(value);
  if (!match) throw new Error(`Unsupported iCalendar date: ${value}`);
  const [,year,month,day,hour,minute,second,zulu] = match;
  const target = Date.UTC(+year,+month-1,+day,+hour,+minute,+second);
  if (zulu || !tzid) return new Date(target).toISOString(); // floating times without TZID use UTC for reproducibility
  try {
    const formatter = new Intl.DateTimeFormat('en-CA',{timeZone:tzid,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'});
    let guess = target;
    for (let index=0; index<3; index++) {
      const parts = Object.fromEntries(formatter.formatToParts(new Date(guess)).map(part => [part.type,part.value]));
      const rendered = Date.UTC(Number(parts.year),Number(parts.month)-1,Number(parts.day),Number(parts.hour),Number(parts.minute),Number(parts.second));
      guess += target-rendered;
    }
    return new Date(guess).toISOString();
  } catch { throw new Error(`Unsupported iCalendar time zone: ${tzid}`); }
}

function parseCalendar(source: string): ImportedMemory[] {
  const unfolded = source.replace(/\r?\n[ \t]/g,'');
  const blocks = unfolded.match(/BEGIN:VEVENT[\s\S]*?END:VEVENT/gi) ?? [];
  const output: ImportedMemory[] = [];
  for (const block of blocks) {
    const fields = new Map<string,{ value:string; tzid?:string }>();
    for (const line of block.split(/\r?\n/)) {
      const colon = line.indexOf(':');
      if (colon < 0) continue;
      const [rawName,...params] = line.slice(0,colon).split(';');
      const name = rawName.toUpperCase();
      const tzid = params.map(p => /^TZID=(.*)$/i.exec(p)?.[1]).find(Boolean)?.replace(/^"|"$/g,'');
      fields.set(name,{ value:line.slice(colon+1), tzid });
    }
    const summary = unescapeIcs(fields.get('SUMMARY')?.value ?? 'Calendar event');
    const description = unescapeIcs(fields.get('DESCRIPTION')?.value ?? '');
    const start = fields.get('DTSTART');
    if (!start) continue;
    const occurredAt = dateFromIcs(start.value,start.tzid);
    output.push(create({ title:summary.slice(0,500), content:description, occurredAt, format:'calendar' }));
  }
  if (!output.length) throw new Error('No VEVENT entries with DTSTART were found');
  return output;
}

export function parseTextImport(filename: string, content: string): ImportedMemory[] {
  const extension = filename.split('.').pop()?.toLowerCase();
  if (extension === 'md' || extension === 'markdown' || extension === 'txt') return parseMarkdown(filename,content);
  if (extension === 'html' || extension === 'htm') return parseBookmarks(content);
  if (extension === 'ics') return parseCalendar(content);
  throw new Error(`Unsupported import type for ${filename}; use .md, .markdown, .txt, .html, .htm, or .ics`);
}
