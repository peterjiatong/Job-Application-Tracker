import { browser } from 'wxt/browser';
import type { JobRecord } from './types';

const JOB_PREFIX = 'job:';

export async function getJob(key: string): Promise<JobRecord | null> {
    const storageKey = JOB_PREFIX + key;
    const result = await browser.storage.local.get(storageKey);
    return (result[storageKey] as JobRecord | undefined) ?? null;
}

export async function saveJob(record: JobRecord): Promise<void> {
    await browser.storage.local.set({ [JOB_PREFIX + record.key]: record });
}

export async function deleteJob(key: string): Promise<void> {
    await browser.storage.local.remove(JOB_PREFIX + key);
}

export async function listJobs(): Promise<JobRecord[]> {
    const all = await browser.storage.local.get(null);
    return Object.entries(all)
        .filter(([storageKey]) => storageKey.startsWith(JOB_PREFIX))
        .map(([, value]) => value as JobRecord);
}