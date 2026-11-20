// Every piece of text the extension shows, in English and in Chinese.
// `{name}` marks a value that is filled in when the text is used.
const en = {
    // Toast on job pages
    'toast.dashboard': 'Dashboard',
    'toast.ask.title': 'Record this job?',
    'toast.ask.body': 'It is not in your tracker yet.',
    'toast.recorded.title': 'Job recorded',
    'toast.recorded.body': 'Saved as viewed.',
    'toast.seen.title': "You've seen this job",
    'toast.seen.body': 'First viewed on {date}.',
    'toast.applied.title': 'You applied to this job',
    'toast.applied.body': 'Applied on {date}.',
    'toast.marked.title': 'Marked as applied',
    'toast.marked.body': 'Saved as applied.',
    'toast.close': 'Close',
    'toast.collapse': 'Collapse',
    'toast.expand': '{title}. Expand',
    'action.record': 'Record',
    'action.ignore': 'Ignore',
    'action.undo': 'Undo',
    'action.markApplied': 'Mark as applied',

    // Built-in warning categories. Categories the user adds are shown as typed.
    'category.Citizenship': 'Citizenship',
    'category.Clearance': 'Clearance',
    'category.Sponsorship': 'Sponsorship',

    // Toolbar popup
    'popup.cannot': 'This page cannot be recorded.',
    'popup.notRecorded': 'Not recorded',
    'popup.viewed': 'Viewed · first seen {date}',
    'popup.applied': 'Applied on {date}',
    'popup.record': 'Record this page',
    'popup.markNotApplied': 'Mark as not applied',
    'popup.auto': 'Record jobs automatically',
    'popup.dashboard': 'Open dashboard',

    // Dashboard
    'tab.jobs': 'Jobs',
    'tab.settings': 'Settings',
    'card.total': 'Jobs recorded',
    'card.applied': 'Applied',
    'card.week': 'Applied in the last 7 days',
    'card.rate': 'Applied out of recorded',
    'chart.title': 'Applications per day',
    'chart.label': 'Applications per day over the last year',
    'chart.day': '{date}: {applied} applied, {viewed} first viewed',
    'chart.less': 'Less',
    'chart.more': 'More',
    'sites.title': 'By site',
    'sites.empty': 'Nothing yet.',
    'sites.other': 'other',
    'flags.title': 'Jobs with warnings',
    'flags.empty': 'None.',

    'column.lastSeen': 'Last seen',
    'column.company': 'Company',
    'column.title': 'Title',
    'column.site': 'Site',
    'column.status': 'Status',
    'column.warnings': 'Warnings',
    'status.viewed': 'Viewed',
    'status.applied': 'Applied',
    'filter.search': 'Search company and title',
    'filter.anyStatus': 'Any status',
    'filter.anySite': 'Any site',
    'filter.anyWarning': 'Any warning',
    'filter.warning': 'Warning',
    'filter.clear': 'Clear',
    'filter.count': '{shown} of {total}',
    'jobs.empty':
        'No jobs recorded yet. Open a job posting on a supported site, or add its address above.',
    'jobs.noMatch': 'No jobs match these filters.',
    'row.firstSeen': 'First seen {date}',
    'row.appliedAt': 'Applied {date}',
    'row.addTitle': 'Add a title',
    'row.open': 'Open',
    'row.delete': 'Delete',
    'row.titleAtCompany': '{title} at {company}',
    'row.confirmDelete': 'Delete "{name}"? This cannot be undone.',

    'add.label': 'Job address',
    'add.placeholder': 'Paste the address of a job posting',
    'add.applied': 'Already applied',
    'add.button': 'Add',
    'add.invalid': 'That is not a web address. It should start with https://',
    'add.exists': 'This job is already recorded.',
    'add.done': 'Added.',

    'transfer.exportJson': 'Export JSON',
    'transfer.exportCsv': 'Export CSV',
    'transfer.importJson': 'Import JSON',
    'import.notJson': 'This file is not valid JSON.',
    'import.notExport': 'This file does not look like a Job Application Tracker export.',
    'import.new.one': 'Imported {n} new job',
    'import.new.many': 'Imported {n} new jobs',
    'import.merged': 'merged {n} with jobs already here',
    'import.skipped.one': 'skipped {n} entry that was not valid',
    'import.skipped.many': 'skipped {n} entries that were not valid',
    'import.settings': 'restored the settings',
    'list.separator': ', ',
    'list.end': '.',

    // Settings
    'settings.language': 'Language',
    'language.auto': 'Same as the browser',
    'settings.recording': 'Recording',
    'settings.auto': 'Automatic',
    'settings.auto.hint': 'Record a job as soon as you open its page.',
    'settings.manual': 'Manual',
    'settings.manual.hint': 'Ask before recording a job.',
    'settings.warnings': 'Warnings',
    'settings.scan': 'Scan job descriptions',
    'settings.scan.hint':
        'Warn about citizenship, clearance and visa sponsorship requirements, quoting the sentence that was found.',
    'settings.rules': 'Rules',
    'settings.rules.hint':
        'A rule is a regular expression, matched without regard to upper and lower case. Rules with the same category are shown together.',
    'settings.saved': 'All changes are saved.',
    'settings.notSaved': 'Not saved yet. Fix the rules marked above.',
    'rule.category': 'Category',
    'rule.pattern': 'Pattern',
    'rule.delete': 'Delete rule {n}',
    'rule.add': 'Add rule',
    'rule.restore': 'Restore default rules',
    'rule.error.category': 'Give the rule a category.',
    'rule.error.pattern': 'Give the rule a pattern.',
    'rule.error.invalid': 'Not a valid pattern: {message}',
} as const;

