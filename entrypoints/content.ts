import { normalizeUrl, parseJobUrl } from '@/lib/ats';
import { deleteJob, getJob, saveJob } from '@/lib/store';
import { showToast } from '@/lib/toast';
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
  async main() {
    const job = parseJobUrl(location.href);
    if (!job) return;

    const key = `${job.ats}:${job.company}:${job.jobId}`;
    if (await getJob(key)) return;

    const now = Date.now();
    const record: JobRecord = {
      ...job,
      key,
      url: normalizeUrl(location.href) ?? location.href,
      status: 'viewed',
      firstSeenAt: now,
      lastSeenAt: now,
      flags: [],
      source: 'auto',
    };
    await saveJob(record);

    await pageSettled();
    showViewedToast(record);
  },
});

function showViewedToast(record: JobRecord): void {
  showToast({
    title: 'Job recorded',
    body: 'Saved as viewed.',
    actions: [
      { label: 'Undo', onClick: () => void deleteJob(record.key) },
      { label: 'Mark as applied', onClick: () => void markApplied(record) },
    ],
  });
}

async function markApplied(record: JobRecord): Promise<void> {
  await saveJob({ ...record, status: 'applied', appliedAt: Date.now() });
  showToast({
    title: 'Marked as applied',
    body: 'Saved as applied.',
    // `record` is still the viewed version, so saving it again undoes the change.
    actions: [{ label: 'Undo', onClick: () => void unmarkApplied(record) }],
  });
}

async function unmarkApplied(record: JobRecord): Promise<void> {
  await saveJob(record);
  showViewedToast(record);
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
