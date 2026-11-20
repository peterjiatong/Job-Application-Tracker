import { t } from './i18n';
import type { KeywordRule } from './types';

export type KeywordHit = {
    category: string;
    snippet: string;
};

// Patterns are regular expressions, matched case-insensitively against text in which "U.S." has
// already been rewritten to "US" (see normalize). They only target restrictive wording.
export const DEFAULT_RULES: KeywordRule[] = [
    { category: 'Citizenship', pattern: String.raw`\b(US|USA|United States)\s+citizen` },
    { category: 'Citizenship', pattern: String.raw`\bcitizens\s+only\b` },
    { category: 'Citizenship', pattern: String.raw`\b(US|United States)\s+persons?\b` },
    { category: 'Citizenship', pattern: String.raw`\bITAR\b` },
    { category: 'Citizenship', pattern: String.raw`\bexport\s+control` },
    { category: 'Citizenship', pattern: String.raw`\bpermanent\s+resident` },
    { category: 'Citizenship', pattern: String.raw`\bgreen\s+card` },

    { category: 'Clearance', pattern: String.raw`\bsecurity\s+clearance` },
    { category: 'Clearance', pattern: String.raw`\bTS\s*/\s*SCI\b` },
    { category: 'Clearance', pattern: String.raw`\btop\s+secret\b` },
    { category: 'Clearance', pattern: String.raw`\bsecret\s+clearance` },
    { category: 'Clearance', pattern: String.raw`\bpublic\s+trust\b` },
    { category: 'Clearance', pattern: String.raw`\bpolygraph` },

    // A negation shortly before "sponsor", within the same sentence: "unable to sponsor",
    // "not eligible for visa sponsorship", "without sponsorship".
    {
        category: 'Sponsorship',
        pattern: String.raw`\b(not|unable\s+to|cannot|can't|won't|doesn't|don't|no|without)\b[^.\n]{0,40}\bsponsor`,
    },
    // Or shortly after it: "sponsorship is not available".
    {
        category: 'Sponsorship',
        pattern: String.raw`\bsponsor\w*\b[^.\n]{0,40}\b(not|unavailable|isn't|won't|cannot|can't)\b`,
    },
    {
        category: 'Sponsorship',
        pattern: String.raw`\bauthorized\s+to\s+work\b[^.\n]{0,60}\bwithout\b`,
    },
];

const MAX_HITS_PER_CATEGORY = 2;
const SNIPPET_CONTEXT = 70; // characters kept on each side of a match

function normalize(text: string): string {
    return (
        text
            .replace(/ /g, ' ')
            .replace(/[‘’]/g, "'")
            // "U.S." -> "US", so that a "." in the text only ever ends a sentence.
            .replace(/\bU\.S\.(A\.)?/gi, (match) => match.replaceAll('.', ''))
            .replace(/[ \t]+/g, ' ')
    );
}

// The line around a match, cut down to SNIPPET_CONTEXT characters on each side at word breaks.
// `from` and `to` are positions in `text`; the snippet gets "…" where the line was cut.
function snippetAt(text: string, start: number, end: number) {
    const lineStart = text.lastIndexOf('\n', start - 1) + 1;
    const nextBreak = text.indexOf('\n', end);
    const lineEnd = nextBreak < 0 ? text.length : nextBreak;

    let from = Math.max(lineStart, start - SNIPPET_CONTEXT);
    let to = Math.min(lineEnd, end + SNIPPET_CONTEXT);
    if (from > lineStart) {
        const space = text.indexOf(' ', from);
        if (space >= 0 && space < start) from = space + 1;
    }
    if (to < lineEnd) {
        const space = text.lastIndexOf(' ', to);
        if (space > end) to = space;
    }

    const snippet =
        (from > lineStart ? '…' : '') + text.slice(from, to).trim() + (to < lineEnd ? '…' : '');
    return { from, to, snippet };
}

// Scans page text for restrictive wording. Returns, per rule category, up to
// MAX_HITS_PER_CATEGORY snippets of the surrounding text, so the user can judge each one.
export function scan(input: string, rules: KeywordRule[]): KeywordHit[] {
    const text = normalize(input);
    const hits: KeywordHit[] = [];
    const taken = new Map<string, [number, number][]>(); // snippet ranges per category

    for (const rule of rules) {
        let regex: RegExp;
        try {
            regex = new RegExp(rule.pattern, 'gi');
        } catch {
            continue; // A rule typed by the user may not be a valid pattern. Skip it.
        }

        const ranges = taken.get(rule.category) ?? [];
        taken.set(rule.category, ranges);

        for (const match of text.matchAll(regex)) {
            if (ranges.length >= MAX_HITS_PER_CATEGORY) break;
            // Already shown as part of an earlier snippet of this category.
            if (ranges.some(([from, to]) => match.index >= from && match.index < to)) continue;
            if (match[0].length === 0) continue;

            const { from, to, snippet } = snippetAt(text, match.index, match.index + match[0].length);
            ranges.push([from, to]);
            hits.push({ category: rule.category, snippet });
        }
    }
    return hits;
}

// Why a rule cannot be used, in words for the settings page, or null if it is fine.
export function ruleError(rule: KeywordRule): string | null {
    if (!rule.category.trim()) return t('rule.error.category');
    if (!rule.pattern) return t('rule.error.pattern');
    try {
        new RegExp(rule.pattern, 'gi');
        return null;
    } catch (error) {
        return t('rule.error.invalid', { message: (error as Error).message });
    }
}
