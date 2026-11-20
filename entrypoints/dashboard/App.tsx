import { useEffect, useState } from 'react';
import { listJobs, onJobsChanged } from '@/lib/store';
import type { JobRecord } from '@/lib/types';
import { JobsPage } from './JobsPage.tsx';
import { SettingsPage } from './SettingsPage.tsx';

// All recorded jobs, kept up to date: the list is read again whenever any tab adds or changes a
// record. null while the first read is still running.
function useJobs(): JobRecord[] | null {
  const [jobs, setJobs] = useState<JobRecord[] | null>(null);
  useEffect(() => {
    const load = () => void listJobs().then(setJobs);
    load();
    return onJobsChanged(load);
  }, []);
  return jobs;
}

export default function App() {
  const [tab, setTab] = useState<'jobs' | 'settings'>('jobs');
  const jobs = useJobs();

  return (
    <main>
      <header>
        <h1>Job Application Tracker</h1>
        <nav>
          <button type="button" aria-current={tab === 'jobs'} onClick={() => setTab('jobs')}>
            Jobs
          </button>
          <button type="button" aria-current={tab === 'settings'} onClick={() => setTab('settings')}>
            Settings
          </button>
        </nav>
      </header>
      {tab === 'settings' ? <SettingsPage /> : jobs && <JobsPage jobs={jobs} />}
    </main>
  );
}
