const TRACKING_PARAMS = new Set(['gh_src', 'source', 'ref', 'lever-source', 'lever-origin']);

export function normalizeUrl(input: string): string | null {
    let url: URL;
    try {
        url = new URL(input);
    } catch {
        return null;
    }

    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
        return null;
    }

    for (const name of [...url.searchParams.keys()]) {
        if (name.startsWith('utm_') || TRACKING_PARAMS.has(name)) {
            url.searchParams.delete(name);
        }
    }

    url.searchParams.sort();
    url.hash = '';
    return url.toString();
}

export type ParsedJob = {
    ats: string;
    company: string;
    jobId: string;
};

type Parser = (url: URL) => ParsedJob | null;

const parseGreenhouse: Parser = (url) => {
    if (!/^(boards|job-boards)(\.eu)?\.greenhouse\.io$/.test(url.hostname)) {
        return null;
    }

    // Embedded form: /embed/job_app?for=stripe&token=123
    if (url.pathname === '/embed/job_app') {
        const company = url.searchParams.get('for');
        const jobId = url.searchParams.get('token');
        return company && jobId ? { ats: 'greenhouse', company, jobId } : null;
    }

    // Standard form: /stripe/jobs/123
    const [company, section, jobId] = url.pathname.split('/').filter(Boolean);
    if (company && section === 'jobs' && jobId && /^\d+$/.test(jobId)) {
        return { ats: 'greenhouse', company, jobId };
    }
    return null;
};

const PARSERS: Parser[] = [parseGreenhouse];

export function parseJobUrl(input: string): ParsedJob | null {
    let url: URL;
    try {
        url = new URL(input);
    } catch {
        return null;
    }

    for (const parse of PARSERS) {
        const job = parse(url);
        if (job) {
            return { ...job, company: job.company.toLowerCase() };
        }
    }
    return null;
}