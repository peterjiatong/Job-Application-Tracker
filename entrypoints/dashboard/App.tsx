import { SettingsPage } from './SettingsPage.tsx';

// The dashboard only has the settings so far. The activity chart, the numbers and the list of
// recorded jobs join it in M3, each as a tab.
export default function App() {
  return (
    <main>
      <h1>Job Application Tracker</h1>
      <SettingsPage />
    </main>
  );
}
