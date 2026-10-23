export function deriveCaptureTitle(title: string | undefined, content: string): string {
  const explicit = title?.trim();
  const source = explicit || content.split(/\r?\n/).find(line => line.trim())?.trim() || 'Quick note';
  return source.slice(0, 240);
}

export function safeCaptureUrl(value: string | undefined): string | null {
  if (!value?.trim()) return null;
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:' ? url.toString().slice(0, 2048) : null;
  } catch {
    return null;
  }
}
