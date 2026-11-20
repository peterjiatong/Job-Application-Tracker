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

const parseAshby: Parser = (url) => {
    if (url.hostname !== 'jobs.ashbyhq.com') {
        return null;
    }

    // /ramp/34413f8d-26bf-4bbc-8ade-eb309a0e2245, optionally followed by /application
    const [company, jobId] = url.pathname.split('/').filter(Boolean);
    if (company && jobId && UUID.test(jobId)) {
        return { ats: 'ashby', company, jobId: jobId.toLowerCase() };
    }
    return null;
};

const parseSmartRecruiters: Parser = (url) => {
    if (url.hostname !== 'jobs.smartrecruiters.com') {
        return null;
    }

    // /ServiceNow/744000160989639-staff-site-reliability-engineer-federal
    const [company, posting] = url.pathname.split('/').filter(Boolean);
    const jobId = posting?.match(/^\d+/)?.[0];
    if (company && jobId) {
        return { ats: 'smartrecruiters', company, jobId };
    }
    return null;
};

const parseWorkable: Parser = (url) => {
    if (url.hostname !== 'apply.workable.com') {
        return null;
    }

    // /huggingface/j/DB4D7C0EC8, optionally followed by /apply
    const [company, section, jobId] = url.pathname.split('/').filter(Boolean);
    if (company && section === 'j' && jobId && /^[0-9a-z]+$/i.test(jobId)) {
        return { ats: 'workable', company, jobId: jobId.toUpperCase() };
    }
    return null;
};

const parseIcims: Parser = (url) => {
    if (!url.hostname.endsWith('.icims.com')) {
        return null;
    }

    // careers-peraton.icims.com/jobs/173535/customer-technical-specialist/job
    const company = url.hostname.split('.')[0]?.replace(/^[a-z]*careers-/, '');
    const [section, jobId] = url.pathname.split('/').filter(Boolean);
    if (company && section === 'jobs' && jobId && /^\d+$/.test(jobId)) {
        return { ats: 'icims', company, jobId };
    }
    return null;
};

const parseWorkday: Parser = (url) => {
    const segments = url.pathname.split('/').filter(Boolean);

    let company: string | undefined;
    if (url.hostname.endsWith('.myworkdayjobs.com')) {
        // nvidia.wd5.myworkdayjobs.com
        company = url.hostname.split('.')[0];
    } else if (url.hostname.endsWith('.myworkdaysite.com')) {
        // wd5.myworkdaysite.com/recruiting/<company>/<site>/job/...
        const at = segments.indexOf('recruiting');
        company = at >= 0 ? segments[at + 1] : undefined;
    } else {
        return null;
    }

    // [/en-US]/<site>/job/<location>/<title>_<reqId>, optionally followed by /apply/...
    const start = segments.findIndex((s) => s === 'job' || s === 'details');
    if (!company || start < 0) {
        return null;
    }
    const applyAt = segments.indexOf('apply', start);
    const slugAt = (applyAt < 0 ? segments.length : applyAt) - 1;
    const slug = slugAt > start ? segments[slugAt] : undefined;
    if (!slug || !slug.includes('_')) {
        return null;
    }

    // The same requisition posted more than once gets a "-1", "-2" suffix (JR366375-2).
    // Heuristic: strip a 1-2 digit suffix. A req id that really ends that way would collide.
    const jobId = slug.slice(slug.lastIndexOf('_') + 1).replace(/(\d)-\d{1,2}$/, '$1');
    return jobId ? { ats: 'workday', company, jobId } : null;
};

const PARSERS: Parser[] = [
    parseGreenhouse,
    parseLever,
    parseAshby,
    parseSmartRecruiters,
    parseWorkable,
    parseIcims,
    parseWorkday,
];

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

// The identity of a job, used as its storage key and to recognise it again.
export function jobKey(job: ParsedJob): string {
    return `${job.ats}:${job.company}:${job.jobId}`;
}
