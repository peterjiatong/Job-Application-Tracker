import { useRef, useState } from 'react';
import { formatDate, formatDateTime } from '@/lib/format';
import {
  EXPORT_VERSION,
  filterJobs,
  mergeJob,
  parseImport,
  recordForUrl,
  sortJobs,
  toCsv,
  withStatus,
} from '@/lib/records';
import type { ExportFile, JobFilter, SortKey } from '@/lib/records';
import { deleteJob, getJob, getSettings, saveJob, saveJobs, saveSettings } from '@/lib/store';
import type { JobRecord, JobStatus } from '@/lib/types';
import { Overview } from './Overview.tsx';

const NO_FILTER: JobFilter = { query: '', status: '', ats: '', flag: '' };

const COLUMNS: [key: SortKey, label: string][] = [
  ['lastSeenAt', 'Last seen'],
  ['company', 'Company'],
  ['title', 'Title'],
  ['ats', 'Site'],
  ['status', 'Status'],
];

export function JobsPage({ jobs }: { jobs: JobRecord[] }) {
  const [filter, setFilter] = useState(NO_FILTER);
  const [sort, setSort] = useState<{ key: SortKey; descending: boolean }>({
    key: 'lastSeenAt',
    descending: true,
  });

  const shown = sortJobs(filterJobs(jobs, filter), sort.key, sort.descending);
  const sites = [...new Set(jobs.map((job) => job.ats))].sort();
  const flags = [...new Set(jobs.flatMap((job) => job.flags))].sort();
  const filtering = JSON.stringify(filter) !== JSON.stringify(NO_FILTER);

  // Clicking the sorted column flips its direction. A new column starts A to Z, dates newest first.
  const sortBy = (key: SortKey) =>
    setSort(
      key === sort.key
        ? { key, descending: !sort.descending }
        : { key, descending: key === 'lastSeenAt' },
    );

  return (
    <>
      <Overview jobs={jobs} />

      <section>
        <h2>Jobs</h2>
        <AddUrl />
        <Transfer jobs={jobs} />

        <div className="filters">
          <input
            type="search"
            aria-label="Search company and title"
            placeholder="Search company and title"
            value={filter.query}
            onChange={(event) => setFilter({ ...filter, query: event.target.value })}
          />
          <select
            aria-label="Status"
            value={filter.status}
            onChange={(event) => setFilter({ ...filter, status: event.target.value as JobFilter['status'] })}
          >
            <option value="">Any status</option>
            <option value="viewed">Viewed</option>
            <option value="applied">Applied</option>
          </select>
          <select aria-label="Site" value={filter.ats} onChange={(event) => setFilter({ ...filter, ats: event.target.value })}>
            <option value="">Any site</option>
            {sites.map((site) => (
              <option key={site}>{site}</option>
            ))}
          </select>
          <select aria-label="Warning" value={filter.flag} onChange={(event) => setFilter({ ...filter, flag: event.target.value })}>
            <option value="">Any warning</option>
            {flags.map((flag) => (
              <option key={flag}>{flag}</option>
            ))}
          </select>
          {filtering && (
            <button type="button" onClick={() => setFilter(NO_FILTER)}>
              Clear
            </button>
          )}
          <span className="hint count-shown">
            {shown.length} of {jobs.length}
          </span>
        </div>

        {jobs.length === 0 ? (
          <p className="empty">
            No jobs recorded yet. Open a job posting on a supported site, or add its address above.
          </p>
        ) : shown.length === 0 ? (
          <p className="empty">No jobs match these filters.</p>
        ) : (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  {COLUMNS.map(([key, label]) => (
                    <th key={key} aria-sort={sort.key !== key ? undefined : sort.descending ? 'descending' : 'ascending'}>
                      <button type="button" onClick={() => sortBy(key)}>
                        {label}
                        {sort.key === key && (sort.descending ? ' ↓' : ' ↑')}
                      </button>
                    </th>
                  ))}
                  <th>Warnings</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {shown.map((job) => (
                  <Row job={job} key={job.key} />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}

// One job. Company and title are edited in place and saved when the field loses focus.
// Every change goes to storage; the list then refreshes itself (see useJobs).
function Row({ job }: { job: JobRecord }) {
  // Applies a change to the stored record rather than to the copy this row was drawn from,
  // which can be a moment out of date right after another edit.
  const update = async (change: (latest: JobRecord) => JobRecord) => {
    await saveJob(change((await getJob(job.key)) ?? job));
  };
  const rename = (field: 'company' | 'title', value: string) => {
    const text = value.trim();
    if (text === (job[field] ?? '')) return;
    if (field === 'company') {
      if (text) void update((latest) => ({ ...latest, company: text })); // a company name cannot be empty
    } else {
      void update(({ title: _title, ...rest }) => (text ? { ...rest, title: text } : rest));
    }
  };
  const remove = () => {
    const name = job.title ? `${job.title} at ${job.company}` : job.company;
    if (confirm(`Delete "${name}"? This cannot be undone.`)) void deleteJob(job.key);
  };
  // Enter saves by leaving the field.
  const blurOnEnter = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') event.currentTarget.blur();
  };

  return (
    <tr>
      <td
        className="nowrap"
        title={`First seen ${formatDateTime(job.firstSeenAt)}${job.appliedAt ? `\nApplied ${formatDateTime(job.appliedAt)}` : ''}`}
      >
        {formatDate(job.lastSeenAt)}
      </td>
      <td>
        <input
          className="cell"
          aria-label="Company"
          // The key makes the field show the stored value again after it changes elsewhere.
          key={job.company}
          defaultValue={job.company}
          onBlur={(event) => rename('company', event.target.value)}
          onKeyDown={blurOnEnter}
        />
      </td>
      <td className="wide">
        <input
          className="cell"
          aria-label="Title"
          placeholder="Add a title"
          key={job.title ?? ''}
          defaultValue={job.title ?? ''}
          onBlur={(event) => rename('title', event.target.value)}
          onKeyDown={blurOnEnter}
        />
      </td>
      <td>{job.ats}</td>
      <td>
        <select
          aria-label="Status"
          value={job.status}
          onChange={(event) => {
            const status = event.target.value as JobStatus;
            void update((latest) => withStatus(latest, status, Date.now()));
          }}
        >
          <option value="viewed">Viewed</option>
          <option value="applied">Applied</option>
        </select>
      </td>
      <td>
        {job.flags.map((flag) => (
          <span className="tag" key={flag}>
            {flag}
          </span>
        ))}
      </td>
      <td className="nowrap">
        <a href={job.url} target="_blank" rel="noreferrer">
          Open
        </a>
        <button type="button" className="quiet" onClick={remove}>
          Delete
        </button>
      </td>
    </tr>
  );
}

// Records a job from its address, for pages the extension did not notice by itself.
function AddUrl() {
  const [url, setUrl] = useState('');
  const [applied, setApplied] = useState(false);
  const [message, setMessage] = useState<{ text: string; error: boolean }>();

  const add = async (event: React.FormEvent) => {
    event.preventDefault();
    const now = Date.now();
    const record = recordForUrl(url.trim(), now, 'manual');
    if (!record) {
      return setMessage({ text: 'That is not a web address. It should start with https://', error: true });
    }
    if (await getJob(record.key)) {
      return setMessage({ text: 'This job is already recorded.', error: true });
    }
    await saveJob(applied ? withStatus(record, 'applied', now) : record);
    setUrl('');
    setMessage({ text: 'Added.', error: false });
  };

  return (
    <form className="add" onSubmit={(event) => void add(event)}>
      <input
        aria-label="Job address"
        placeholder="Paste the address of a job posting"
        value={url}
        onChange={(event) => {
          setUrl(event.target.value);
          setMessage(undefined);
        }}
      />
      <label>
        <input type="checkbox" checked={applied} onChange={(event) => setApplied(event.target.checked)} />
        Already applied
      </label>
      <button type="submit" disabled={!url.trim()}>
        Add
      </button>
      {message && (
        <p className={message.error ? 'error' : 'hint'} role="status">
          {message.text}
        </p>
      )}
    </form>
  );
}

function download(name: string, type: string, text: string) {
  const link = document.createElement('a');
  link.href = URL.createObjectURL(new Blob([text], { type }));
  link.download = name;
  link.click();
  URL.revokeObjectURL(link.href);
}

// Export to a file and import from one.
function Transfer({ jobs }: { jobs: JobRecord[] }) {
  const picker = useRef<HTMLInputElement>(null);
  const [message, setMessage] = useState<{ text: string; error: boolean }>();
  const day = new Date().toISOString().slice(0, 10);

  const exportJson = async () => {
    const file: ExportFile = {
      version: EXPORT_VERSION,
      exportedAt: new Date().toISOString(),
      settings: await getSettings(),
      jobs,
    };
    download(`job-application-tracker-${day}.json`, 'application/json', JSON.stringify(file, null, 2));
  };
  // The leading mark tells Excel the file is UTF-8, so accented letters in titles survive.
  const exportCsv = () => download(`job-application-tracker-${day}.csv`, 'text/csv', `﻿${toCsv(jobs)}`);

  const importFile = async (file: File) => {
    const result = parseImport(await file.text());
    if ('error' in result) return setMessage({ text: result.error, error: true });

    const stored = new Map(jobs.map((job) => [job.key, job]));
    let merged = 0;
    const records = result.jobs.map((job) => {
      const existing = stored.get(job.key);
      if (!existing) return job;
      merged += 1;
      return mergeJob(existing, job);
    });
    await saveJobs(records);
    if (result.settings) await saveSettings(result.settings);

    const count = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;
    const parts = [
      `Imported ${count(records.length - merged, 'new job', 'new jobs')}`,
      `merged ${merged} with jobs already here`,
    ];
    if (result.skipped > 0) {
      parts.push(`skipped ${count(result.skipped, 'entry that was', 'entries that were')} not valid`);
    }
    if (result.settings) parts.push('restored the settings');
    setMessage({ text: `${parts.join(', ')}.`, error: false });
  };

  return (
    <div className="transfer">
      <button type="button" onClick={() => void exportJson()}>
        Export JSON
      </button>
      <button type="button" onClick={exportCsv}>
        Export CSV
      </button>
      <button type="button" onClick={() => picker.current?.click()}>
        Import JSON
      </button>
      <input
        ref={picker}
        type="file"
        accept="application/json,.json"
        hidden
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) void importFile(file);
          event.target.value = ''; // so that choosing the same file again works
        }}
      />
      {message && (
        <p className={message.error ? 'error' : 'hint'} role="status">
          {message.text}
        </p>
      )}
    </div>
  );
}
