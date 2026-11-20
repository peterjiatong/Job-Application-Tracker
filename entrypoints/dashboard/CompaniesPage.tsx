import { useEffect, useState } from 'react';
import { COMPANY_LISTS, DEFAULT_COLORS, textColorOn } from '@/lib/companies';
import type { CompanyList, CompanyLists } from '@/lib/companies';
import { t, tCount } from '@/lib/i18n';
import {
  addToCompanies,
  getCompanyLists,
  getSettings,
  onCompaniesChanged,
  saveCompanies,
  saveSettings,
} from '@/lib/store';
import type { Settings } from '@/lib/types';

// The two company lists: not interested and interested. Names on them are highlighted on job
// boards and application sites, each list in its own colour.
export function CompaniesPage() {
  const [lists, setLists] = useState<CompanyLists>();
  const [settings, setSettings] = useState<Settings>();

  useEffect(() => {
    const load = () => void getCompanyLists().then(setLists);
    load();
    void getSettings().then(setSettings);
    // Names can also arrive from the popup or the right-click menu while this page is open.
    return onCompaniesChanged(load);
  }, []);

  if (!lists || !settings) return null; // still loading

  const update = (next: Settings) => {
    setSettings(next);
    void saveSettings(next);
  };
  const customColors = COMPANY_LISTS.some((list) => settings.highlightColors[list] !== DEFAULT_COLORS[list]);

  return (
    <>
      <section>
        <label className="choice">
          <input
            type="checkbox"
            checked={settings.highlightEnabled}
            onChange={(event) => update({ ...settings, highlightEnabled: event.target.checked })}
          />
          <span>
            <strong>{t('avoid.enable')}</strong>
            <small>{t('avoid.enable.hint')}</small>
          </span>
        </label>
        {customColors && (
          <button type="button" onClick={() => update({ ...settings, highlightColors: DEFAULT_COLORS })}>
            {t('companies.resetColors')}
          </button>
        )}
      </section>

      {COMPANY_LISTS.map((list) => (
        <CompanyListSection
          key={list}
          list={list}
          names={lists[list]}
          color={settings.highlightColors[list]}
          onColor={(color) =>
            update({ ...settings, highlightColors: { ...settings.highlightColors, [list]: color } })
          }
        />
      ))}
    </>
  );
}

function CompanyListSection(props: {
  list: CompanyList;
  names: string[];
  color: string;
  onColor: (color: string) => void;
}) {
  const { list, names, color } = props;
  const [text, setText] = useState('');
  const [message, setMessage] = useState<string>();

  const add = async (event: React.FormEvent) => {
    event.preventDefault();
    const added = await addToCompanies(list, text.split('\n'));
    setMessage(added > 0 ? tCount('avoid.added', added) : t('avoid.nothingNew'));
    if (added > 0) setText('');
  };
  // Shown the way the name will look on a page.
  const swatch = { background: color, color: textColorOn(color), borderColor: color };

  return (
    <section className={`company-list ${list}`}>
      <h2>{t(`${list}.title`)}</h2>
      <label className="color">
        {t('companies.color')}
        <input type="color" value={color} onChange={(event) => props.onColor(event.target.value)} />
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

      {names.length === 0 ? (
        <p className="empty">{t('avoid.empty')}</p>
      ) : (
        <>
          <p className="hint">{tCount('avoid.count', names.length)}</p>
          <ul className="companies">
            {names.map((name) => (
              <li key={name} style={swatch}>
                {name}
                <button
                  type="button"
                  style={{ color: swatch.color }}
                  aria-label={t('avoid.remove', { name })}
                  onClick={() => void saveCompanies(list, names.filter((other) => other !== name))}
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
