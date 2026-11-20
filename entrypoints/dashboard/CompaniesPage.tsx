import { useEffect, useState } from 'react';
import { t, tCount } from '@/lib/i18n';
import {
  addToCompanies,
  getCompanies,
  getSettings,
  onCompaniesChanged,
  saveCompanies,
  saveSettings,
} from '@/lib/store';
import type { Settings } from '@/lib/types';

// The companies the user is not interested in. Their names are highlighted in red on job boards
// and application sites.
export function CompaniesPage() {
  const [companies, setCompanies] = useState<string[]>();
  const [settings, setSettings] = useState<Settings>();
  const [text, setText] = useState('');
  const [message, setMessage] = useState<string>();

  useEffect(() => {
    const load = () => void getCompanies().then(setCompanies);
    load();
    void getSettings().then(setSettings);
    // Names can also arrive from the popup or the right-click menu while this page is open.
    return onCompaniesChanged(load);
  }, []);

  if (!companies || !settings) return null; // still loading

  const add = async (event: React.FormEvent) => {
    event.preventDefault();
    const added = await addToCompanies(text.split('\n'));
    setMessage(added > 0 ? tCount('avoid.added', added) : t('avoid.nothingNew'));
    if (added > 0) setText('');
  };
  const setEnabled = (highlightEnabled: boolean) => {
    const next = { ...settings, highlightEnabled };
    setSettings(next);
    void saveSettings(next);
  };

  return (
    <section>
      <h2>{t('avoid.title')}</h2>
      <label className="choice">
        <input
          type="checkbox"
          checked={settings.highlightEnabled}
          onChange={(event) => setEnabled(event.target.checked)}
        />
        <span>
          <strong>{t('avoid.enable')}</strong>
          <small>{t('avoid.enable.hint')}</small>
        </span>
      </label>

      <form className="add" onSubmit={(event) => void add(event)}>
        <textarea
          aria-label={t('avoid.placeholder')}
          placeholder={t('avoid.placeholder')}
          rows={3}
          value={text}
          onChange={(event) => {
            setText(event.target.value);
            setMessage(undefined);
          }}
        />
        <button type="submit" disabled={!text.trim()}>
          {t('add.button')}
        </button>
        {message && (
          <p className="hint" role="status">
            {message}
          </p>
        )}
      </form>

      {companies.length === 0 ? (
        <p className="empty">{t('avoid.empty')}</p>
      ) : (
        <>
          <p className="hint">{tCount('avoid.count', companies.length)}</p>
          <ul className="companies">
            {companies.map((name) => (
              <li key={name}>
                {name}
                <button
                  type="button"
                  aria-label={t('avoid.remove', { name })}
                  onClick={() => void saveCompanies(companies.filter((other) => other !== name))}
                >
                  ×
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
