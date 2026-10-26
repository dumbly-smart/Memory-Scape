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
});
