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
const MAX_IMAGE_PIXELS = 12_000_000;
const PROCESS_TIMEOUT_MS = 15_000;
const JPEG_START_OF_FRAME = new Set([0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf]);

export function sanitizeAttachmentFilename(value: string): string {
  const safe = value.replace(/[\\/]/g, '_').replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(0, 240);
  return safe || 'attachment';
}

function cleanText(value: string): string | null {
  const text = value.replace(/\u0000/g, '').trim().slice(0, MAX_EXTRACTED_CHARS);
  return text.length ? text : null;
}

function pngDimensions(bytes: Buffer): { width: number; height: number } | null {
  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  if (bytes.length < 24 || !bytes.subarray(0, 8).equals(signature) || bytes.toString('ascii', 12, 16) !== 'IHDR') return null;
  return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) };
}

function jpegDimensions(bytes: Buffer): { width: number; height: number } | null {
  if (bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8) return null;
  let offset = 2;
  while (offset + 1 < bytes.length) {
    if (bytes[offset] !== 0xff) return null;
    while (bytes[offset] === 0xff) offset += 1;
    const marker = bytes[offset];
    offset += 1;
    if (marker === 0xd9 || marker === 0xda) return null;
    if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) continue;
    if (offset + 2 > bytes.length) return null;
    const segmentLength = bytes.readUInt16BE(offset);
    if (segmentLength < 2 || offset + segmentLength > bytes.length) return null;
    if (JPEG_START_OF_FRAME.has(marker)) {
      if (segmentLength < 7) return null;
      return { height: bytes.readUInt16BE(offset + 3), width: bytes.readUInt16BE(offset + 5) };
    }
    offset += segmentLength;
  }
  return null;
}

function rasterImageExtension(bytes: Uint8Array, mediaType: string): 'png' | 'jpg' | null {
  if (bytes.byteLength > 10 * 1024 * 1024) return null;
  const data = Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const dimensions = mediaType === 'image/png'
    ? pngDimensions(data)
    : mediaType === 'image/jpeg' ? jpegDimensions(data) : null;
  if (!dimensions || dimensions.width < 1 || dimensions.height < 1 || dimensions.width * dimensions.height > MAX_IMAGE_PIXELS) return null;
  return mediaType === 'image/png' ? 'png' : 'jpg';
}

async function tesseractText(imagePath: string): Promise<string | null> {
  const { stdout } = await execFile('tesseract', [imagePath, 'stdout', '-l', 'eng', '--psm', '3'], {
    timeout: PROCESS_TIMEOUT_MS,
    maxBuffer: 256 * 1024,
  });
  return cleanText(stdout);
}

async function extractImageText(bytes: Uint8Array, mediaType: string): Promise<string | null> {
  const extension = rasterImageExtension(bytes, mediaType);
  if (!extension) return null;
  let directory: string | undefined;
  try {
    directory = await mkdtemp(join(tmpdir(), 'memoryscape-image-'));
    const image = join(directory, `attachment.${extension}`);
    await writeFile(image, bytes, { mode: 0o600 });
    return await tesseractText(image);
  } catch {
    return null;
  } finally {
    if (directory) await rm(directory, { recursive: true, force: true }).catch(() => undefined);
  }
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
      const text = await tesseractText(join(directory, page));
      if (text) pageText.push(text);
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
  if (normalizedType === 'image/png' || normalizedType === 'image/jpeg') return extractImageText(bytes, normalizedType);
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
