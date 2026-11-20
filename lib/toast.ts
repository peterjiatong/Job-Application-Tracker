const CSS = `
.toast {
    box-sizing: border-box;
    width: 320px;
    max-width: calc(100vw - 32px);
    padding: 12px 14px;
    background: #fff;
    color: #1f2328;
    border: 1px solid #d0d7de;
    border-radius: 8px;
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.16);
    font: 14px/1.4 system-ui, sans-serif;
}
.header {
    display: flex;
    align-items: flex-start;
    gap: 8px;
}
.title {
    flex: 1;
    font-weight: 600;
}
.body {
    margin-top: 4px;
    color: #57606a;
    white-space: pre-line;
}
.close,
.collapse {
    border: 0;
    padding: 0 2px;
    background: none;
    color: #57606a;
    font-size: 18px;
    line-height: 1;
    cursor: pointer;
}
.close:hover,
.collapse:hover {
    color: #1f2328;
}
[hidden] {
    display: none !important;
}
.pill {
    padding: 6px 12px;
    border: 1px solid #d0d7de;
    border-radius: 999px;
    background: #fff;
    color: #1f2328;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.16);
    font: 600 13px/1.3 system-ui, sans-serif;
    cursor: pointer;
}
.pill.has-warnings {
    border-color: #eac54f;
    background: #fff8c5;
}
.actions {
    display: flex;
    gap: 8px;
    margin-top: 10px;
}
.action {
    padding: 4px 10px;
    border: 1px solid #d0d7de;
    border-radius: 6px;
    background: #f6f8fa;
    color: #1f2328;
    font: inherit;
    cursor: pointer;
}
.action:hover {
    background: #eaeef2;
}
.warnings {
    max-height: 40vh;
    margin-top: 10px;
    overflow-y: auto;
}
.warning {
    padding: 8px 10px;
    border: 1px solid #eac54f;
    border-radius: 6px;
    background: #fff8c5;
    color: #1f2328;
}
.warning + .warning {
    margin-top: 6px;
}
.warning-category {
    font-weight: 600;
}
.warning-snippet {
    margin-top: 2px;
    font-size: 13px;
}
.action:focus-visible,
.close:focus-visible,
.collapse:focus-visible,
.pill:focus-visible {
    outline: 2px solid #0969da;
    outline-offset: 2px;
}
`;

export type ToastAction = {
    label: string;
    onClick: () => void;
};

export type ToastOptions = {
    title: string;
    body: string;
    actions?: ToastAction[];
};

export type ToastWarning = {
    category: string;
    snippet: string;
};

function el(tag: string, className: string, text = ''): HTMLElement {
    const node = document.createElement(tag);
    node.className = className;
    // textContent, never innerHTML: the text will later come from the page (job titles).
    node.textContent = text;
    return node;
}

let dismissCurrent: (() => void) | undefined;
// What the toast last showed, kept so it can be drawn again when the warnings change.
let lastOptions: ToastOptions | undefined;
let warnings: ToastWarning[] = [];
// Whether the user shrank the toast to a small pill. Kept while the toast is redrawn.
let collapsed = false;

export function dismissToast(): void {
    dismissCurrent?.();
    lastOptions = undefined;
    collapsed = false;
}

// Sets the warnings shown inside the toast: in the one on screen now and in every later one,
// until they are set again. Warnings usually arrive after the toast, because the page text is
// scanned late. If the user already closed the toast with × and there is something to warn
// about, the toast comes back.
export function setToastWarnings(list: ToastWarning[]): void {
    warnings = list;
    if (lastOptions && (isToastOpen() || list.length > 0)) showToast(lastOptions);
}

export function isToastOpen(): boolean {
    return dismissCurrent !== undefined;
}

export function showToast(options: ToastOptions): void {
    const { title, body, actions = [] } = options;
    // At most one toast per page.
    dismissCurrent?.();
    lastOptions = options;

    const host = document.createElement('div');
    host.id = 'jat-toast';
    // Inline style, so the page's own CSS rules for <div> cannot move or hide the host.
    host.style.cssText =
        'all: initial; position: fixed; top: 16px; right: 16px; z-index: 2147483647;';

    const close = el('button', 'close', '×');
    close.setAttribute('aria-label', 'Close');

    // Some pages (Greenhouse: Remix/React) replace the whole <html> element while starting up,
    // which throws the toast away with it. Put it back when that happens.
    const keeper = new MutationObserver(() => {
        if (!host.isConnected) document.documentElement.append(host);
    });
    keeper.observe(document, { childList: true });

    const dismiss = () => {
        keeper.disconnect();
        host.remove();
        if (dismissCurrent === dismiss) dismissCurrent = undefined;
    };
    dismissCurrent = dismiss;
    close.addEventListener('click', dismiss);

    const collapse = el('button', 'collapse', '–');
    collapse.setAttribute('aria-label', 'Collapse');

    const header = el('div', 'header');
    header.append(el('div', 'title', title), collapse, close);

    const toast = el('div', 'toast');
    toast.setAttribute('role', 'status');
    toast.append(header, el('div', 'body', body));

    if (warnings.length > 0) {
        // One box per category, holding every snippet found for it.
        const boxes = new Map<string, HTMLElement>();
        for (const { category, snippet } of warnings) {
            let box = boxes.get(category);
            if (!box) {
                box = el('div', 'warning');
                box.append(el('div', 'warning-category', `⚠ ${category}`));
                boxes.set(category, box);
            }
            box.append(el('div', 'warning-snippet', `“${snippet}”`));
        }
        const list = el('div', 'warnings');
        list.append(...boxes.values());
        toast.append(list);
    }

    if (actions.length > 0) {
        const row = el('div', 'actions');
        for (const action of actions) {
            const button = el('button', 'action', action.label);
            // Every action also closes the toast.
            button.addEventListener('click', () => {
                dismiss();
                // The action decides what comes next; this toast must not come back.
                lastOptions = undefined;
                action.onClick();
            });
            row.append(button);
        }
        toast.append(row);
    }

    // The collapsed form: a small pill that keeps the status and the number of warning
    // categories in view without covering the page. Clicking it opens the toast again.
    const categories = new Set(warnings.map((warning) => warning.category)).size;
    const pill = el('button', 'pill', categories > 0 ? `${title} · ⚠ ${categories}` : title);
    pill.classList.toggle('has-warnings', categories > 0);
    pill.setAttribute('aria-label', `${title}. Expand`);

    const setCollapsed = (value: boolean) => {
        collapsed = value;
        toast.hidden = collapsed;
        pill.hidden = !collapsed;
    };
    collapse.addEventListener('click', () => {
        setCollapsed(true);
        pill.focus();
    });
    pill.addEventListener('click', () => {
        setCollapsed(false);
        collapse.focus();
    });
    setCollapsed(collapsed);

    host.attachShadow({ mode: 'open' }).append(el('style', '', CSS), toast, pill);
    document.documentElement.append(host);
}
