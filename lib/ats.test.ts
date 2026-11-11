import { describe, expect, it } from 'vitest';
import { normalizeUrl } from './ats';

describe('normalizeUrl', () => {
  it('removes tracking params and the hash', () => {
    expect(
      normalizeUrl('https://jobs.lever.co/acme/abc?lever-source=LinkedIn&utm_medium=post#apply'),
    ).toBe('https://jobs.lever.co/acme/abc');
  });

  it('keeps unknown params and sorts them', () => {
    expect(normalizeUrl('https://example.com/jobs?b=2&utm_source=x&a=1')).toBe(
      'https://example.com/jobs?a=1&b=2',
    );
  });

  it('leaves a clean URL unchanged', () => {
    expect(normalizeUrl('https://boards.greenhouse.io/stripe/jobs/123')).toBe(
      'https://boards.greenhouse.io/stripe/jobs/123',
    );
  });

  it('returns null for invalid input', () => {
    expect(normalizeUrl('hello')).toBeNull();
    expect(normalizeUrl('')).toBeNull();
  });

  it('returns null for non-http protocols', () => {
    expect(normalizeUrl('javascript:alert(1)')).toBeNull();
  });
});
