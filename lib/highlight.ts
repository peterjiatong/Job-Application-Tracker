// Name under which the ranges are registered. The colour is set in highlight.css.
const NAME = 'jat-avoid';

const SKIPPED_TAGS = new Set(['SCRIPT', 'STYLE', 'NOSCRIPT', 'TEXTAREA']);

// Marks every match of `pattern` in the page's text, replacing the marks from the last call.
// With null it only clears them. Returns the number of matches.
//
// Uses the CSS Custom Highlight API: the browser paints the ranges, and the page's own elements
// are not touched. Wrapping matches in <mark> elements instead would break pages built with
// React, which expect their elements to stay as they made them.
export function highlightText(doc: Document, pattern: RegExp | null): number {
    if (typeof Highlight === 'undefined' || !CSS.highlights) return 0; // older browser
    CSS.highlights.delete(NAME);
    if (!pattern || !doc.body) return 0;

    const ranges: Range[] = [];
    const walker = doc.createTreeWalker(doc.body, NodeFilter.SHOW_TEXT);
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
        const text = node.nodeValue ?? '';
        if (text.length < 2 || SKIPPED_TAGS.has(node.parentElement?.tagName ?? '')) continue;
        for (const match of text.matchAll(pattern)) {
            const range = doc.createRange();
            range.setStart(node, match.index);
            range.setEnd(node, match.index + match[0].length);
            ranges.push(range);
        }
    }
    if (ranges.length > 0) CSS.highlights.set(NAME, new Highlight(...ranges));
    return ranges.length;
}
