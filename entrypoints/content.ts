import { normalizeUrl, parseJobUrl } from '@/lib/ats';
import { getJob, saveJob } from '@/lib/store';
import { showToast } from '@/lib/toast';

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
    // Temporary: hard-coded toast for M1.7. Real content comes in M1.8.
    void pageSettled().then(() =>
      showToast({ title: 'Job Application Tracker', body: 'This is a test toast.' }),
    );

    const job = parseJobUrl(location.href);
    if (!job) return;

    const key = `${job.ats}:${job.company}:${job.jobId}`;
    if (await getJob(key)) return;

    const now = Date.now();
    await saveJob({
      ...job,
      key,
      url: normalizeUrl(location.href) ?? location.href,
      status: 'viewed',
      firstSeenAt: now,
      lastSeenAt: now,
      flags: [],
      source: 'auto',
    });
    console.log('[JAT] saved:', key);
  },
});

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
