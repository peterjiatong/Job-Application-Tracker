import { setLanguage, t } from '@/lib/i18n';
import { addToCompanies, getSettings, onSettingsChanged } from '@/lib/store';

const AVOID_MENU = 'avoid-company';

export default defineBackground(() => {
  // The toast runs inside a web page and cannot open tabs. It sends this message instead.
  browser.runtime.onMessage.addListener((message) => {
    if (message?.type === 'open-dashboard') {
      void browser.tabs.create({ url: browser.runtime.getURL('/dashboard.html') });
    }
  });

  // Right-click on selected text: add it to the companies the user is not interested in.
  // "%s" is replaced by the browser with the selected text.
  const createMenu = async () => {
    setLanguage((await getSettings()).language);
    await browser.contextMenus.removeAll();
    browser.contextMenus.create({ id: AVOID_MENU, title: t('menu.avoid'), contexts: ['selection'] });
  };
  browser.runtime.onInstalled.addListener(() => void createMenu());
  browser.runtime.onStartup.addListener(() => void createMenu());
  onSettingsChanged(() => void createMenu()); // the language may have changed

  browser.contextMenus.onClicked.addListener((info) => {
    if (info.menuItemId === AVOID_MENU && info.selectionText) {
      void addToCompanies([info.selectionText]);
    }
  });
});
