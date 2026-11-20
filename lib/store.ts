import { browser } from 'wxt/browser';
import { DEFAULT_COLORS, addCompanies, removeCompanies } from './companies';
import type { CompanyList, CompanyLists } from './companies';
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

// Saves many records in one write, so listeners hear about it once.
export async function saveJobs(records: JobRecord[]): Promise<void> {
    await browser.storage.local.set(
        Object.fromEntries(records.map((record) => [JOB_PREFIX + record.key, record])),
    );
}

// Calls `callback` whenever a stored item whose key passes `test` changes, in any tab.
// Returns a function that stops listening.
function watch(test: (storageKey: string) => boolean, callback: () => void): () => void {
    const listener = (changes: Record<string, unknown>, area: string) => {
        if (area === 'local' && Object.keys(changes).some(test)) callback();
    };
    browser.storage.onChanged.addListener(listener);
    return () => browser.storage.onChanged.removeListener(listener);
}

// A job record was added, changed or removed.
export function onJobsChanged(callback: () => void): () => void {
    return watch((key) => key.startsWith(JOB_PREFIX), callback);
}

export function onSettingsChanged(callback: () => void): () => void {
    return watch((key) => key === SETTINGS_KEY, callback);
}

// One of the two company lists changed.
export function onCompaniesChanged(callback: () => void): () => void {
    return watch((key) => Object.values(COMPANY_KEYS).includes(key), callback);
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
const DEFAULT_SETTINGS: Settings = {
    language: 'auto',
    mode: 'auto',
    keywordsEnabled: true,
    rules: DEFAULT_RULES,
    highlightEnabled: true,
    highlightColors: DEFAULT_COLORS,
};

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

// Storage keys of the two company lists. 'companies' is the "not interested" list: it existed
// first, and keeping its key means lists saved by earlier versions are still found.
const COMPANY_KEYS: Record<CompanyList, string> = { avoid: 'companies', interested: 'interested' };

export async function getCompanyLists(): Promise<CompanyLists> {
    const result = await browser.storage.local.get(Object.values(COMPANY_KEYS));
    return {
        avoid: (result[COMPANY_KEYS.avoid] as string[] | undefined) ?? [],
        interested: (result[COMPANY_KEYS.interested] as string[] | undefined) ?? [],
    };
}

export async function saveCompanies(list: CompanyList, names: string[]): Promise<void> {
    await browser.storage.local.set({ [COMPANY_KEYS[list]]: names });
}

// Adds names to one list and returns how many were new to it. A company is only ever on one
// list, so the names are taken off the other.
export async function addToCompanies(list: CompanyList, names: string[]): Promise<number> {
    const lists = await getCompanyLists();
    const other: CompanyList = list === 'avoid' ? 'interested' : 'avoid';
    const next = addCompanies(lists[list], names);
    const nextOther = removeCompanies(lists[other], names);

    const changes: Record<string, string[]> = {};
    if (next !== lists[list]) changes[COMPANY_KEYS[list]] = next;
    if (nextOther !== lists[other]) changes[COMPANY_KEYS[other]] = nextOther;
    if (Object.keys(changes).length > 0) await browser.storage.local.set(changes);
    return next.length - lists[list].length;
}
