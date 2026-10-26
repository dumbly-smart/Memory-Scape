import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { extractSearchableText } from '../lib/attachments';

const fixture = (name: string) => readFile(resolve(process.cwd(), 'tests/fixtures', name));

describe('attachment text extraction', () => {
  it('extracts the text layer from a PDF for PostgreSQL search', async () => {
    const bytes = await fixture('searchable-text.pdf');
    const result = await extractSearchableText(bytes, 'application/pdf');
    expect(result?.toLowerCase()).toContain('searchable campus pdf phrase');
  });

  it('OCRs scanned PDF pages when the PDF has no text layer', async () => {
    const bytes = await fixture('scanned-text.pdf');
    const result = await extractSearchableText(bytes, 'application/pdf');
    expect(result?.toUpperCase()).toContain('CAMPUS MEMORY');
  });

  it('does not index malformed PDF bytes as text', async () => {
    const result = await extractSearchableText(Buffer.from('not a PDF: secrets'), 'application/pdf');
    expect(result).toBeNull();
  });

  it('continues to extract bounded plain text attachments', async () => {
    const result = await extractSearchableText(Buffer.from('A searchable note'), 'text/plain');
    expect(result).toBe('A searchable note');
  });

  it('OCRs PNG image attachments into searchable text', async () => {
    const bytes = await fixture('photo-note.png');
    const result = await extractSearchableText(bytes, 'image/png');
    expect(result?.toUpperCase()).toContain('IMAGE CLUE QUARTZ');
  });

  it('OCRs JPEG image attachments into searchable text', async () => {
    const bytes = await fixture('photo-note.jpg');
    const result = await extractSearchableText(bytes, 'image/jpeg');
    expect(result?.toUpperCase()).toContain('JPEG CLUE AMBER');
  });

  it('does not OCR raster images whose dimensions exceed the pixel budget', async () => {
    const bytes = Buffer.alloc(24);
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).copy(bytes);
    bytes.write('IHDR', 12, 'ascii');
    bytes.writeUInt32BE(4000, 16);
    bytes.writeUInt32BE(4000, 20);
    expect(await extractSearchableText(bytes, 'image/png')).toBeNull();
  });

  it('rejects image MIME and file-signature mismatches', async () => {
    const bytes = await fixture('photo-note.png');
    expect(await extractSearchableText(bytes, 'image/jpeg')).toBeNull();
  });

  it('rejects malformed JPEG segment data without scanning past its buffer', async () => {
    expect(await extractSearchableText(Buffer.from([0xff, 0xd8, 0xff, 0xc0, 0xff]), 'image/jpeg')).toBeNull();
  });
});
