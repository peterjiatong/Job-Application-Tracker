import { afterEach, describe, expect, it } from 'vitest';
import { MESSAGES, categoryLabel, dateLocale, setLanguage, t, tCount } from './i18n';
import type { MessageKey } from './i18n';

afterEach(() => setLanguage('en'));

const placeholders = (text: string) => [...text.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();

describe('messages', () => {
  it('have a Chinese text with the same placeholders for every English one', () => {
    for (const key of Object.keys(MESSAGES.en) as MessageKey[]) {
      expect(MESSAGES.zh[key], key).toBeTruthy();
      expect(placeholders(MESSAGES.zh[key]), key).toEqual(placeholders(MESSAGES.en[key]));
    }
  });
});

describe('t', () => {
  it('fills in values and follows the chosen language', () => {
    expect(t('toast.applied.body', { date: 'Nov 5, 2026' })).toBe('Applied on Nov 5, 2026.');
    setLanguage('zh');
    expect(t('toast.applied.body', { date: '2026年11月5日' })).toBe('申请于 2026年11月5日。');
    expect(dateLocale()).toBe('zh-CN');
    setLanguage('en');
    expect(t('action.undo')).toBe('Undo');
    expect(dateLocale()).toBe('en-US');
  });

  it('picks singular or plural', () => {
    expect(tCount('import.new', 1)).toBe('Imported 1 new job');
    expect(tCount('import.new', 3)).toBe('Imported 3 new jobs');
    setLanguage('zh');
    expect(tCount('import.new', 1)).toBe('导入了 1 个新岗位');
  });
});

describe('categoryLabel', () => {
  it('translates the built-in categories and leaves the user\'s own alone', () => {
    setLanguage('zh');
    expect(categoryLabel('Clearance')).toBe('安全许可');
    expect(categoryLabel('Early career')).toBe('Early career');
    setLanguage('en');
    expect(categoryLabel('Clearance')).toBe('Clearance');
  });
});
