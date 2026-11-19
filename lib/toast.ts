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
}
.close {
    border: 0;
    padding: 0 2px;
    background: none;
    color: #57606a;
    font-size: 18px;
    line-height: 1;
    cursor: pointer;
}
.close:hover {
    color: #1f2328;
}
`;

export type ToastOptions = {
    title: string;
    body: string;
};

function el(tag: string, className: string, text = ''): HTMLElement {
    const node = document.createElement(tag);
    node.className = className;
    // textContent, never innerHTML: the text will later come from the page (job titles).
    node.textContent = text;
    return node;
}

let dismissCurrent: (() => void) | undefined;

export function showToast({ title, body }: ToastOptions): void {
    // At most one toast per page.
    dismissCurrent?.();

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
    };
    dismissCurrent = dismiss;
    close.addEventListener('click', dismiss);

    const header = el('div', 'header');
    header.append(el('div', 'title', title), close);

    const toast = el('div', 'toast');
    toast.setAttribute('role', 'status');
    toast.append(header, el('div', 'body', body));

    host.attachShadow({ mode: 'open' }).append(el('style', '', CSS), toast);
    document.documentElement.append(host);
}
