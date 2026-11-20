import type { Language } from './i18n';

export type JobStatus = 'viewed' | 'applied';

export type JobRecord = {
    key: string;
    ats: string;
    company: string;
    jobId: string;
    url: string;
    title?: string;
    status: JobStatus;
    firstSeenAt: number;
    lastSeenAt: number;
    appliedAt?: number;
    flags: string[];
    source: 'auto' | 'manual';
};

export type Settings = {
    language: Language;
    // auto: record a job as soon as it is opened. manual: ask first.
    mode: 'auto' | 'manual';
    // Whether job descriptions are scanned for restrictive wording.
    keywordsEnabled: boolean;
    rules: KeywordRule[];
};

// One keyword rule. `pattern` is a regular expression, kept as text so it can be stored in
// settings and edited by the user. Several rules can share a category.
export type KeywordRule = {
    category: string;
    pattern: string;
};
