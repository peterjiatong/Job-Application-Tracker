import { normalizeUrl, parseJobUrl } from '@/lib/ats';
import { getJob, saveJob } from '@/lib/store';

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