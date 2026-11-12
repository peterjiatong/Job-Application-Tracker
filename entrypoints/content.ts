import { parseJobUrl } from '@/lib/ats';

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
  main() {
    console.log('[JAT] parsed:', parseJobUrl(location.href));
  },
});