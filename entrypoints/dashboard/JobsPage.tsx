import { useRef, useState } from 'react';
import { formatDate, formatDateTime } from '@/lib/format';
import { categoryLabel, t, tCount } from '@/lib/i18n';
import type { MessageKey } from '@/lib/i18n';
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
import {
  addToCompanies,
  deleteJob,
  getCompanies,
  getJob,
  getSettings,
  saveJob,
  saveJobs,
  saveSettings,
} from '@/lib/store';
import type { JobRecord, JobStatus } from '@/lib/types';
import { Overview } from './Overview.tsx';

const NO_FILTER: JobFilter = { query: '', status: '', ats: '', flag: '' };

const COLUMNS: [key: SortKey, label: MessageKey][] = [
  ['lastSeenAt', 'column.lastSeen'],
  ['company', 'column.company'],
  ['title', 'column.title'],
  ['ats', 'column.site'],
  ['status', 'column.status'],
];

const siteName = (ats: string) => (ats === 'other' ? t('sites.other') : ats);

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
        <h2>{t('tab.jobs')}</h2>
        <AddUrl />
        <Transfer jobs={jobs} />

        <div className="filters">
          <input
            type="search"
            aria-label={t('filter.search')}
            placeholder={t('filter.search')}
            value={filter.query}
            onChange={(event) => setFilter({ ...filter, query: event.target.value })}
          />
          <select
            aria-label={t('column.status')}
            value={filter.status}
            onChange={(event) => setFilter({ ...filter, status: event.target.value as JobFilter['status'] })}
          >
            <option value="">{t('filter.anyStatus')}</option>
            <option value="viewed">{t('status.viewed')}</option>
            <option value="applied">{t('status.applied')}</option>
          </select>
          <select aria-label={t('column.site')} value={filter.ats} onChange={(event) => setFilter({ ...filter, ats: event.target.value })}>
            <option value="">{t('filter.anySite')}</option>
            {sites.map((site) => (
              <option key={site} value={site}>
                {siteName(site)}
              </option>
            ))}
          </select>
          <select aria-label={t('filter.warning')} value={filter.flag} onChange={(event) => setFilter({ ...filter, flag: event.target.value })}>
            <option value="">{t('filter.anyWarning')}</option>
            {flags.map((flag) => (
              <option key={flag} value={flag}>
                {categoryLabel(flag)}
              </option>
            ))}
          </select>
          {filtering && (
            <button type="button" onClick={() => setFilter(NO_FILTER)}>
              {t('filter.clear')}
            </button>
          )}
          <span className="hint count-shown">
            {t('filter.count', { shown: shown.length, total: jobs.length })}
          </span>
        </div>

        {jobs.length === 0 ? (
          <p className="empty">
            {t('jobs.empty')}
          </p>
        ) : shown.length === 0 ? (
          <p className="empty">{t('jobs.noMatch')}</p>
        ) : (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  {COLUMNS.map(([key, label]) => (
                    <th key={key} aria-sort={sort.key !== key ? undefined : sort.descending ? 'descending' : 'ascending'}>
                      <button type="button" onClick={() => sortBy(key)}>
                        {t(label)}
                        {sort.key === key && (sort.descending ? ' ↓' : ' ↑')}
                      </button>
                    </th>
                  ))}
                  <th>{t('column.warnings')}</th>
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
    const name = job.title
      ? t('row.titleAtCompany', { title: job.title, company: job.company })
      : job.company;
    if (confirm(t('row.confirmDelete', { name }))) void deleteJob(job.key);
  };
  // Enter saves by leaving the field.
  const blurOnEnter = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') event.currentTarget.blur();
  };

  return (
    <tr>
      <td
        className="nowrap"
        title={[
          t('row.firstSeen', { date: formatDateTime(job.firstSeenAt) }),
          job.appliedAt && t('row.appliedAt', { date: formatDateTime(job.appliedAt) }),
        ]
          .filter(Boolean)
          .join('\n')}
      >
        {formatDate(job.lastSeenAt)}
      </td>
      <td>
        <input
          className="cell"
          aria-label={t('column.company')}
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
          aria-label={t('column.title')}
          placeholder={t('row.addTitle')}
          key={job.title ?? ''}
          defaultValue={job.title ?? ''}
          onBlur={(event) => rename('title', event.target.value)}
          onKeyDown={blurOnEnter}
        />
      </td>
      <td>{siteName(job.ats)}</td>
      <td>
        <select
          aria-label={t('column.status')}
          value={job.status}
          onChange={(event) => {
            const status = event.target.value as JobStatus;
            void update((latest) => withStatus(latest, status, Date.now()));
          }}
        >
          <option value="viewed">{t('status.viewed')}</option>
          <option value="applied">{t('status.applied')}</option>
        </select>
      </td>
      <td>
        {job.flags.map((flag) => (
          <span className="tag" key={flag}>
            {categoryLabel(flag)}
          </span>
        ))}
      </td>
      <td className="nowrap">
        <a href={job.url} target="_blank" rel="noreferrer">
          {t('row.open')}
        </a>
        <button type="button" className="quiet" onClick={remove}>
          {t('row.delete')}
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
      return setMessage({ text: t('add.invalid'), error: true });
    }
    if (await getJob(record.key)) {
      return setMessage({ text: t('add.exists'), error: true });
    }
    await saveJob(applied ? withStatus(record, 'applied', now) : record);
    setUrl('');
    setMessage({ text: t('add.done'), error: false });
  };

  return (
    <form className="add" onSubmit={(event) => void add(event)}>
      <input
        aria-label={t('add.label')}
        placeholder={t('add.placeholder')}
        value={url}
        onChange={(event) => {
          setUrl(event.target.value);
          setMessage(undefined);
        }}
      />
      <label>
        <input type="checkbox" checked={applied} onChange={(event) => setApplied(event.target.checked)} />
        {t('add.applied')}
      </label>
      <button type="submit" disabled={!url.trim()}>
        {t('add.button')}
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
      companies: await getCompanies(),
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
    const companiesAdded = await addToCompanies(result.companies);

    const parts = [tCount('import.new', records.length - merged), t('import.merged', { n: merged })];
    if (result.skipped > 0) parts.push(tCount('import.skipped', result.skipped));
    if (result.settings) parts.push(t('import.settings'));
    if (companiesAdded > 0) parts.push(t('import.companies', { n: companiesAdded }));
    setMessage({ text: parts.join(t('list.separator')) + t('list.end'), error: false });
  };

  return (
    <div className="transfer">
      <button type="button" onClick={() => void exportJson()}>
        {t('transfer.exportJson')}
      </button>
      <button type="button" onClick={exportCsv}>
        {t('transfer.exportCsv')}
      </button>
      <button type="button" onClick={() => picker.current?.click()}>
        {t('transfer.importJson')}
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
