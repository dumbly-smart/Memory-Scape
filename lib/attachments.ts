import { execFile as execFileCallback } from 'node:child_process';
import { mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';

const execFile = promisify(execFileCallback);
const searchableTypes = new Set(['text/plain', 'text/markdown', 'text/csv', 'application/json', 'application/xml']);
const MAX_TEXT_BYTES = 1024 * 1024;
const MAX_EXTRACTED_CHARS = 200_000;
const MAX_TEXT_PAGES = 100;
const MAX_PDF_PAGES = 10;
const PROCESS_TIMEOUT_MS = 15_000;

export function sanitizeAttachmentFilename(value: string): string {
  const safe = value.replace(/[\\/]/g, '_').replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(0, 240);
  return safe || 'attachment';
}

function cleanText(value: string): string | null {
  const text = value.replace(/\u0000/g, '').trim().slice(0, MAX_EXTRACTED_CHARS);
  return text.length ? text : null;
}

async function extractPdfText(bytes: Uint8Array): Promise<string | null> {
  if (bytes.byteLength > 10 * 1024 * 1024 || !Buffer.from(bytes.subarray(0, 1024)).includes(Buffer.from('%PDF-'))) return null;

  let directory: string | undefined;
  try {
    directory = await mkdtemp(join(tmpdir(), 'memoryscape-pdf-'));
    const pdf = join(directory, 'attachment.pdf');
    const prefix = join(directory, 'page');
    await writeFile(pdf, bytes, { mode: 0o600 });

    const { stdout: info } = await execFile('pdfinfo', [pdf], { timeout: 5_000, maxBuffer: 64 * 1024 });
    const pageCount = Number(info.match(/^Pages:\s+(\d+)\s*$/m)?.[1]);
    if (!Number.isInteger(pageCount) || pageCount < 1) return null;

    const { stdout: embeddedText } = await execFile(
      'pdftotext', ['-f', '1', '-l', String(Math.min(pageCount, MAX_TEXT_PAGES)), '-enc', 'UTF-8', '-nopgbrk', '-layout', pdf, '-'],
      { timeout: PROCESS_TIMEOUT_MS, maxBuffer: 1024 * 1024 },
    );
    const extracted = cleanText(embeddedText);
    if (extracted) return extracted;

    const ocrPages = Math.min(pageCount, MAX_PDF_PAGES);
    await execFile(
      'pdftoppm', ['-f', '1', '-l', String(ocrPages), '-scale-to', '1600', '-png', pdf, prefix],
      { timeout: PROCESS_TIMEOUT_MS, maxBuffer: 64 * 1024 },
    );
    const pages = (await readdir(directory))
      .filter(name => /^page-\d+\.png$/.test(name))
      .sort((a, b) => Number(a.match(/page-(\d+)/)?.[1]) - Number(b.match(/page-(\d+)/)?.[1]));
    const pageText: string[] = [];
    for (const page of pages.slice(0, MAX_PDF_PAGES)) {
      const { stdout } = await execFile('tesseract', [join(directory, page), 'stdout', '-l', 'eng', '--psm', '3'], {
        timeout: PROCESS_TIMEOUT_MS,
        maxBuffer: 256 * 1024,
      });
      if (stdout.trim()) pageText.push(stdout.trim());
    }
    return cleanText(pageText.join('\n\n'));
  } catch {
    // Text extraction is optional: a failed or unavailable tool must not lose the original attachment.
    return null;
  } finally {
    if (directory) await rm(directory, { recursive: true, force: true }).catch(() => undefined);
  }
}

export async function extractSearchableText(bytes: Uint8Array, mediaType: string): Promise<string | null> {
  const normalizedType = mediaType.split(';', 1)[0].trim().toLowerCase();
  if (normalizedType === 'application/pdf') return extractPdfText(bytes);
  if (!searchableTypes.has(normalizedType) || bytes.byteLength > MAX_TEXT_BYTES) return null;
  try {
    return cleanText(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
  } catch {
    return null;
  }
}

export function safeMediaType(value: string): string {
  return /^[a-z0-9!#$&^_.+-]+\/[a-z0-9!#$&^_.+-]+$/i.test(value) ? value.toLowerCase() : 'application/octet-stream';
}
