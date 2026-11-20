import { COMPANY_LISTS } from '@/lib/companies';
import type { CompanyList } from '@/lib/companies';
import { setLanguage, t } from '@/lib/i18n';
import { addToCompanies, getSettings, onSettingsChanged } from '@/lib/store';

export default defineBackground(() => {
  // The toast runs inside a web page and cannot open tabs. It sends this message instead.
  browser.runtime.onMessage.addListener((message) => {
    if (message?.type === 'open-dashboard') {
      void browser.tabs.create({ url: browser.runtime.getURL('/dashboard.html') });
    }
  });

  // Right-click on selected text: put it on one of the two company lists. The menu entry's id
  // is the name of the list. "%s" is replaced by the browser with the selected text.
  const createMenu = async () => {
    setLanguage((await getSettings()).language);
    await browser.contextMenus.removeAll();
    for (const list of COMPANY_LISTS) {
      browser.contextMenus.create({ id: list, title: t(`menu.${list}`), contexts: ['selection'] });
    }
  };
  browser.runtime.onInstalled.addListener(() => void createMenu());
  browser.runtime.onStartup.addListener(() => void createMenu());
  onSettingsChanged(() => void createMenu()); // the language may have changed

  browser.contextMenus.onClicked.addListener((info) => {
    const list = COMPANY_LISTS.find((each) => each === info.menuItemId);
    if (list && info.selectionText) void addToCompanies(list as CompanyList, [info.selectionText]);
  });
});
