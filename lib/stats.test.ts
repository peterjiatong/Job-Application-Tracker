import { describe, expect, it } from 'vitest';
import { activityLevel, dailyActivity, heatmapWeeks, localDay, summarize } from './stats';
import type { JobRecord } from './types';

// Times are built from local year/month/day, so the tests hold in any time zone.
const at = (year: number, month: number, day: number, hour = 12, minute = 0) =>
  new Date(year, month - 1, day, hour, minute).getTime();

let next = 0;
const job = (extra: Partial<JobRecord> = {}): JobRecord => ({
  key: `k${next++}`,
  ats: 'greenhouse',
  company: 'acme',
  jobId: '1',
  url: 'https://example.com',
  status: 'viewed',
  firstSeenAt: at(2026, 11, 1),
  lastSeenAt: at(2026, 11, 1),
  flags: [],
  source: 'auto',
  ...extra,
});
const applied = (time: number, extra: Partial<JobRecord> = {}) =>
  job({ status: 'applied', appliedAt: time, ...extra });

describe('localDay', () => {
  it('uses the local calendar day, also late in the evening and just after midnight', () => {
    expect(localDay(at(2026, 11, 5, 23, 59))).toBe('2026-11-05');
    expect(localDay(at(2026, 11, 6, 0, 1))).toBe('2026-11-06');
    expect(localDay(at(2027, 1, 1, 0, 0))).toBe('2027-01-01');
  });
});

describe('summarize', () => {
  const now = at(2026, 11, 20, 15);

  it('counts jobs, applications and the last seven days', () => {
    const jobs = [
      job(),
      job({ ats: 'lever' }),
      applied(at(2026, 11, 20, 9)), // today
      applied(at(2026, 11, 14, 0, 0)), // six days ago at midnight: still inside
      applied(at(2026, 11, 13, 23, 59)), // seven days ago: outside
    ];
    expect(summarize(jobs, now)).toMatchObject({ total: 5, applied: 3, appliedLast7Days: 2, conversion: 0.6 });
  });

  it('groups by ATS and by warning, most common first', () => {
    const jobs = [
      job({ ats: 'lever', flags: ['Clearance'] }),
      job({ ats: 'workday', flags: ['Clearance', 'Citizenship'] }),
      job({ ats: 'workday' }),
    ];
    const summary = summarize(jobs, now);
    expect(summary.byAts).toEqual([['workday', 2], ['lever', 1]]);
    expect(summary.byFlag).toEqual([['Clearance', 2], ['Citizenship', 1]]);
  });

  it('handles no jobs at all', () => {
    expect(summarize([], now)).toEqual({ total: 0, applied: 0, appliedLast7Days: 0, conversion: 0, byAts: [], byFlag: [] });
  });
});

describe('dailyActivity', () => {
  it('counts first sightings and applications on their own local days', () => {
    const days = dailyActivity([
      job({ firstSeenAt: at(2026, 11, 5, 23, 50) }),
      applied(at(2026, 11, 6, 0, 10), { firstSeenAt: at(2026, 11, 5, 8) }),
      applied(at(2026, 11, 6, 22)),
    ]);
    expect(days.get('2026-11-05')).toEqual({ applied: 0, viewed: 2 });
    expect(days.get('2026-11-06')).toEqual({ applied: 2, viewed: 0 });
    expect(days.get('2026-11-01')).toEqual({ applied: 0, viewed: 1 });
  });

  it('does not count a job that went back to viewed', () => {
    expect(dailyActivity([job({ appliedAt: at(2026, 11, 6) })]).get('2026-11-06')).toBeUndefined();
  });
});

describe('heatmapWeeks', () => {
  const today = new Date(2026, 10, 20); // Friday, Nov 20, 2026
  const weeks = heatmapWeeks(today);

  it('has 53 columns of 7 days, Sunday first', () => {
    expect(weeks).toHaveLength(53);
    expect(weeks.every((week) => week.length === 7)).toBe(true);
    expect(weeks.every((week) => week[0] === null || week[0]?.getDay() === 0)).toBe(true);
  });

  it('ends on today and leaves the rest of the week empty', () => {
    const last = weeks[52]!;
    expect(last.map((day) => (day ? localDay(day) : null))).toEqual([
      '2026-11-15', '2026-11-16', '2026-11-17', '2026-11-18', '2026-11-19', '2026-11-20', null,
    ]);
  });

  it('runs day by day across months and the new year without gaps or repeats', () => {
    const days = weeks.flat().filter((day) => day !== null).map(localDay);
    expect(days[0]).toBe('2025-11-16');
    expect(new Set(days).size).toBe(days.length);
    expect(days).toContain('2025-12-31');
    expect(days.indexOf('2026-01-01') - days.indexOf('2025-12-31')).toBe(1);
    expect(days.indexOf('2026-03-01') - days.indexOf('2026-02-28')).toBe(1);
    expect(days).toHaveLength(52 * 7 + 6);
  });
});

describe('activityLevel', () => {
  it('maps counts to five colour steps', () => {
    expect([0, 1, 2, 3, 4, 6, 7, 30].map(activityLevel)).toEqual([0, 1, 2, 2, 3, 3, 4, 4]);
  });
});
