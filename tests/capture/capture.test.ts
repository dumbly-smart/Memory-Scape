import { describe, expect, it } from 'vitest';
import { deriveCaptureTitle, safeCaptureUrl } from '../../lib/capture';

describe('deriveCaptureTitle', () => {
  it('uses the first non-empty content line when a title was omitted', () => {
    expect(deriveCaptureTitle(undefined, '\n  Pick up the book\nDetails follow')).toBe('Pick up the book');
  });

  it('uses a useful fallback when both title and content are empty', () => {
    expect(deriveCaptureTitle('   ', '\n\t')).toBe('Quick note');
  });

  it('trims an explicit title and caps it at the memory title limit', () => {
    expect(deriveCaptureTitle('  A title  ', 'unused')).toBe('A title');
    expect(deriveCaptureTitle(undefined, 'x'.repeat(300))).toHaveLength(240);
  });
});

describe('safeCaptureUrl', () => {
  it('keeps web URLs and rejects script and file schemes', () => {
    expect(safeCaptureUrl('https://example.test/article')).toBe('https://example.test/article');
    expect(safeCaptureUrl('javascript:alert(1)')).toBeNull();
    expect(safeCaptureUrl('file:///etc/passwd')).toBeNull();
  });
});
