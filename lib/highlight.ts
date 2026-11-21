import { COMPANY_LISTS, DEFAULT_COLORS, isColor, textColorOn } from './companies';
import type { CompanyList, HighlightColors } from './companies';

// Name under which the ranges of one list are registered with the browser.
const highlightName = (list: CompanyList) => `jat-${list}`;

const SKIPPED_TAGS = new Set(['SCRIPT', 'STYLE', 'NOSCRIPT', 'TEXTAREA']);

// Marks every match of each list's pattern in the page's text, replacing the marks from the
// last call. A null pattern only clears that list's marks. Returns the number of matches.
// `roots` limits the search to parts of the page; by default it is the whole page.
//
// Uses the CSS Custom Highlight API: the browser paints the ranges, and the page's own elements
// are not touched. Wrapping matches in <mark> elements instead would break pages built with
// React, which expect their elements to stay as they made them.
export function highlightText(
    doc: Document,
    patterns: Record<CompanyList, RegExp | null>,
    roots: Element[] = doc.body ? [doc.body] : [],
): number {
    if (typeof Highlight === 'undefined' || !CSS.highlights) return 0; // older browser
    for (const list of COMPANY_LISTS) CSS.highlights.delete(highlightName(list));
    if (COMPANY_LISTS.every((list) => !patterns[list])) return 0;

    const ranges: Record<CompanyList, Range[]> = { avoid: [], interested: [] };
    for (const root of roots) {
        const walker = doc.createTreeWalker(root, NodeFilter.SHOW_TEXT);
        for (let node = walker.nextNode(); node; node = walker.nextNode()) {
            const text = node.nodeValue ?? '';
            if (text.length < 2 || SKIPPED_TAGS.has(node.parentElement?.tagName ?? '')) continue;
            for (const list of COMPANY_LISTS) {
                const pattern = patterns[list];
                if (!pattern) continue;
                for (const match of text.matchAll(pattern)) {
                    const range = doc.createRange();
                    range.setStart(node, match.index);
                    range.setEnd(node, match.index + match[0].length);
                    ranges[list].push(range);
                }
            }
        }
    }
    for (const list of COMPANY_LISTS) {
        if (ranges[list].length > 0) CSS.highlights.set(highlightName(list), new Highlight(...ranges[list]));
    }
    return ranges.avoid.length + ranges.interested.length;
}

let colorSheet: CSSStyleSheet | undefined;

// Sets the colours the marks are painted in. The text on top turns black or white, whichever
// reads better on the chosen colour.
//
// The rules go into a style sheet that is handed to the page without adding an element to it.
// If the browser refuses, the default colours from highlight.css stay in effect.
export function setHighlightColors(doc: Document, colors: HighlightColors): void {
    const css = COMPANY_LISTS.map((list) => {
        // Never put text that is not a plain colour into a style sheet.
        const color = isColor(colors[list]) ? colors[list] : DEFAULT_COLORS[list];
        return `::highlight(${highlightName(list)}) { background-color: ${color}; color: ${textColorOn(color)}; }`;
    }).join('\n');
    try {
        colorSheet ??= new CSSStyleSheet();
        colorSheet.replaceSync(css);
        if (!doc.adoptedStyleSheets.includes(colorSheet)) {
            doc.adoptedStyleSheets = [...doc.adoptedStyleSheets, colorSheet];
        }
    } catch {
        // Defaults from highlight.css apply.
    }
}
