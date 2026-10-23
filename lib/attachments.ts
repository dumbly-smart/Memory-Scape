const searchableTypes = new Set(['text/plain','text/markdown','text/csv','application/json','application/xml']);

export function sanitizeAttachmentFilename(value: string): string {
  const safe = value.replace(/[\\/]/g, '_').replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(0, 240);
  return safe || 'attachment';
}

export function extractSearchableText(bytes: Uint8Array, mediaType: string): string | null {
  const normalizedType = mediaType.split(';', 1)[0].trim().toLowerCase();
  if (!searchableTypes.has(normalizedType) || bytes.byteLength > 1024 * 1024) return null;
  try {
    const text = new TextDecoder('utf-8', { fatal: true }).decode(bytes).replace(/\u0000/g, '').trim();
    return text.length ? text.slice(0, 200000) : null;
  } catch {
    return null;
  }
}

export function safeMediaType(value: string): string {
  return /^[a-z0-9!#$&^_.+-]+\/[a-z0-9!#$&^_.+-]+$/i.test(value) ? value.toLowerCase() : 'application/octet-stream';
}
