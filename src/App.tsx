import { useDashboardState } from './hooks/useDashboardState';
import { Hero } from './components/layout/Hero';
import { Sidebar } from './components/layout/Sidebar';
import { MainDashboard } from './components/layout/MainDashboard';

export default function App() {
  const state = useDashboardState();

  const executionMode = state.health.data?.executionMode ?? state.appInfo.data?.mode ?? 'mock';

  return (
    <div className="app-shell">
      <Hero state={state} executionMode={executionMode} />

      <main className="layout">
        <Sidebar state={state} />
        <MainDashboard state={state} />
      </main>
    </div>
  );
}
