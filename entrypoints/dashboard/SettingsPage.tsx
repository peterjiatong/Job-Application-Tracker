import { useEffect, useState } from 'react';
import { DEFAULT_RULES, ruleError } from '@/lib/keywords';
import { getSettings, saveSettings } from '@/lib/store';
import type { KeywordRule, Settings } from '@/lib/types';

export function SettingsPage() {
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

  return (
    <>
      <section>
        <h2>Recording</h2>
        <label className="choice">
          <input
            type="radio"
            name="mode"
            checked={settings.mode === 'auto'}
            onChange={() => update({ ...settings, mode: 'auto' })}
          />
          <span>
            <strong>Automatic</strong>
            <small>Record a job as soon as you open its page.</small>
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
            <strong>Manual</strong>
            <small>Ask before recording a job.</small>
          </span>
        </label>
      </section>

      <section>
        <h2>Warnings</h2>
        <label className="choice">
          <input
            type="checkbox"
            checked={settings.keywordsEnabled}
            onChange={(event) => update({ ...settings, keywordsEnabled: event.target.checked })}
          />
          <span>
            <strong>Scan job descriptions</strong>
            <small>
              Warn about citizenship, clearance and visa sponsorship requirements, quoting the
              sentence that was found.
            </small>
          </span>
        </label>

        <h3>Rules</h3>
        <p className="hint">
          A rule is a regular expression, matched without regard to upper and lower case. Rules
          with the same category are shown together.
        </p>
        <div className="rules">
          {settings.rules.map((rule, index) => (
            // Rows have no identity of their own, so the position is the key.
            <div className="rule" key={index}>
              <input
                aria-label="Category"
                placeholder="Category"
                value={rule.category}
                onChange={(event) => editRule(index, { category: event.target.value })}
              />
              <input
                aria-label="Pattern"
                className="pattern"
                placeholder="Pattern"
                spellCheck={false}
                value={rule.pattern}
                aria-invalid={errors[index] !== null}
                onChange={(event) => editRule(index, { pattern: event.target.value })}
              />
              <button
                type="button"
                aria-label={`Delete rule ${index + 1}`}
                onClick={() => setRules(settings.rules.filter((_, i) => i !== index))}
              >
                Delete
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
            Add rule
          </button>
          <button type="button" onClick={() => setRules(DEFAULT_RULES)}>
            Restore default rules
          </button>
        </div>
      </section>

      <p className={allValid ? 'status' : 'status error'} role="status">
        {allValid ? 'All changes are saved.' : 'Not saved yet. Fix the rules marked above.'}
      </p>
    </>
  );
}
