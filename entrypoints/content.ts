import '@/lib/highlight.css';
import { jobKey, normalizeUrl, parseJobUrl } from '@/lib/ats';
import type { ParsedJob } from '@/lib/ats';
import { companyPattern } from '@/lib/companies';
import type { CompanyList } from '@/lib/companies';
import { formatDate, formatDateTime } from '@/lib/format';
import { highlightText, setHighlightColors } from '@/lib/highlight';
import { categoryLabel, setLanguage, t } from '@/lib/i18n';
import { scan } from '@/lib/keywords';
import { isSubmitLabel, pageQuiet, pageText, readJobInfo, readWorkdayTitle } from '@/lib/page';
import {
  deleteJob,
  getCompanyLists,
  getJob,
  getSettings,
  onCompaniesChanged,
  onSettingsChanged,
  saveJob,
} from '@/lib/store';
import {
  dismissToast,
  isToastOpen,
  setToastLink,
  setToastWarnings,
  showToast,
} from '@/lib/toast';
import type { JobRecord } from '@/lib/types';

export default defineContentScript({
  matches: [
    'https://boards.greenhouse.io/*',
    'https://job-boards.greenhouse.io/*',
    'https://boards.eu.greenhouse.io/*',
    'https://job-boards.eu.greenhouse.io/*',
    'https://jobs.lever.co/*',
    'https://jobs.eu.lever.co/*',
    'https://jobs.ashbyhq.com/*',
    'https://jobs.smartrecruiters.com/*',
    'https://apply.workable.com/*',
    'https://*.icims.com/*',
    'https://*.myworkdayjobs.com/*',
    'https://*.myworkdaysite.com/*',
    // Job boards. No jobs are recorded here (their addresses are not job pages to parseJobUrl);
    // the script only highlights companies the user is not interested in.
    'https://www.linkedin.com/*',
    'https://*.indeed.com/*',
    'https://*.glassdoor.com/*',
    'https://*.joinhandshake.com/*',
    'https://www.ziprecruiter.com/*',
  ],
  main(ctx) {
    void highlightCompanies();

    currentKey = previousPageKey();
    let handledUrl = location.href;
    void handlePage(handledUrl, true);

    // Single-page apps (Workday) switch pages by changing the URL without loading a new document,
    // so this script does not start again. WXT reports URL changes as an event.
    ctx.addEventListener(window, 'wxt:locationchange', () => {
      // The event also fires when the browser is about to leave for a new document. In that case
      // the URL of this document never changes, and the script on the new page handles it.
      // So wait a moment and only react if this document's own URL really changed.
      ctx.setTimeout(() => {
        if (location.href === handledUrl) return;
        handledUrl = location.href;
        void handlePage(handledUrl, false);
      }, 0);
    });

    // Capture phase: the page's own code may stop the click from reaching `document` otherwise.
    const onClick = (event: Event) => void onPageClick(event);
    ctx.addEventListener(document, 'click', onClick, true);
    watchFrames(onClick);
  },
});

// Highlights the companies on the user's two lists, each list in its colour, and keeps the
// highlighting current: when a list or a setting changes, and as the page adds content (search
// results that load while scrolling).
async function highlightCompanies(): Promise<void> {
  let patterns: Record<CompanyList, RegExp | null> = { avoid: null, interested: null };
  const reload = async () => {
    const [settings, lists] = await Promise.all([getSettings(), getCompanyLists()]);
    const on = settings.highlightEnabled;
    patterns = {
      avoid: on ? companyPattern(lists.avoid) : null,
      interested: on ? companyPattern(lists.interested) : null,
    };
    setHighlightColors(document, settings.highlightColors);
    highlightText(document, patterns);
  };
  await reload();
  onCompaniesChanged(() => void reload());
  onSettingsChanged(() => void reload());

  let timer: ReturnType<typeof setTimeout> | undefined;
  new MutationObserver(() => {
    if (!patterns.avoid && !patterns.interested) return;
    // ponytail: scans the whole page again half a second after the last change. Scan only the
    // changed parts if this ever shows up as slow on very long pages.
    clearTimeout(timer);
    timer = setTimeout(() => highlightText(document, patterns), 500);
  }).observe(document, { childList: true, subtree: true, characterData: true });
}

const SESSION_KEY = 'jat:currentJob';

// Key of the job on the page being shown. It tells "another page of the same job" apart from
// "a different job", and lets a slow run notice that the user has already moved on.
let currentKey: string | null = null;

