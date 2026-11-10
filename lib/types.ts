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
