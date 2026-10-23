import { describe, expect, it } from 'vitest';
import { buildCaptureBookmarklet } from '../../lib/bookmarklet';

describe('buildCaptureBookmarklet', () => {
  it('targets the configured app and captures the selected page context', () => {
    const result = buildCaptureBookmarklet('http://127.0.0.1:3000');
    expect(result.startsWith('javascript:')).toBe(true);
    expect(result).toContain('http://127.0.0.1:3000/capture');
    expect(result).toContain('location.href');
    expect(result).toContain('document.title');
    expect(result).toContain('getSelection');
    expect(result).toContain('20000');
  });

  it('rejects non-web app origins', () => {
    expect(() => buildCaptureBookmarklet('javascript:alert(1)')).toThrow('HTTP or HTTPS');
  });
});