function setCurrentKey(key: string | null): void {
  currentKey = key;
  // Also leave it for the next page in this tab. sessionStorage belongs to one tab and one site
  // and survives page loads, so sites that load a new page for every step are covered too.
  try {
    if (key) sessionStorage.setItem(SESSION_KEY, key);
    else sessionStorage.removeItem(SESSION_KEY);
  } catch {
    // The site blocks storage. That only costs the memory across page loads.
  }
}

// The job that the previous page in this tab was showing, if we came straight from that page.
function previousPageKey(): string | null {
  try {
    // A referrer from another site means the tab was somewhere else in between (for example back
    // on a job board), so this is a new visit and the reminder should show.
    if (new URL(document.referrer).origin !== location.origin) return null;
    return sessionStorage.getItem(SESSION_KEY);
  } catch {
    return null; // No referrer, or the site blocks storage.
  }
}

const AUTO_APPLIED_KEY = 'jat:autoApplied';

// Auto mode: clicking a button that submits the application marks the job as applied.
// The click only shows intent. If the form then refuses to submit, the toast with Undo is
// still on screen.
async function onPageClick(event: Event): Promise<void> {
  const key = currentKey;
  if (!key || !isSubmitLabel(clickedLabel(event))) return;
  if ((await getSettings()).mode !== 'auto') return;
  const record = await getJob(key);
  if (!record || record.status === 'applied') return;

  // A successful submit usually moves to a confirmation page right away, taking the toast with
  // it. Leave a note so that page can say what happened.
  try {
    sessionStorage.setItem(AUTO_APPLIED_KEY, key);
  } catch {
    // The site blocks storage. The job is still marked, just without a notice on the next page.
  }
  await markApplied(record, showSeenToast);
}

// The text of the button or link that was clicked, or '' if the click was on something else.
function clickedLabel(event: Event): string {
  for (const target of event.composedPath()) {
    // Not `instanceof HTMLElement`: an element inside a frame belongs to that frame's own
    // HTMLElement class, so the check would fail for it.
    const node = target as HTMLElement;
    if (node.nodeType !== Node.ELEMENT_NODE) continue;
    if (node.id === 'jat-toast') return ''; // our own buttons
    if (node.matches('button, input[type="submit"], input[type="button"], [role="button"], a')) {
      return node.innerText || (node as HTMLInputElement).value || node.ariaLabel || '';
    }
  }
  return '';
}

// A click inside a frame never reaches the page around it. iCIMS shows the application form in
// a frame, so listen inside every frame this page is allowed to read (frames from the same site).
function watchFrames(onClick: (event: Event) => void): void {
  const watch = (frame: HTMLIFrameElement) => {
    const listen = () => {
      try {
        frame.contentDocument?.addEventListener('click', onClick, true);
      } catch {
        // A frame from another site. It cannot be read, and is not an application form of ours.
      }
    };
    listen();
    // Each step of the form is a new document in the same frame.
    frame.addEventListener('load', listen);
  };

  document.querySelectorAll('iframe').forEach(watch);
  new MutationObserver((mutations) => {
    for (const { addedNodes } of mutations) {
      for (const node of addedNodes) {
        if (node instanceof HTMLIFrameElement) watch(node);
        else if (node instanceof Element) node.querySelectorAll('iframe').forEach(watch);
      }
    }
  }).observe(document, { childList: true, subtree: true });
}

// True once, on the first page after onPageClick marked this job.
function takeAutoAppliedNote(key: string): boolean {
  try {
    if (sessionStorage.getItem(AUTO_APPLIED_KEY) !== key) return false;
    sessionStorage.removeItem(AUTO_APPLIED_KEY);
    return true;
  } catch {
    return false;
  }
}

// `fresh` is true when the document was loaded with this URL, false when a single-page app
// changed the URL in place. Only a fresh page describes its own job (see readJobInfo).
async function handlePage(url: string, fresh: boolean): Promise<void> {
  const job = parseJobUrl(url);
  if (!job) {
    setCurrentKey(null);
    forgetPage();
    return;
  }

  const key = jobKey(job);
  // sameJob: another page of the job we were already on, e.g. the next step of an application.
  const sameJob = key === currentKey;
  setCurrentKey(key);
  if (!sameJob) forgetPage();

  // iCIMS rewrites its own address a moment after loading, which lands here a second time
  // while the first look at the job is still under way. Let the first one finish alone.
  if (sameJob && pendingKey === key) return;
  pendingKey = key;
  try {
    await showJob(job, key, url, sameJob, fresh);
  } finally {
    if (pendingKey === key) pendingKey = null;
  }
  // Later pages of the same job are application forms, not the job description. Scan once.
  if (!sameJob && currentKey === key) await flagKeywords(job, key, fresh);
}

