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