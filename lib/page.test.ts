import { describe, expect, it } from 'vitest';
import { isGithubDocumentPath, isSubmitLabel, parseJobPostingJsonLd } from './page';

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

describe('isSubmitLabel', () => {
  it.each([
    'Submit application', // Greenhouse, Workable
    'SUBMIT APPLICATION', // Lever
    'Submit Application', // Ashby
    'Submit', // Workday
    '  Submit\n  application ',
    'Submit your application',
    'Send application',
  ])('accepts "%s"', (label) => {
    expect(isSubmitLabel(label)).toBe(true);
  });

  it.each([
    'Apply',
    'Apply for this job',
    'Autofill my application', // Greenhouse
    'Save and Continue', // Workday, earlier steps
    'Next',
    'Sign In',
    'Resubmit', // not the word "submit"
    '',
    'By clicking submit you agree to the terms and conditions of this website', // not a button label
  ])('rejects "%s"', (label) => {
    expect(isSubmitLabel(label)).toBe(false);
  });
});

describe('isGithubDocumentPath', () => {
  it.each([
    '/speedyapply/2027-SWE-College-Jobs',
    '/speedyapply/2027-SWE-College-Jobs/',
    '/speedyapply/2027-SWE-College-Jobs/tree/main',
    '/speedyapply/2027-SWE-College-Jobs/tree/main/.github',
    '/speedyapply/2027-SWE-College-Jobs/blob/main/NEW_GRAD_USA.md',
    '/owner/repo/blob/main/docs/Guide.MD',
    '/owner/repo/blob/main/notes.markdown',
  ])('accepts %s', (path) => {
    expect(isGithubDocumentPath(path)).toBe(true);
  });

  it.each([
    '/owner/repo/issues',
    '/owner/repo/issues/12',
    '/owner/repo/pull/34',
    '/owner/repo/discussions/5',
    '/owner/repo/releases',
    '/owner/repo/wiki',
    '/owner/repo/blob/main/src/index.ts',
    '/owner/repo/blob/main/md', // a file called "md", not a Markdown file
    '/owner',
    '/',
  ])('rejects %s', (path) => {
    expect(isGithubDocumentPath(path)).toBe(false);
  });
});

