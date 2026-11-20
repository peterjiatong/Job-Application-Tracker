import { normalizeUrl, parseJobUrl } from '@/lib/ats';
import { deleteJob, getJob, getSettings, saveJob } from '@/lib/store';
import { dismissToast, isToastOpen, showToast } from '@/lib/toast';
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
  ],
  main(ctx) {
    let handledUrl = location.href;
    void handlePage(handledUrl);

    // Single-page apps (Workday) switch pages by changing the URL without loading a new document,
    // so this script does not start again. WXT reports URL changes as an event.
    ctx.addEventListener(window, 'wxt:locationchange', () => {
      // The event also fires when the browser is about to leave for a new document. In that case
      // the URL of this document never changes, and the script on the new page handles it.
      // So wait a moment and only react if this document's own URL really changed.
      ctx.setTimeout(() => {
        if (location.href === handledUrl) return;
        handledUrl = location.href;
        void handlePage(handledUrl);
      }, 0);
    });
  },
});

// Key of the job on the page being shown. It tells "another page of the same job" apart from
// "a different job", and lets a slow run notice that the user has already moved on.
let currentKey: string | null = null;

async function handlePage(url: string): Promise<void> {
  const job = parseJobUrl(url);
  if (!job) {
    currentKey = null;
    dismissToast();
    return;
  }

  const key = `${job.ats}:${job.company}:${job.jobId}`;
  const sameJob = key === currentKey;
  currentKey = key;
  const existing = await getJob(key);

  if (sameJob) {
    // Another page of the same job, e.g. the next step of an application form.
    // Keep offering "Mark as applied" while the job is only viewed; once applied, stay quiet.
    if (existing?.status === 'applied') dismissToast();
    else if (existing && !isToastOpen()) showSeenToast(existing);
    return;
  }

  dismissToast();

  if (existing) {
    const seen: JobRecord = { ...existing, lastSeenAt: Date.now() };
    await saveJob(seen);
    await pageSettled();
    if (currentKey !== key) return;
    // Some sites (Ashby) change the URL in place and then load the page again, so this code runs
    // twice within a moment. A job recorded seconds ago is still a first visit to the user.
    const justRecorded = seen.status === 'viewed' && seen.lastSeenAt - seen.firstSeenAt < 10_000;
    if (justRecorded) showViewedToast(seen);
    else showSeenToast(seen);
    return;
  }

  const { mode } = await getSettings();
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
    if (currentKey === key) showAskToast(record);
    return;
  }

  await saveJob(record);
  await pageSettled();
  if (currentKey === key) showViewedToast(record);
}

// Manual mode, first visit: nothing is saved until the user clicks Record.
function showAskToast(record: JobRecord): void {
  showToast({
    title: 'Record this job?',
    body: 'It is not in your tracker yet.',
    actions: [
      {
        label: 'Record',
        onClick: () => void saveJob(record).then(() => showViewedToast(record)),
      },
      // Ignore saves nothing, so the question comes back on the next visit.
      { label: 'Ignore', onClick: () => {} },
    ],
  });
}

// First visit: the job was just recorded.
function showViewedToast(record: JobRecord): void {
  showToast({
    title: 'Job recorded',
    body: 'Saved as viewed.',
    actions: [
      { label: 'Undo', onClick: () => void deleteJob(record.key) },
      { label: 'Mark as applied', onClick: () => void markApplied(record, showViewedToast) },
    ],
  });
}

// Repeat visit: the job was already in storage.
function showSeenToast(record: JobRecord): void {
  if (record.status === 'applied') {
    showToast({
      title: 'You applied to this job',
      body: `Applied on ${formatDate(record.appliedAt ?? record.firstSeenAt)}.`,
    });
    return;
  }
  showToast({
    title: "You've seen this job",
    body: `First viewed on ${formatDate(record.firstSeenAt)}.`,
    actions: [
      { label: 'Mark as applied', onClick: () => void markApplied(record, showSeenToast) },
    ],
  });
}

// `showPrevious` is the toast to go back to when the user clicks Undo.
async function markApplied(
  record: JobRecord,
  showPrevious: (record: JobRecord) => void,
): Promise<void> {
  await saveJob({ ...record, status: 'applied', appliedAt: Date.now() });
  showToast({
    title: 'Marked as applied',
    body: 'Saved as applied.',
    actions: [
      {
        label: 'Undo',
        // `record` is still the viewed version, so saving it again undoes the change.
        onClick: () => void saveJob(record).then(() => showPrevious(record)),
      },
    ],
  });
}

function formatDate(timestamp: number): string {
  return new Date(timestamp).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
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
