// "Nov 5, 2026"
export function formatDate(time: number | Date): string {
    return new Date(time).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
    });
}

// "Nov 5, 2026, 3:07 PM", in the browser's time zone.
export function formatDateTime(time: number | Date): string {
    return new Date(time).toLocaleString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
    });
}
