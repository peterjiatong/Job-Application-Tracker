import type { JobRecord } from './types';

// The calendar day of a moment in the browser's own time zone, as "2026-11-05".
// Not toISOString: that is UTC, which would count an evening application as the next day.
export function localDay(time: number | Date): string {
    const date = new Date(time);
    const two = (n: number) => String(n).padStart(2, '0');
    return `${date.getFullYear()}-${two(date.getMonth() + 1)}-${two(date.getDate())}`;
}

export type Summary = {
    total: number; // every recorded job has been viewed
    applied: number;
    appliedLast7Days: number; // today and the six days before it
    conversion: number; // applied / total, 0 to 1
    byAts: [name: string, count: number][]; // most common first
    byFlag: [name: string, count: number][];
};

function tally(names: string[]): [string, number][] {
    const counts = new Map<string, number>();
    for (const name of names) counts.set(name, (counts.get(name) ?? 0) + 1);
    return [...counts].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
}

export function summarize(jobs: JobRecord[], now: number): Summary {
    const weekStart = new Date(now);
    weekStart.setHours(0, 0, 0, 0);
    weekStart.setDate(weekStart.getDate() - 6);

    const applied = jobs.filter((job) => job.status === 'applied');
    return {
        total: jobs.length,
        applied: applied.length,
        appliedLast7Days: applied.filter((job) => (job.appliedAt ?? 0) >= weekStart.getTime()).length,
        conversion: jobs.length === 0 ? 0 : applied.length / jobs.length,
        byAts: tally(jobs.map((job) => job.ats)),
        byFlag: tally(jobs.flatMap((job) => job.flags)),
    };
}

export type DayActivity = { applied: number; viewed: number };

// Per local day: how many jobs were applied to, and how many were first seen.
export function dailyActivity(jobs: JobRecord[]): Map<string, DayActivity> {
    const days = new Map<string, DayActivity>();
    const day = (time: number) => {
        const key = localDay(time);
        let entry = days.get(key);
        if (!entry) days.set(key, (entry = { applied: 0, viewed: 0 }));
        return entry;
    };
    for (const job of jobs) {
        day(job.firstSeenAt).viewed += 1;
        if (job.status === 'applied' && job.appliedAt) day(job.appliedAt).applied += 1;
    }
    return days;
}

// The grid for the activity chart: one column per week (Sunday first), ending with the week
// that contains `today`. Days after today are null.
export function heatmapWeeks(today: Date, weeks = 53): (Date | null)[][] {
    const start = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    start.setDate(start.getDate() - start.getDay() - (weeks - 1) * 7);

    const end = localDay(today);
    const columns: (Date | null)[][] = [];
    for (let week = 0; week < weeks; week++) {
        const column: (Date | null)[] = [];
        for (let weekday = 0; weekday < 7; weekday++) {
            // Built from year, month, day so that daylight-saving changes cannot shift a day.
            const date = new Date(start.getFullYear(), start.getMonth(), start.getDate() + week * 7 + weekday);
            column.push(localDay(date) <= end ? date : null);
        }
        columns.push(column);
    }
    return columns;
}

// Colour step for a day in the activity chart, 0 (none) to 4.
export function activityLevel(applied: number): 0 | 1 | 2 | 3 | 4 {
    if (applied <= 0) return 0;
    if (applied === 1) return 1;
    if (applied <= 3) return 2;
    if (applied <= 6) return 3;
    return 4;
}
