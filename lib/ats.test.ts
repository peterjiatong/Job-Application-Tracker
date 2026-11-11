import { describe, expect, it } from 'vitest';
import { normalizeUrl, parseJobUrl } from './ats';

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

// Job ids and base URLs come from the public Greenhouse and Lever job board APIs (2026-11-10).
// Variants with tracking params, extra path segments, casing and EU hosts are derived from them.
describe('parseJobUrl', () => {
  const discord = { ats: 'greenhouse', company: 'discord', jobId: '8917177002' };
  const figma = { ats: 'greenhouse', company: 'figma', jobId: '5426468004' };
  const palantir = {
    ats: 'lever',
    company: 'palantir',
    jobId: '6ed76ce8-4156-4b60-b120-403538bd66cd',
  };

  it.each([
    // Greenhouse
    ['https://job-boards.greenhouse.io/discord/jobs/8917177002', discord],
    ['https://boards.greenhouse.io/figma/jobs/5426468004?gh_jid=5426468004', figma],
    ['https://job-boards.greenhouse.io/figma/jobs/5426468004', figma],
    ['https://job-boards.greenhouse.io/discord/jobs/8917177002?gh_src=abc&utm_source=linkedin#app', discord],
    ['https://job-boards.greenhouse.io/embed/job_app?for=discord&token=8917177002', discord],
    ['https://boards.greenhouse.io/embed/job_app?for=figma&token=5426468004', figma],
    ['https://job-boards.greenhouse.io/discord/jobs/8917177002/confirmation', discord],
    ['https://job-boards.greenhouse.io/Discord/jobs/8917177002', discord],
    ['https://job-boards.eu.greenhouse.io/discord/jobs/8917177002', discord],
    // Lever
    ['https://jobs.lever.co/palantir/6ed76ce8-4156-4b60-b120-403538bd66cd', palantir],
    ['https://jobs.lever.co/palantir/6ed76ce8-4156-4b60-b120-403538bd66cd/apply', palantir],
    ['https://jobs.lever.co/palantir/6ed76ce8-4156-4b60-b120-403538bd66cd/apply?lever-source=LinkedIn', palantir],
    ['https://jobs.lever.co/palantir/6ED76CE8-4156-4B60-B120-403538BD66CD', palantir],
    ['https://jobs.eu.lever.co/palantir/6ed76ce8-4156-4b60-b120-403538bd66cd', palantir],
  ])('parses %s', (url, expected) => {
    expect(parseJobUrl(url)).toEqual(expected);
  });

  it.each([
    // Board list pages, not a single job
    'https://job-boards.greenhouse.io/discord',
    'https://jobs.lever.co/palantir',
    // Malformed job ids
    'https://job-boards.greenhouse.io/discord/jobs/abc',
    'https://jobs.lever.co/palantir/not-a-uuid',
    // Look-alike and unrelated hosts
    'https://evil-greenhouse.io/discord/jobs/8917177002',
    'https://example.com/discord/jobs/8917177002',
    // Known limitation: Greenhouse jobs hosted on the company's own domain
    'https://stripe.com/jobs/search?gh_jid=8172510',
    // Not URLs
    'hello',
    '',
  ])('returns null for %s', (url) => {
    expect(parseJobUrl(url)).toBeNull();
  });
});
