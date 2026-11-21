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

// The page's own document plus the documents of the frames it is allowed to read (frames from
// the same site). iCIMS puts the whole job posting, and later the application form, in a frame.
export function readableDocuments(doc: Document): Document[] {
    const frames = [...doc.querySelectorAll('iframe')].map((frame) => {
        try {
            return frame.contentDocument;
        } catch {
            return null; // A frame from another site cannot be read.
        }
    });
    return [doc, ...frames.filter((frame) => frame !== null)];
}

// Reads the job title and company name that the page describes itself with.
// Order: JSON-LD JobPosting, then Open Graph meta tags.
// document.title is deliberately not used: the only site that needed it was iCIMS, where it
// reads "iCIMS Careers Portal" at first and a title mixed with location text later.
// Only valid for the URL the document was loaded with: single-page apps (Workday) leave
// these tags unchanged when the user moves to another job without a page load.
export function readJobInfo(doc: Document): JobInfo {
    // JSON-LD is also looked for inside frames. The meta tags are not: a frame's own og:title
    // on iCIMS is the title mixed with location text.
    const scripts = readableDocuments(doc).flatMap((each) =>
        [...each.querySelectorAll('script[type="application/ld+json"]')].map(
            (script) => script.textContent ?? '',
        ),
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

// The visible text of the page, including the frames it is allowed to read.
export function pageText(doc: Document): string {
    return readableDocuments(doc)
        .map((each) => each.body?.innerText ?? '')
        .join('\n');
}

// Whether a button's text says that clicking it submits a job application.
// Greenhouse, Lever, Ashby and Workable all use "Submit application"; Workday uses "Submit".
export function isSubmitLabel(label: string): boolean {
    const words = label.trim().replace(/\s+/g, ' ');
    if (words.length === 0 || words.length > 40) return false;
    return /\bsubmit\b|\b(send|complete)\s+(my\s+|your\s+)?application\b/i.test(words);
}

// Whether a github.com path is a page that shows a rendered document: a repository's front page
// or one of its folders (both show the README), or a Markdown file. Issues, pull requests,
// discussions, releases and wikis also render Markdown, and are deliberately left out.
export function isGithubDocumentPath(pathname: string): boolean {
    const [owner, repo, view, ...rest] = pathname.split('/').filter(Boolean);
    if (!owner || !repo) return false;
    if (view === undefined || view === 'tree') return true;
    return view === 'blob' && /\.(md|markdown|mdx)$/i.test(rest.at(-1) ?? '');
}
