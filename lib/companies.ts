// The two lists of companies the user keeps, and finding their names in page text.

// avoid: not interested (no sponsorship, clearance required, ...). interested: worth a look.
export type CompanyList = 'avoid' | 'interested';
export const COMPANY_LISTS: CompanyList[] = ['avoid', 'interested'];
export type CompanyLists = Record<CompanyList, string[]>;

// Highlight colours, as "#rrggbb". The user can change them.
export type HighlightColors = Record<CompanyList, string>;
export const DEFAULT_COLORS: HighlightColors = { avoid: '#ff6b6b', interested: '#5fd97a' };

export function isColor(value: unknown): value is string {
    return typeof value === 'string' && /^#[0-9a-f]{6}$/i.test(value);
}

// Black or white, whichever is easier to read on the given background colour.
export function textColorOn(background: string): '#000000' | '#ffffff' {
    const channel = (start: number) => parseInt(background.slice(start, start + 2), 16);
    // Perceived brightness, 0 to 255: the eye is most sensitive to green, least to blue.
    const brightness = 0.299 * channel(1) + 0.587 * channel(3) + 0.114 * channel(5);
    return brightness > 140 ? '#000000' : '#ffffff';
}

const MAX_NAME_LENGTH = 80;

// Tidies a name as typed, selected on a page, or read from a file. Returns '' if it cannot be a
// company name (empty, or so long that it is clearly a selected paragraph).
export function cleanCompanyName(name: string): string {
    const tidy = name.trim().replace(/\s+/g, ' ');
    return tidy.length > MAX_NAME_LENGTH ? '' : tidy;
}

// Adds names to the list. A name already on it, in any mix of upper and lower case, is not
// added again. Returns the new list, sorted, or the same list if nothing was new.
export function addCompanies(list: string[], names: string[]): string[] {
    const known = new Set(list.map((name) => name.toLowerCase()));
    const added: string[] = [];
    for (const name of names.map(cleanCompanyName)) {
        if (!name || known.has(name.toLowerCase())) continue;
        known.add(name.toLowerCase());
        added.push(name);
    }
    if (added.length === 0) return list;
    return [...list, ...added].sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
}

// Removes names from the list, in any mix of upper and lower case. Returns the same list if none
// of them was on it.
export function removeCompanies(list: string[], names: string[]): string[] {
    const gone = new Set(names.map((name) => cleanCompanyName(name).toLowerCase()));
    const kept = list.filter((name) => !gone.has(name.toLowerCase()));
    return kept.length === list.length ? list : kept;
}

// One regular expression that finds any of the names in a piece of text, or null for an empty
// list. Upper and lower case do not matter. A name only matches as whole words, so "Meta" is
// not found inside "Metadata".
export function companyPattern(names: string[]): RegExp | null {
    // "Not next to a letter or digit" rather than \b, which misfires on names that start or end
    // with a symbol (C++, .NET). Only applied on a side where the name itself has a Latin letter
    // or a digit: Chinese is written without spaces, so there a name is always next to letters.
    const wordLike = /[\p{Script=Latin}\p{N}]/u;
    const parts = names
        .map(cleanCompanyName)
        .filter(Boolean)
        // Longest first, so "Acme Robotics" wins over "Acme" where both would match.
        .sort((a, b) => b.length - a.length)
        .map((name) => {
            const before = wordLike.test(name[0] ?? '') ? '(?<![\\p{L}\\p{N}])' : '';
            const after = wordLike.test(name.at(-1) ?? '') ? '(?![\\p{L}\\p{N}])' : '';
            const text = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/ /g, '\\s+');
            return before + text + after;
        });
    if (parts.length === 0) return null;
    return new RegExp(parts.join('|'), 'giu');
}
