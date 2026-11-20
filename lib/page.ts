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
// Order: JSON-LD JobPosting, then Open Graph meta tags.
// document.title is deliberately not used: the only site that needed it was iCIMS, where it
// reads "iCIMS Careers Portal" at first and a title mixed with location text later.
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
        title: jsonLd.title ?? meta('og:title'),
        company: jsonLd.company ?? meta('og:site_name'),
    };
}

// The job title shown on a Workday job page. For pages reached without a page load, where
// readJobInfo cannot be trusted. The requisition id shown on the page must match `jobId`, so a
// title that is still on screen from the previously opened job is never taken.
export function readWorkdayTitle(doc: Document, jobId: string): string | undefined {
    const shownId = doc.querySelector('[data-automation-id="requisitionId"]')?.textContent ?? '';
    if (!shownId.includes(jobId)) return undefined;
    return text(doc.querySelector('[data-automation-id="jobPostingHeader"]')?.textContent);
}

// Resolves once the page has not changed for `quietMs`, or after `timeoutMs` at the latest.
// Used to let late-loading content (the job description on Workday) arrive before reading it.
export function pageQuiet(doc: Document, quietMs: number, timeoutMs: number): Promise<void> {
    return new Promise((resolve) => {
        const done = () => {
            observer.disconnect();
            clearTimeout(quietTimer);
            clearTimeout(limitTimer);
            resolve();
        };
        const observer = new MutationObserver(() => {
            clearTimeout(quietTimer);
            quietTimer = setTimeout(done, quietMs);
        });
        let quietTimer = setTimeout(done, quietMs);
        const limitTimer = setTimeout(done, timeoutMs);
        observer.observe(doc.documentElement, {
            childList: true,
            subtree: true,
            characterData: true,
        });
    });
}

// The visible text of the page, including frames it is allowed to read. iCIMS shows the job
// description in a frame of its own.
export function pageText(doc: Document): string {
    const frames = [...doc.querySelectorAll('iframe')].map((frame) => {
        try {
            return frame.contentDocument?.body?.innerText ?? '';
        } catch {
            return ''; // A frame from another site cannot be read.
        }
    });
    return [doc.body.innerText, ...frames].join('\n');
}

// Whether a button's text says that clicking it submits a job application.
// Greenhouse, Lever, Ashby and Workable all use "Submit application"; Workday uses "Submit".
export function isSubmitLabel(label: string): boolean {
    const words = label.trim().replace(/\s+/g, ' ');
    if (words.length === 0 || words.length > 40) return false;
    return /\bsubmit\b|\b(send|complete)\s+(my\s+|your\s+)?application\b/i.test(words);
}