export type MessageKey = keyof typeof en;

const zh: Record<MessageKey, string> = {
    'toast.dashboard': '打开面板',
    'toast.ask.title': '要记录这个岗位吗？',
    'toast.ask.body': '它还不在你的记录里。',
    'toast.recorded.title': '已记录',
    'toast.recorded.body': '已标记为看过。',
    'toast.seen.title': '你看过这个岗位',
    'toast.seen.body': '首次查看于 {date}。',
    'toast.applied.title': '你申请过这个岗位',
    'toast.applied.body': '申请于 {date}。',
    'toast.marked.title': '已标记为已申请',
    'toast.marked.body': '已保存为已申请。',
    'toast.close': '关闭',
    'toast.collapse': '收起',
    'toast.expand': '{title}。展开',
    'action.record': '记录',
    'action.ignore': '忽略',
    'action.undo': '撤销',
    'action.markApplied': '标记为已申请',

    'category.Citizenship': '公民身份',
    'category.Clearance': '安全许可',
    'category.Sponsorship': '签证担保',

    'popup.cannot': '这个页面无法记录。',
    'popup.notRecorded': '未记录',
    'popup.viewed': '看过 · 首次查看于 {date}',
    'popup.applied': '申请于 {date}',
    'popup.record': '记录当前页面',
    'popup.markNotApplied': '取消已申请',
    'popup.auto': '自动记录岗位',
    'popup.dashboard': '打开面板',

    'tab.jobs': '岗位',
    'tab.settings': '设置',
    'card.total': '已记录岗位',
    'card.applied': '已申请',
    'card.week': '近 7 天申请',
    'card.rate': '申请占比',
    'chart.title': '每日申请',
    'chart.label': '最近一年的每日申请数',
    'chart.day': '{date}：申请 {applied} 个，新查看 {viewed} 个',
    'chart.less': '少',
    'chart.more': '多',
    'sites.title': '按招聘系统',
    'sites.empty': '暂无。',
    'sites.other': '其他',
    'flags.title': '有预警的岗位',
    'flags.empty': '无。',

    'column.lastSeen': '最近查看',
    'column.company': '公司',
    'column.title': '岗位',
    'column.site': '招聘系统',
    'column.status': '状态',
    'column.warnings': '预警',
    'status.viewed': '看过',
    'status.applied': '已申请',
    'filter.search': '搜索公司和岗位',
    'filter.anyStatus': '全部状态',
    'filter.anySite': '全部招聘系统',
    'filter.anyWarning': '全部预警',
    'filter.warning': '预警',
    'filter.clear': '清除',
    'filter.count': '{shown} / {total}',
    'jobs.empty': '还没有记录。打开一个受支持网站上的岗位页面，或者在上面添加岗位地址。',
    'jobs.noMatch': '没有符合筛选条件的岗位。',
    'row.firstSeen': '首次查看于 {date}',
    'row.appliedAt': '申请于 {date}',
    'row.addTitle': '添加岗位名称',
    'row.open': '打开',
    'row.delete': '删除',
    'row.titleAtCompany': '{company} 的 {title}',
    'row.confirmDelete': '删除“{name}”？此操作无法撤销。',

    'add.label': '岗位地址',
    'add.placeholder': '粘贴岗位页面的网址',
    'add.applied': '已经申请过',
    'add.button': '添加',
    'add.invalid': '这不是一个网址。网址应以 https:// 开头',
    'add.exists': '这个岗位已经记录过了。',
    'add.done': '已添加。',

    'transfer.exportJson': '导出 JSON',
    'transfer.exportCsv': '导出 CSV',
    'transfer.importJson': '导入 JSON',
    'import.notJson': '这个文件不是有效的 JSON。',
    'import.notExport': '这个文件不像是 Job Application Tracker 导出的。',
    'import.new.one': '导入了 {n} 个新岗位',
    'import.new.many': '导入了 {n} 个新岗位',
    'import.merged': '与已有记录合并了 {n} 个',
    'import.skipped.one': '跳过了 {n} 条无效内容',
    'import.skipped.many': '跳过了 {n} 条无效内容',
    'import.settings': '恢复了设置',
    'list.separator': '，',
    'list.end': '。',

    'settings.language': '语言',
    'language.auto': '跟随浏览器',
    'settings.recording': '记录方式',
    'settings.auto': '自动',
    'settings.auto.hint': '打开岗位页面时立即记录。',
    'settings.manual': '手动',
    'settings.manual.hint': '记录之前先询问。',
    'settings.warnings': '预警',
    'settings.scan': '扫描职位描述',
    'settings.scan.hint': '发现公民身份、安全许可、签证担保方面的要求时提醒，并引用原句。',
    'settings.rules': '规则',
    'settings.rules.hint':
        '每条规则是一个正则表达式，匹配时不区分大小写。类别相同的规则会显示在一起。',
    'settings.saved': '所有更改已保存。',
    'settings.notSaved': '尚未保存。请先修正上面标出的规则。',
    'rule.category': '类别',
    'rule.pattern': '规则',
    'rule.delete': '删除第 {n} 条规则',
    'rule.add': '添加规则',
    'rule.restore': '恢复默认规则',
    'rule.error.category': '请填写类别。',
    'rule.error.pattern': '请填写规则。',
    'rule.error.invalid': '规则无效：{message}',
};

