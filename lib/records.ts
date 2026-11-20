import { jobKey, normalizeUrl, parseJobUrl } from './ats';
import { DEFAULT_COLORS, cleanCompanyName, isColor } from './companies';
import type { CompanyLists } from './companies';
import { t } from './i18n';
import { ruleError } from './keywords';
import type { JobRecord, JobStatus, KeywordRule, Settings } from './types';

// The record for a URL, as if it were seen right now. A page on a supported ATS gets its stable
// identity; any other page is identified by its URL without tracking parameters.
// Returns null when the input is not an http(s) URL.
export function recordForUrl(
    input: string,
    now: number,
    source: JobRecord['source'],
): JobRecord | null {
    const url = normalizeUrl(input);
    if (!url) return null;

    const seen = { url, status: 'viewed' as const, firstSeenAt: now, lastSeenAt: now, flags: [], source };
    const job = parseJobUrl(input);
    if (job) return { ...job, key: jobKey(job), ...seen };

    const host = new URL(url).hostname.replace(/^www\./, '');
    return { ats: 'other', company: host, jobId: '', key: `url:${url}`, ...seen };
}

// Changes the status and keeps `appliedAt` in step with it.
export function withStatus(record: JobRecord, status: JobStatus, now: number): JobRecord {
    if (status === record.status) return record;
    if (status === 'applied') return { ...record, status, appliedAt: now };
    const { appliedAt: _appliedAt, ...rest } = record;
    return { ...rest, status };
}

export type JobFilter = {
    query: string; // matched against company and title
    status: '' | JobStatus; // '' means any
    ats: string;
    flag: string;
};

export function filterJobs(jobs: JobRecord[], filter: JobFilter): JobRecord[] {
    const query = filter.query.trim().toLowerCase();
    return jobs.filter(
        (job) =>
            (!query || `${job.company} ${job.title ?? ''}`.toLowerCase().includes(query)) &&
            (!filter.status || job.status === filter.status) &&
            (!filter.ats || job.ats === filter.ats) &&
            (!filter.flag || job.flags.includes(filter.flag)),
    );
}

export type SortKey = 'lastSeenAt' | 'company' | 'title' | 'ats' | 'status';

export function sortJobs(jobs: JobRecord[], key: SortKey, descending: boolean): JobRecord[] {
    const value = (job: JobRecord) => (key === 'lastSeenAt' ? job.lastSeenAt : (job[key] ?? '').toLowerCase());
    const sorted = [...jobs].sort((a, b) => {
        const x = value(a);
        const y = value(b);
        return x < y ? -1 : x > y ? 1 : 0;
    });
    return descending ? sorted.reverse() : sorted;
}

const CSV_COLUMNS = [
    'company',
    'title',
    'status',
    'ats',
    'job_id',
    'first_seen',
    'last_seen',
    'applied_at',
    'flags',
    'url',
];

function csvCell(value: string): string {
    // Titles come from web pages. A cell starting with = + - or @ would run as a formula in a
    // spreadsheet, so make it plain text.
    const safe = /^[=+\-@]/.test(value) ? `'${value}` : value;
    return /[",\n\r]/.test(safe) ? `"${safe.replaceAll('"', '""')}"` : safe;
}

export function toCsv(jobs: JobRecord[]): string {
    const iso = (timestamp?: number) => (timestamp ? new Date(timestamp).toISOString() : '');
    const rows = jobs.map((job) => [
        job.company,
        job.title ?? '',
        job.status,
        job.ats,
        job.jobId,
        iso(job.firstSeenAt),
        iso(job.lastSeenAt),
        iso(job.appliedAt),
        job.flags.join('; '),
        job.url,
    ]);
    return [CSV_COLUMNS, ...rows].map((row) => row.map(csvCell).join(',')).join('\r\n') + '\r\n';
}

export const EXPORT_VERSION = 1;

export type ExportFile = {
    version: number;
    exportedAt: string;
    settings: Settings;
    jobs: JobRecord[];
    // The "not interested" and "interested" company lists.
    companies: string[];
    interested: string[];
};

const isText = (value: unknown): value is string => typeof value === 'string';
const isTime = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);

