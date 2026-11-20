import { defineConfig } from 'wxt';

// See https://wxt.dev/api/reference/wxt/interfaces/inlineconfig.html
export default defineConfig({
  modules: ['@wxt-dev/module-react'],
  manifest: {
    name: 'Job Application Tracker',
    // activeTab: lets the toolbar popup read the address of the tab it was opened on.
    // contextMenus: the right-click entry that adds a selected company name to the list.
    permissions: ['storage', 'activeTab', 'contextMenus'],
  },
});