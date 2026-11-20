import { describe, expect, it } from 'vitest';
import { DEFAULT_RULES } from './keywords';
import { filterJobs, mergeJob, parseImport, recordForUrl, sortJobs, toCsv, withStatus } from './records';
import type { JobRecord } from './types';

const job = (extra: Partial<JobRecord> = {}): JobRecord => ({
  key: 'greenhouse:acme:1',
  ats: 'greenhouse',
  company: 'acme',
  jobId: '1',
  url: 'https://boards.greenhouse.io/acme/jobs/1',
  title: 'Engineer',
  status: 'viewed',
  firstSeenAt: 1000,
  lastSeenAt: 2000,
  flags: [],
  source: 'auto',
  ...extra,
});

describe('recordForUrl', () => {
  it('identifies a supported ATS page by its job', () => {
    const record = recordForUrl('https://boards.greenhouse.io/Acme/jobs/1?gh_src=x', 5, 'manual');
    expect(record).toMatchObject({
      key: 'greenhouse:acme:1',
      ats: 'greenhouse',
      company: 'acme',
      jobId: '1',
      url: 'https://boards.greenhouse.io/Acme/jobs/1',
      status: 'viewed',
      firstSeenAt: 5,
      lastSeenAt: 5,
      source: 'manual',
    });
  });

  it('identifies any other page by its URL without tracking parameters', () => {
    const a = recordForUrl('https://www.example.com/careers/42?utm_source=li&b=1', 5, 'manual');
    const b = recordForUrl('https://www.example.com/careers/42?b=1&ref=x#apply', 9, 'manual');
    expect(a).toMatchObject({ ats: 'other', company: 'example.com', jobId: '' });
    expect(a?.key).toBe('url:https://www.example.com/careers/42?b=1');
    expect(b?.key).toBe(a?.key);
  });

  it('returns null for input that is not a web address', () => {
    expect(recordForUrl('hello', 5, 'manual')).toBeNull();
    expect(recordForUrl('chrome://extensions', 5, 'manual')).toBeNull();
  });
});

describe('withStatus', () => {
  it('sets and clears appliedAt together with the status', () => {
    const applied = withStatus(job(), 'applied', 7000);
    expect(applied).toMatchObject({ status: 'applied', appliedAt: 7000 });
    const back = withStatus(applied, 'viewed', 8000);
    expect(back.status).toBe('viewed');
    expect('appliedAt' in back).toBe(false);
  });

  it('keeps the original time when the status does not change', () => {
    const applied = job({ status: 'applied', appliedAt: 7000 });
    expect(withStatus(applied, 'applied', 9000)).toBe(applied);
  });
});

describe('filterJobs and sortJobs', () => {
  const jobs = [
    job({ key: 'a', company: 'Acme', title: 'Data Engineer', lastSeenAt: 3 }),
    job({ key: 'b', company: 'beta', title: 'Designer', status: 'applied', ats: 'lever', lastSeenAt: 1 }),
    job({ key: 'c', company: 'Corp', title: undefined, flags: ['Clearance'], lastSeenAt: 2 }),
  ];
  const any = { query: '', status: '' as const, ats: '', flag: '' };
  const keys = (list: JobRecord[]) => list.map((j) => j.key).join('');

  it('searches company and title, ignoring case', () => {
    expect(keys(filterJobs(jobs, { ...any, query: 'ENGINEER' }))).toBe('a');
    expect(keys(filterJobs(jobs, { ...any, query: ' corp ' }))).toBe('c');
  });

  it('combines filters', () => {
    expect(keys(filterJobs(jobs, { ...any, status: 'applied' }))).toBe('b');
    expect(keys(filterJobs(jobs, { ...any, ats: 'greenhouse', flag: 'Clearance' }))).toBe('c');
    expect(keys(filterJobs(jobs, { ...any, ats: 'lever', flag: 'Clearance' }))).toBe('');
    expect(keys(filterJobs(jobs, any))).toBe('abc');
  });

  it('sorts by a column in either direction without changing the input', () => {
    expect(keys(sortJobs(jobs, 'lastSeenAt', true))).toBe('acb');
    expect(keys(sortJobs(jobs, 'company', false))).toBe('abc');
    expect(keys(sortJobs(jobs, 'title', false))).toBe('cab'); // no title sorts first
    expect(keys(jobs)).toBe('abc');
  });
});

