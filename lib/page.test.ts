import { describe, expect, it } from 'vitest';
import { parseJobPostingJsonLd } from './page';

const posting = (extra: object = {}) =>
  JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'JobPosting',
    title: 'Software Engineer',
    hiringOrganization: { '@type': 'Organization', name: 'Acme' },
    ...extra,
  });

describe('parseJobPostingJsonLd', () => {
  it('reads title and company from a JobPosting', () => {
    expect(parseJobPostingJsonLd([posting()])).toEqual({
      title: 'Software Engineer',
      company: 'Acme',
    });
  });

  // Ashby ships titles with a leading space.
  it('trims whitespace', () => {
    expect(parseJobPostingJsonLd([posting({ title: ' Software Engineer, Security ' })]).title).toBe(
      'Software Engineer, Security',
    );
  });

  it('finds a JobPosting inside a list', () => {
    const script = JSON.stringify([{ '@type': 'Organization', name: 'Other' }, JSON.parse(posting())]);
    expect(parseJobPostingJsonLd([script]).company).toBe('Acme');
  });

  it('finds a JobPosting inside @graph', () => {
    const script = JSON.stringify({ '@context': 'https://schema.org', '@graph': [JSON.parse(posting())] });
    expect(parseJobPostingJsonLd([script]).title).toBe('Software Engineer');
  });

  it('accepts @type given as a list', () => {
    expect(parseJobPostingJsonLd([posting({ '@type': ['Thing', 'JobPosting'] })]).title).toBe(
      'Software Engineer',
    );
  });

  it('accepts hiringOrganization given as plain text', () => {
    expect(parseJobPostingJsonLd([posting({ hiringOrganization: 'Acme Inc.' })]).company).toBe(
      'Acme Inc.',
    );
  });

  it('skips invalid JSON and uses the next script', () => {
    expect(parseJobPostingJsonLd(['{ not json', posting()]).title).toBe('Software Engineer');
  });

  it('ignores JSON-LD that is not a JobPosting', () => {
    const script = JSON.stringify({ '@type': 'Organization', name: 'Acme', title: 'Not a job' });
    expect(parseJobPostingJsonLd([script])).toEqual({});
  });

  it('returns nothing when fields are missing or not text', () => {
    const script = posting({ title: '', hiringOrganization: null });
    expect(parseJobPostingJsonLd([script])).toEqual({ title: undefined, company: undefined });
    expect(parseJobPostingJsonLd([])).toEqual({});
  });
});