export const MESSAGES = { en, zh };

// 'auto' follows the browser's own language.
export type Language = 'auto' | 'en' | 'zh';

let current: 'en' | 'zh' = 'en';

export function setLanguage(language: Language): void {
    if (language === 'auto') {
        const browserLanguage = typeof navigator === 'undefined' ? 'en' : navigator.language;
        current = browserLanguage.toLowerCase().startsWith('zh') ? 'zh' : 'en';
    } else {
        current = language;
    }
}

// The text for `key` in the current language, with each `{name}` replaced from `values`.
export function t(key: MessageKey, values: Record<string, string | number> = {}): string {
    return MESSAGES[current][key].replace(/\{(\w+)\}/g, (_, name: string) => String(values[name] ?? ''));
}

// Like t, for text that differs between one and several in English: picks `<key>.one` or
// `<key>.many` by `n`.
export function tCount(key: 'import.new' | 'import.skipped', n: number): string {
    return t(`${key}.${n === 1 ? 'one' : 'many'}`, { n });
}

// The name to show for a warning category.
export function categoryLabel(category: string): string {
    const key = `category.${category}`;
    return key in en ? t(key as MessageKey) : category;
}

// The locale to format dates with.
export function dateLocale(): string {
    return current === 'zh' ? 'zh-CN' : 'en-US';
}