// Checks a value from an imported file and returns a clean record with only the known fields,
// or null if it cannot be one.
function cleanJob(value: unknown): JobRecord | null {
    if (typeof value !== 'object' || value === null) return null;
    const v = value as Record<string, unknown>;
    const ok =
        isText(v.key) &&
        v.key !== '' &&
        isText(v.ats) &&
        isText(v.company) &&
        isText(v.jobId) &&
        isText(v.url) &&
        normalizeUrl(v.url) !== null &&
        (v.status === 'viewed' || v.status === 'applied') &&
        isTime(v.firstSeenAt) &&
        isTime(v.lastSeenAt) &&
        (v.appliedAt === undefined || isTime(v.appliedAt)) &&
        (v.title === undefined || isText(v.title)) &&
        Array.isArray(v.flags) &&
        v.flags.every(isText) &&
        (v.source === 'auto' || v.source === 'manual');
    if (!ok) return null;

    const job: JobRecord = {
        key: v.key as string,
        ats: v.ats as string,
        company: v.company as string,
        jobId: v.jobId as string,
        url: v.url as string,
        status: v.status as JobStatus,
        firstSeenAt: v.firstSeenAt as number,
        lastSeenAt: v.lastSeenAt as number,
        flags: v.flags as string[],
        source: v.source as JobRecord['source'],
    };
    if (isText(v.title)) job.title = v.title;
    if (isTime(v.appliedAt) && job.status === 'applied') job.appliedAt = v.appliedAt;
    return job;
}

function isColors(value: unknown): boolean {
    if (typeof value !== 'object' || value === null) return false;
    const v = value as Record<string, unknown>;
    return isColor(v.avoid) && isColor(v.interested);
}

function cleanSettings(value: unknown): Settings | undefined {
    if (typeof value !== 'object' || value === null) return undefined;
    const v = value as Record<string, unknown>;
    const rules = v.rules;
    const ok =
        // Files exported before the language setting existed have none.
        (v.language === undefined || v.language === 'auto' || v.language === 'en' || v.language === 'zh') &&
        (v.mode === 'auto' || v.mode === 'manual') &&
        typeof v.keywordsEnabled === 'boolean' &&
        (v.highlightEnabled === undefined || typeof v.highlightEnabled === 'boolean') &&
        (v.highlightColors === undefined || isColors(v.highlightColors)) &&
        Array.isArray(rules) &&
        rules.every(
            (rule) =>
                typeof rule === 'object' &&
                rule !== null &&
                isText((rule as KeywordRule).category) &&
                isText((rule as KeywordRule).pattern) &&
                ruleError(rule as KeywordRule) === null,
        );
    if (!ok) return undefined;
    return {
        language: (v.language as Settings['language'] | undefined) ?? 'auto',
        mode: v.mode as Settings['mode'],
        keywordsEnabled: v.keywordsEnabled as boolean,
        rules: (rules as KeywordRule[]).map(({ category, pattern }) => ({ category, pattern })),
        highlightEnabled: (v.highlightEnabled as boolean | undefined) ?? true,
        highlightColors: (v.highlightColors as Settings['highlightColors'] | undefined) ?? DEFAULT_COLORS,
    };
}

export type ImportResult =
    | { error: string }
    | { jobs: JobRecord[]; skipped: number; settings: Settings | undefined; companies: CompanyLists };

// Reads the text of a file made by the JSON export. Entries that are not valid records are
// counted in `skipped` and left out; nothing in the file is trusted as it is.
export function parseImport(text: string): ImportResult {
    let data: unknown;
    try {
        data = JSON.parse(text);
    } catch {
        return { error: t('import.notJson') };
    }
    const file = data as Partial<ExportFile> | null;
    if (typeof file !== 'object' || file === null || !Array.isArray(file.jobs)) {
        return { error: t('import.notExport') };
    }

    const jobs = file.jobs.map(cleanJob).filter((job) => job !== null);
    // Files exported before the company lists existed have none.
    const names = (value: unknown) =>
        (Array.isArray(value) ? value : []).filter(isText).map(cleanCompanyName).filter(Boolean);
    return {
        jobs,
        skipped: file.jobs.length - jobs.length,
        settings: cleanSettings(file.settings),
        companies: { avoid: names(file.companies), interested: names(file.interested) },
    };
}

// Combines an imported record with the one already stored under the same key. Nothing the user
// did is lost: the earliest first sighting, the latest visit, and "applied" wins over "viewed".
export function mergeJob(existing: JobRecord, incoming: JobRecord): JobRecord {
    const merged: JobRecord = {
        ...incoming,
        ...existing,
        title: existing.title ?? incoming.title,
        firstSeenAt: Math.min(existing.firstSeenAt, incoming.firstSeenAt),
        lastSeenAt: Math.max(existing.lastSeenAt, incoming.lastSeenAt),
        flags: [...new Set([...existing.flags, ...incoming.flags])],
    };
    const appliedTimes = [existing.appliedAt, incoming.appliedAt].filter(isTime);
    if (appliedTimes.length > 0) {
        merged.status = 'applied';
        merged.appliedAt = Math.min(...appliedTimes);
    }
    return merged;
}
