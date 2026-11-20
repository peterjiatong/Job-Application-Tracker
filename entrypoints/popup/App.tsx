import { useEffect, useState } from 'react';
import type { CompanyList } from '@/lib/companies';
import { formatDate } from '@/lib/format';
import { t } from '@/lib/i18n';
import { recordForUrl, withStatus } from '@/lib/records';
import { addToCompanies, getJob, getSettings, saveJob, saveSettings } from '@/lib/store';
import type { JobRecord, Settings } from '@/lib/types';

// What the popup knows about the tab it was opened on.
type Page = {
  // The record this page would get if it were recorded now.
  candidate: JobRecord;
  // The record already in storage, if there is one.
  stored: JobRecord | null;
};

export default function App() {
  // undefined: still loading. null: this page cannot be recorded (not a web page).
  const [page, setPage] = useState<Page | null>();
  const [settings, setSettings] = useState<Settings>();

  useEffect(() => {
    void (async () => {
      setSettings(await getSettings());
      const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
      const candidate = tab?.url ? recordForUrl(tab.url, Date.now(), 'manual') : null;
      if (!candidate) return setPage(null);
      // An unknown site has nothing better to show than the tab's title.
      if (candidate.ats === 'other' && tab?.title) candidate.title = tab.title;
      setPage({ candidate, stored: await getJob(candidate.key) });
    })();
  }, []);

  if (page === undefined || !settings) return null;

  const save = async (record: JobRecord) => {
    await saveJob(record);
    setPage(page && { ...page, stored: record });
  };
  const openDashboard = () => {
    void browser.tabs.create({ url: browser.runtime.getURL('/dashboard.html') });
    window.close();
  };
  const setAutomatic = (automatic: boolean) => {
    const next: Settings = { ...settings, mode: automatic ? 'auto' : 'manual' };
    setSettings(next);
    void saveSettings(next);
  };

  const shown = page?.stored ?? page?.candidate;

  return (
    <>
      {page === null ? (
        <p className="status">{t('popup.cannot')}</p>
      ) : (
        <>
          <p className="status">
            {!page.stored && t('popup.notRecorded')}
            {page.stored?.status === 'viewed' &&
              t('popup.viewed', { date: formatDate(page.stored.firstSeenAt) })}
            {page.stored?.status === 'applied' &&
              t('popup.applied', {
                date: formatDate(page.stored.appliedAt ?? page.stored.firstSeenAt),
              })}
          </p>
          <p className="job">{shown?.title ? `${shown.title} · ${shown.company}` : shown?.company}</p>
          {!page.stored && (
            <button type="button" onClick={() => void save(page.candidate)}>
              {t('popup.record')}
            </button>
          )}
          {page.stored?.status === 'viewed' && (
            <button type="button" onClick={() => void save(withStatus(page.stored!, 'applied', Date.now()))}>
              {t('action.markApplied')}
            </button>
          )}
          {page.stored?.status === 'applied' && (
            <button type="button" onClick={() => void save(withStatus(page.stored!, 'viewed', Date.now()))}>
              {t('popup.markNotApplied')}
            </button>
          )}
        </>
      )}

      {/* On a supported job page the company is known and offered; elsewhere the user types it. */}
      <AvoidCompany suggestion={shown && shown.ats !== 'other' ? shown.company : ''} />

      <label>
        <input
          type="checkbox"
          checked={settings.mode === 'auto'}
          onChange={(event) => setAutomatic(event.target.checked)}
        />
        {t('popup.auto')}
      </label>
      <button type="button" onClick={openDashboard}>
        {t('popup.dashboard')}
      </button>
    </>
  );
}

// Puts a company on the "not interested" or the "interested" list.
function AvoidCompany({ suggestion }: { suggestion: string }) {
  const [name, setName] = useState(suggestion);
  const [message, setMessage] = useState<string>();

  const add = async (list: CompanyList) => {
    const added = await addToCompanies(list, [name]);
    setMessage(added > 0 ? t('popup.avoid.added') : t('popup.avoid.exists'));
  };

  return (
    <div className="avoid">
      <span>{t('popup.avoid.label')}</span>
      <input
        aria-label={t('popup.avoid.placeholder')}
        placeholder={t('popup.avoid.placeholder')}
        value={name}
        onChange={(event) => {
          setName(event.target.value);
          setMessage(undefined);
        }}
      />
      <div>
        <button type="button" disabled={!name.trim()} onClick={() => void add('avoid')}>
          {t('popup.company.avoid')}
        </button>
        <button type="button" disabled={!name.trim()} onClick={() => void add('interested')}>
          {t('popup.company.interested')}
        </button>
      </div>
      {message && <p role="status">{message}</p>}
    </div>
  );
}