// Warning categories found on the page being shown.
let pageFlags: string[] = [];
// The job that showJob is working on right now, if any.
let pendingKey: string | null = null;

// Clears what was on screen for the previous job.
function forgetPage(): void {
  dismissToast();
  setToastWarnings([]);
  pageFlags = [];
}

// Saves a record with the page's flags added. Toast buttons hold records that were built before
// the page was scanned, so saving those as they are would drop the flags.
function saveWithFlags(record: JobRecord): Promise<void> {
  return saveJob({ ...record, flags: [...new Set([...record.flags, ...pageFlags])] });
}

// Records the job or looks it up, and shows the toast that fits.
async function showJob(
  job: ParsedJob,
  key: string,
  url: string,
  sameJob: boolean,
  fresh: boolean,
): Promise<void> {
  // Read the language every time, so a change made on the dashboard shows on the next page.
  setLanguage((await getSettings()).language);
  setToastLink({
    label: t('toast.dashboard'),
    // A content script cannot open a tab itself, so it asks the background script to.
    onClick: () => void browser.runtime.sendMessage({ type: 'open-dashboard' }),
  });

  const existing = await getJob(key);
  if (existing) {
    // On later pages of the same job, keep offering "Mark as applied" while the job is only
    // viewed. Once it is applied, stay quiet.
    if (sameJob && existing.status === 'applied') {
      // The exception: this is the page right after a submit click marked the job. Say so once,
      // with a way to undo it.
      if (!takeAutoAppliedNote(key)) {
        dismissToast();
        return;
      }
      if (isToastOpen()) return;
      await pageSettled();
      if (currentKey !== key) return;
      const { appliedAt: _appliedAt, ...rest } = existing;
      showMarkedToast({ ...rest, status: 'viewed' }, showSeenToast);
      return;
    }
    if (sameJob && isToastOpen()) return;

    await pageSettled();
    if (currentKey !== key) return;
    const seen = await withPageInfo({ ...existing, lastSeenAt: Date.now() }, fresh);
    await saveJob(seen);
    if (currentKey !== key) return;
    // Some sites (Ashby) change the URL in place and then load the page again, so this code runs
    // twice within a moment. A job recorded seconds ago is still a first visit to the user.
    const justRecorded = seen.status === 'viewed' && seen.lastSeenAt - seen.firstSeenAt < 10_000;
    if (justRecorded) showViewedToast(seen);
    else showSeenToast(seen);
    return;
  }

  const { mode } = await getSettings();
  // Same job but no record. In auto mode that means the user clicked Undo: leave it alone.
  // In manual mode, ask again unless the question is still on screen.
  if (sameJob && (mode === 'auto' || isToastOpen())) return;

  const now = Date.now();
  const record: JobRecord = {
    ...job,
    key,
    url: normalizeUrl(url) ?? url,
    status: 'viewed',
    firstSeenAt: now,
    lastSeenAt: now,
    flags: [],
    source: mode,
  };

  if (mode === 'manual') {
    await pageSettled();
    if (currentKey !== key) return;
    const named = await withPageInfo(record, fresh);
    if (currentKey === key) showAskToast(named);
    return;
  }

  // Save first, so the visit counts even if the tab is closed right away. The title is added
  // once the page has settled.
  await saveJob(record);
  await pageSettled();
  if (currentKey !== key) return;
  const named = await withPageInfo(record, fresh);
  if (named !== record) await saveJob(named);
  if (currentKey === key) showViewedToast(named);
}

// Scans the job description for restrictive wording, shows what it finds in the toast, and
// stores the categories in the record's `flags`.
async function flagKeywords(job: ParsedJob, key: string, fresh: boolean): Promise<void> {
  const { keywordsEnabled, rules } = await getSettings();
  if (!keywordsEnabled) return;

  // After an in-page move on Workday, the previous job's text stays on screen for a moment.
  if (!fresh && job.ats === 'workday') {
    await waitFor(() => readWorkdayTitle(document, job.jobId), 5000);
  }
  await pageQuiet(document, 1000, 8000);
  if (currentKey !== key) return;

  const hits = scan(pageText(document), rules);
  pageFlags = [...new Set(hits.map((hit) => hit.category))];
  setToastWarnings(hits.map((hit) => ({ ...hit, category: categoryLabel(hit.category) })));

  // Read the record again: the user may have changed it while we waited. Flags are only ever
  // added, so opening an application form (which has no job description) does not clear them.
  // No record yet (manual mode): the flags are saved when the user clicks Record.
  const record = await getJob(key);
  if (!record) return;
  const flags = [...new Set([...record.flags, ...pageFlags])];
  if (flags.length !== record.flags.length) await saveJob({ ...record, flags });
}