describe('toCsv', () => {
  it('writes a header and one line per job', () => {
    const lines = toCsv([job({ status: 'applied', appliedAt: 0, flags: ['Clearance', 'Citizenship'] })]).split('\r\n');
    expect(lines[0]).toBe('company,title,status,ats,job_id,first_seen,last_seen,applied_at,flags,url');
    expect(lines[1]).toBe(
      'acme,Engineer,applied,greenhouse,1,1970-01-01T00:00:01.000Z,1970-01-01T00:00:02.000Z,,Clearance; Citizenship,https://boards.greenhouse.io/acme/jobs/1',
    );
  });

  it('quotes commas, quotes and line breaks', () => {
    const csv = toCsv([job({ title: 'Engineer, "Platform"\nTeam' })]);
    expect(csv).toContain('acme,"Engineer, ""Platform""\nTeam",viewed');
  });

  it('stops spreadsheet formulas', () => {
    expect(toCsv([job({ title: '=HYPERLINK("http://x")' })])).toContain(`"'=HYPERLINK(""http://x"")"`);
  });
});

describe('parseImport', () => {
  const file = (jobs: unknown[], settings?: unknown) => JSON.stringify({ version: 1, jobs, settings });

  it('reads back valid records and settings', () => {
    const settings = { language: 'zh', mode: 'manual', keywordsEnabled: false, rules: DEFAULT_RULES };
    const result = parseImport(file([job(), job({ key: 'x', status: 'applied', appliedAt: 5 })], settings));
    expect(result).toEqual({
      jobs: [job(), job({ key: 'x', status: 'applied', appliedAt: 5 })],
      skipped: 0,
      settings,
    });
  });

  it('skips entries that are not valid records and counts them', () => {
    const bad = [
      null,
      'text',
      { ...job(), key: '' },
      { ...job(), status: 'done' },
      { ...job(), firstSeenAt: 'yesterday' },
      { ...job(), flags: [1] },
      { ...job(), url: 'javascript:alert(1)' },
    ];
    expect(parseImport(file([job(), ...bad]))).toMatchObject({ jobs: [job()], skipped: 7 });
  });

  it('drops fields it does not know', () => {
    const result = parseImport(file([{ ...job(), extra: '<script>' }]));
    expect('jobs' in result && result.jobs[0]).toEqual(job());
  });

  it('accepts settings from before the language setting existed', () => {
    const old = { mode: 'auto', keywordsEnabled: true, rules: DEFAULT_RULES };
    expect(parseImport(file([], old))).toMatchObject({ settings: { ...old, language: 'auto' } });
  });

  it('ignores settings that are not valid', () => {
    const broken = { mode: 'auto', keywordsEnabled: true, rules: [{ category: 'X', pattern: '(' }] };
    expect(parseImport(file([], broken))).toMatchObject({ settings: undefined });
  });

  it('reports files that are not an export', () => {
    expect(parseImport('not json')).toEqual({ error: 'This file is not valid JSON.' });
    expect(parseImport('{"hello": 1}')).toHaveProperty('error');
    expect(parseImport('[1, 2]')).toHaveProperty('error');
    expect(parseImport('null')).toHaveProperty('error');
  });
});

describe('mergeJob', () => {
  it('keeps the earliest first sighting and the latest visit', () => {
    const merged = mergeJob(job({ firstSeenAt: 50, lastSeenAt: 60 }), job({ firstSeenAt: 10, lastSeenAt: 90 }));
    expect(merged).toMatchObject({ firstSeenAt: 10, lastSeenAt: 90 });
  });

  it('lets "applied" win, with the earliest application time', () => {
    const viewed = job();
    const applied = job({ status: 'applied', appliedAt: 70 });
    expect(mergeJob(viewed, applied)).toMatchObject({ status: 'applied', appliedAt: 70 });
    expect(mergeJob(applied, viewed)).toMatchObject({ status: 'applied', appliedAt: 70 });
    expect(mergeJob(applied, job({ status: 'applied', appliedAt: 30 })).appliedAt).toBe(30);
  });

  it('keeps the stored title and company, and all flags', () => {
    const merged = mergeJob(
      job({ title: 'Edited by me', flags: ['Clearance'] }),
      job({ title: 'From the file', company: 'Other', flags: ['Citizenship'] }),
    );
    expect(merged).toMatchObject({ title: 'Edited by me', company: 'acme', flags: ['Clearance', 'Citizenship'] });
  });

  it('takes the title from the file when the stored record has none', () => {
    expect(mergeJob(job({ title: undefined }), job({ title: 'From the file' })).title).toBe('From the file');
  });
});
