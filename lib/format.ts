import { dateLocale } from './i18n';

// "Nov 5, 2026", or "2026年11月5日" in Chinese.
export function formatDate(time: number | Date): string {
    return new Date(time).toLocaleDateString(dateLocale(), {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
    });
}

// "Nov 5, 2026, 3:07 PM", in the browser's time zone.
export function formatDateTime(time: number | Date): string {
    return new Date(time).toLocaleString(dateLocale(), {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
    });
}
