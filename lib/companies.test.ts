import { describe, expect, it } from 'vitest';
import { addCompanies, cleanCompanyName, companyPattern } from './companies';

const found = (names: string[], text: string) => [...text.matchAll(companyPattern(names)!)].map((m) => m[0]);

describe('cleanCompanyName', () => {
  it('trims and collapses spaces', () => {
    expect(cleanCompanyName('  Acme   Robotics \n')).toBe('Acme Robotics');
  });

  it('rejects empty text and whole selected paragraphs', () => {
    expect(cleanCompanyName('   ')).toBe('');
    expect(cleanCompanyName('word '.repeat(30))).toBe('');
  });
});

describe('addCompanies', () => {
  it('adds new names and keeps the list sorted', () => {
    expect(addCompanies(['Globex'], [' acme ', 'Initech'])).toEqual(['acme', 'Globex', 'Initech']);
  });

  it('does not add a name twice, whatever the case', () => {
    expect(addCompanies(['Acme'], ['ACME', 'acme', 'Beta', 'beta'])).toEqual(['Acme', 'Beta']);
  });

  it('returns the same list when nothing is new', () => {
    const list = ['Acme'];
    expect(addCompanies(list, ['acme', '', '  '])).toBe(list);
  });
});

describe('companyPattern', () => {
  it('is null for an empty list', () => {
    expect(companyPattern([])).toBeNull();
    expect(companyPattern(['  '])).toBeNull();
  });

  it('finds names in any case', () => {
    expect(found(['Anduril'], 'Jobs at ANDURIL and anduril Industries')).toEqual(['ANDURIL', 'anduril']);
  });

  it('only matches whole words', () => {
    expect(found(['Meta'], 'Meta builds metadata tools. Join Meta!')).toEqual(['Meta', 'Meta']);
    expect(found(['Block'], 'Blockchain at Block, Inc.')).toEqual(['Block']);
  });

  it('prefers the longer name', () => {
    expect(found(['Acme', 'Acme Robotics'], 'Acme Robotics and Acme')).toEqual(['Acme Robotics', 'Acme']);
  });

  it('accepts any amount of space inside a name', () => {
    expect(found(['Booz Allen Hamilton'], 'Booz  Allen\nHamilton')).toEqual(['Booz  Allen\nHamilton']);
  });

  it('treats symbols in names as plain text', () => {
    expect(found(['AT&T', 'C3.ai', 'Yahoo!'], 'AT&T, C3.ai and C3xai, Yahoo! too')).toEqual(['AT&T', 'C3.ai', 'Yahoo!']);
  });

  it('works for names that are not in English', () => {
    expect(found(['字节跳动', 'Société Générale'], '加入字节跳动 / société générale')).toEqual(['字节跳动', 'société générale']);
  });
});
