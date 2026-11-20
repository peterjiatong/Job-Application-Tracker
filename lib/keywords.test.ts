import { describe, expect, it } from 'vitest';
import { DEFAULT_RULES, scan } from './keywords';

const categories = (text: string) => [...new Set(scan(text, DEFAULT_RULES).map((hit) => hit.category))];

describe('scan with the default rules', () => {
  it.each([
    // Citizenship
    ['Must be a U.S. citizen.', 'Citizenship'],
    ['US Citizenship is required for this position.', 'Citizenship'],
    ['Applicants must be United States citizens or permanent residents.', 'Citizenship'],
    ['This role is open to citizens only.', 'Citizenship'],
    ['Due to ITAR regulations, candidates must be a U.S. person.', 'Citizenship'],
    ['This position is subject to export control laws.', 'Citizenship'],
    ['Must hold a green card or be a citizen.', 'Citizenship'],
    // Clearance
    ['Active security clearance required.', 'Clearance'],
    ['Must hold an active TS/SCI.', 'Clearance'],
    ['Ability to obtain a Top Secret clearance.', 'Clearance'],
    ['A Secret clearance is a plus.', 'Clearance'],
    ['Must be able to obtain a Public Trust.', 'Clearance'],
    ['Requires a CI polygraph.', 'Clearance'],
    // Sponsorship
    ['We are unable to sponsor visas', 'Sponsorship'],
    ['This position is not eligible for visa sponsorship.', 'Sponsorship'],
    ['We do not offer sponsorship at this time.', 'Sponsorship'],
    ['No visa sponsorship is available for this role.', 'Sponsorship'],
    ['Sponsorship is not available for this position.', 'Sponsorship'],
    ['Must be authorized to work in the U.S. without sponsorship.', 'Sponsorship'],
    ['Candidates must be authorized to work in the United States without restriction.', 'Sponsorship'],
    ['We can’t provide immigration sponsorship.', 'Sponsorship'],
    ['The company cannot provide U.S. visa sponsorship.', 'Sponsorship'],
  ])('flags "%s" as %s', (text, category) => {
    expect(categories(text)).toContain(category);
  });

  it.each([
    // Sponsorship offered or merely asked about
    'We sponsor visas for qualified candidates',
    'Visa sponsorship is available for this role.',
    'Will you now or in the future require visa sponsorship?',
    'No agencies please. We sponsor H-1B visas.',
    // Equal-opportunity boilerplate
    'We consider applicants without regard to race, national origin, or citizenship status.',
    // Words that only look like the rules
    'You will protect our trade secrets.',
    'Experience with customs clearance is a plus.',
    'She plays guitar in the office band.',
    'Join us and help citizens access public services.',
    'Great engineers trust us.',
  ])('does not flag "%s"', (text) => {
    expect(scan(text, DEFAULT_RULES)).toEqual([]);
  });
});

describe('scan', () => {
  const rule = [{ category: 'Test', pattern: 'needle' }];

  it('returns the line that contains the match', () => {
    const text = 'About the role\nYou must find the needle today.\nBenefits';
    expect(scan(text, rule)).toEqual([{ category: 'Test', snippet: 'You must find the needle today.' }]);
  });

  it('cuts a long line down around the match, at word breaks', () => {
    const text = `${'before '.repeat(30)}needle${' after'.repeat(30)}`;
    const [hit] = scan(text, rule);
    expect(hit?.snippet.startsWith('…before')).toBe(true);
    expect(hit?.snippet.endsWith('after…')).toBe(true);
    expect(hit?.snippet).toContain('needle');
    expect(hit?.snippet.length).toBeLessThan(170);
  });

  it('keeps at most two snippets per category', () => {
    const text = 'needle one\nneedle two\nneedle three';
    expect(scan(text, rule).map((hit) => hit.snippet)).toEqual(['needle one', 'needle two']);
  });

  it('reports a sentence once even when several rules of a category match it', () => {
    const hits = scan('Must be a U.S. citizen or permanent resident with a green card.', DEFAULT_RULES);
    expect(hits).toHaveLength(1);
  });

  it('reports each category separately', () => {
    const text = 'U.S. citizenship and an active security clearance are required.';
    expect(categories(text)).toEqual(['Citizenship', 'Clearance']);
  });

  it('is case-insensitive', () => {
    expect(scan('SECURITY CLEARANCE REQUIRED', DEFAULT_RULES)).toHaveLength(1);
  });

  it('skips a rule whose pattern is not a valid regular expression', () => {
    const rules = [{ category: 'Broken', pattern: '(' }, ...rule];
    expect(scan('a needle', rules)).toEqual([{ category: 'Test', snippet: 'a needle' }]);
  });

  it('returns nothing for empty text or no rules', () => {
    expect(scan('', DEFAULT_RULES)).toEqual([]);
    expect(scan('security clearance', [])).toEqual([]);
  });
});
