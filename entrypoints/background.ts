export default defineBackground(() => {
  // The toast runs inside a web page and cannot open tabs. It sends this message instead.
  browser.runtime.onMessage.addListener((message) => {
    if (message?.type === 'open-dashboard') {
      void browser.tabs.create({ url: browser.runtime.getURL('/dashboard.html') });
    }
  });
});
