// The list of companies the user is not interested in, and finding their names in page text.

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
