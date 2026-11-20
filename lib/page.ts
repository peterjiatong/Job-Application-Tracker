export type JobInfo = {
    title?: string;
    company?: string;
};

type Json = Record<string, unknown>;

function text(value: unknown): string | undefined {
    return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

// JSON-LD can be one object, a list of objects, or an object holding a list under "@graph".
function findJobPosting(node: unknown): Json | null {
    if (Array.isArray(node)) {
        for (const item of node) {
            const found = findJobPosting(item);
            if (found) return found;
        }
        return null;
    }
    if (typeof node !== 'object' || node === null) return null;

    const obj = node as Json;
    const types = ([] as unknown[]).concat(obj['@type']);
    if (types.includes('JobPosting')) return obj;
    return findJobPosting(obj['@graph']);
}

// Takes the text of every <script type="application/ld+json"> tag on a page and returns the
// title and company of the first schema.org JobPosting found in them.
export function parseJobPostingJsonLd(scripts: string[]): JobInfo {
    for (const script of scripts) {
        let data: unknown;
        try {
            data = JSON.parse(script);
        } catch {
            continue; // Sites do ship invalid JSON-LD. Try the next tag.
        }

        const posting = findJobPosting(data);
        if (posting) {
            const org = posting.hiringOrganization;
            return {
                title: text(posting.title),
                company: text(org) ?? text((org as Json | null | undefined)?.name),
            };
        }
    }
    return {};
}

// Reads the job title and company name that the page describes itself with.
// Order: JSON-LD JobPosting, then Open Graph meta tags, then the page title.
// Only valid for the URL the document was loaded with: single-page apps (Workday) leave
// these tags unchanged when the user moves to another job without a page load.
export function readJobInfo(doc: Document): JobInfo {
    const scripts = [...doc.querySelectorAll('script[type="application/ld+json"]')].map(
        (script) => script.textContent ?? '',
    );
    const jsonLd = parseJobPostingJsonLd(scripts);
    const meta = (property: string) =>
        text(doc.querySelector<HTMLMetaElement>(`meta[property="${property}"]`)?.content);

    return {
        title: jsonLd.title ?? meta('og:title') ?? text(doc.title),
        company: jsonLd.company ?? meta('og:site_name'),
    };
}
