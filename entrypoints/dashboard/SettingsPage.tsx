import { useEffect, useState } from 'react';
import { setLanguage, t } from '@/lib/i18n';
import type { Language } from '@/lib/i18n';
import { DEFAULT_RULES, ruleError } from '@/lib/keywords';
import { getSettings, saveSettings } from '@/lib/store';
import type { KeywordRule, Settings } from '@/lib/types';

export function SettingsPage({ onLanguageChange }: { onLanguageChange: () => void }) {
  const [settings, setSettings] = useState<Settings | null>(null);

  useEffect(() => {
    void getSettings().then(setSettings);
  }, []);

  if (!settings) return null; // still loading

  const errors = settings.rules.map(ruleError);
  const allValid = errors.every((error) => error === null);

  // Every change is saved right away, as long as all rules are usable. While one is not, nothing
  // is saved and the page says so.
  const update = (next: Settings) => {
    setSettings(next);
    if (next.rules.every((rule) => ruleError(rule) === null)) void saveSettings(next);
  };
  const setRules = (rules: KeywordRule[]) => update({ ...settings, rules });
  const editRule = (index: number, change: Partial<KeywordRule>) =>
    setRules(settings.rules.map((rule, i) => (i === index ? { ...rule, ...change } : rule)));

  const changeLanguage = (language: Language) => {
    update({ ...settings, language });
    setLanguage(language);
    onLanguageChange();
  };

  return (
    <>
      <section>
        <h2>{t('settings.language')}</h2>
        <select
          aria-label={t('settings.language')}
          value={settings.language}
          onChange={(event) => changeLanguage(event.target.value as Language)}
        >
          <option value="auto">{t('language.auto')}</option>
          <option value="en">English</option>
          <option value="zh">中文</option>
        </select>
      </section>

      <section>
        <h2>{t('settings.recording')}</h2>
        <label className="choice">
          <input
            type="radio"
            name="mode"
            checked={settings.mode === 'auto'}
            onChange={() => update({ ...settings, mode: 'auto' })}
          />
          <span>
            <strong>{t('settings.auto')}</strong>
            <small>{t('settings.auto.hint')}</small>
          </span>
        </label>
        <label className="choice">
          <input
            type="radio"
            name="mode"
            checked={settings.mode === 'manual'}
            onChange={() => update({ ...settings, mode: 'manual' })}
          />
          <span>
            <strong>{t('settings.manual')}</strong>
            <small>{t('settings.manual.hint')}</small>
          </span>
        </label>
      </section>

      <section>
        <h2>{t('settings.warnings')}</h2>
        <label className="choice">
          <input
            type="checkbox"
            checked={settings.keywordsEnabled}
            onChange={(event) => update({ ...settings, keywordsEnabled: event.target.checked })}
          />
          <span>
            <strong>{t('settings.scan')}</strong>
            <small>{t('settings.scan.hint')}</small>
          </span>
        </label>

        <h3>{t('settings.rules')}</h3>
        <p className="hint">{t('settings.rules.hint')}</p>
        <div className="rules">
          {settings.rules.map((rule, index) => (
            // Rows have no identity of their own, so the position is the key.
            <div className="rule" key={index}>
              <input
                aria-label={t('rule.category')}
                placeholder={t('rule.category')}
                value={rule.category}
                onChange={(event) => editRule(index, { category: event.target.value })}
              />
              <input
                aria-label={t('rule.pattern')}
                className="pattern"
                placeholder={t('rule.pattern')}
                spellCheck={false}
                value={rule.pattern}
                aria-invalid={errors[index] !== null}
                onChange={(event) => editRule(index, { pattern: event.target.value })}
              />
              <button
                type="button"
                aria-label={t('rule.delete', { n: index + 1 })}
                onClick={() => setRules(settings.rules.filter((_, i) => i !== index))}
              >
                {t('row.delete')}
              </button>
              {errors[index] && <p className="error">{errors[index]}</p>}
            </div>
          ))}
        </div>
        <div className="row">
          <button
            type="button"
            onClick={() => setRules([...settings.rules, { category: '', pattern: '' }])}
          >
            {t('rule.add')}
          </button>
          <button type="button" onClick={() => setRules(DEFAULT_RULES)}>
            {t('rule.restore')}
          </button>
        </div>
      </section>

      <p className={allValid ? 'status' : 'status error'} role="status">
        {allValid ? t('settings.saved') : t('settings.notSaved')}
      </p>
    </>
  );
}
