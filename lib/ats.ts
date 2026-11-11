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


const UUID = /^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;

const parseLever: Parser = (url) => {
    if (!/^jobs(\.eu)?\.lever\.co$/.test(url.hostname)) {
        return null;
    }

    // /acme/1a2b3c4d-5e6f-7a8b-9c0d-1e2f3a4b5c6d, optionally followed by /apply
    const [company, jobId] = url.pathname.split('/').filter(Boolean);
    if (company && jobId && UUID.test(jobId)) {
        return { ats: 'lever', company, jobId: jobId.toLowerCase() };
    }
    return null;
};

const PARSERS: Parser[] = [parseGreenhouse, parseLever];

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
