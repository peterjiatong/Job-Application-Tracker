// The toolbar popup. For now it only opens the dashboard; the current page's status and the
// record buttons join it in M3.
export default function App() {
  const openDashboard = () => {
    void browser.tabs.create({ url: browser.runtime.getURL('/dashboard.html') });
    window.close();
  };

  return (
    <button type="button" onClick={openDashboard}>
      Open dashboard
    </button>
  );
}
