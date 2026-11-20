import { browser } from 'wxt/browser';
import { DEFAULT_RULES } from './keywords';
import type { JobRecord, Settings } from './types';

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

const SETTINGS_KEY = 'settings';
const DEFAULT_SETTINGS: Settings = { mode: 'auto', keywordsEnabled: true, rules: DEFAULT_RULES };

export async function getSettings(): Promise<Settings> {
    const result = await browser.storage.local.get(SETTINGS_KEY);
    return { ...DEFAULT_SETTINGS, ...(result[SETTINGS_KEY] as Partial<Settings> | undefined) };
}

export async function saveSettings(settings: Settings): Promise<void> {
    // Rules that equal the built-in ones are not stored. That way better defaults in a later
    // version reach everyone who never edited the rules.
    const { rules, ...rest } = settings;
    const customRules = JSON.stringify(rules) !== JSON.stringify(DEFAULT_RULES);
    await browser.storage.local.set({ [SETTINGS_KEY]: customRules ? settings : rest });
}