// Adds the job title, and the company name where the page gives a good one. A record that
// already has a title is left alone.
async function withPageInfo(record: JobRecord, fresh: boolean): Promise<JobRecord> {
  if (record.title) return record;

  if (fresh) {
    // iCIMS builds the frame that holds the posting after the page has loaded, so give it a
    // moment to appear.
    const read = () => {
      const info = readJobInfo(document);
      return info.title ? info : undefined;
    };
    const { title, company } =
      (record.ats === 'icims' ? await waitFor(read, 4000) : read()) ?? readJobInfo(document);
    if (!title && !company) return record;
    // Workday names the legal entity ("2100 NVIDIA USA"), and gives no name at all after an
    // in-page move. Keep the name from the URL there so all records of a company match.
    const keepCompany = record.ats === 'workday' || !company;
    return { ...record, title, company: keepCompany ? record.company : company };
  }

  // Reached without a page load. Only Workday does this among the supported sites, and its job
  // details appear a moment after the URL changes.
  if (record.ats !== 'workday') return record;
  const title = await waitFor(() => readWorkdayTitle(document, record.jobId), 2000);
  return title ? { ...record, title } : record;
}

// Calls `read` a few times a second until it returns something, for at most `timeoutMs`.
async function waitFor<T>(read: () => T | undefined, timeoutMs: number): Promise<T | undefined> {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const value = read();
    if (value !== undefined || Date.now() >= deadline) return value;
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
}

// Toast text: the job's name on the first line when it is known, then the status line.
function describe(record: JobRecord, status: string): string {
  return record.title ? `${record.title} · ${record.company}\n${status}` : status;
}

// Manual mode, first visit: nothing is saved until the user clicks Record.
function showAskToast(record: JobRecord): void {
  showToast({
    title: t('toast.ask.title'),
    body: describe(record, t('toast.ask.body')),
    actions: [
      {
        label: t('action.record'),
        onClick: () => void saveWithFlags(record).then(() => showViewedToast(record)),
      },
      // Ignore saves nothing, so the question comes back on the next visit.
      { label: t('action.ignore'), onClick: () => {} },
    ],
  });
}

// First visit: the job was just recorded.
function showViewedToast(record: JobRecord): void {
  showToast({
    title: t('toast.recorded.title'),
    body: describe(record, t('toast.recorded.body')),
    actions: [
      { label: t('action.undo'), onClick: () => void deleteJob(record.key) },
      { label: t('action.markApplied'), onClick: () => void markApplied(record, showViewedToast) },
    ],
  });
}

// Repeat visit: the job was already in storage.
function showSeenToast(record: JobRecord): void {
  if (record.status === 'applied') {
    showToast({
      title: t('toast.applied.title'),
      body: describe(
        record,
        t('toast.applied.body', { date: formatDate(record.appliedAt ?? record.firstSeenAt) }),
      ),
    });
    return;
  }
  showToast({
    title: t('toast.seen.title'),
    body: describe(record, t('toast.seen.body', { date: formatDateTime(record.firstSeenAt) })),
    actions: [
      {
        label: t('action.markApplied'),
        onClick: () => void markApplied(record, showSeenToast),
      },
    ],
  });
}

// `showPrevious` is the toast to go back to when the user clicks Undo.
async function markApplied(
  record: JobRecord,
  showPrevious: (record: JobRecord) => void,
): Promise<void> {
  await saveWithFlags({ ...record, status: 'applied', appliedAt: Date.now() });
  showMarkedToast(record, showPrevious);
}

// `viewed` is the record as it was before it was marked, so saving it again undoes the change.
function showMarkedToast(viewed: JobRecord, showPrevious: (record: JobRecord) => void): void {
  showToast({
    title: t('toast.marked.title'),
    body: describe(viewed, t('toast.marked.body')),
    actions: [
      {
        label: t('action.undo'),
        onClick: () => void saveWithFlags(viewed).then(() => showPrevious(viewed)),
      },
    ],
  });
}

// Pages that React renders on the server (Greenhouse) rebuild their whole document if the DOM
// changes before React has started up. So wait for the page to load, then a little longer,
// before adding anything to it.
// ponytail: fixed delay, because extensions get no "React is ready" signal. A toast survives a
// rebuild anyway (see lib/toast.ts); this only avoids causing one.
async function pageSettled(): Promise<void> {
  if (document.readyState !== 'complete') {
    await new Promise((resolve) => window.addEventListener('load', resolve, { once: true }));
  }
  await new Promise((resolve) => setTimeout(resolve, 500));
}
