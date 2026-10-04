import React from 'react';
import Dashboard from './components/Dashboard';
import WorkflowEditor from './components/WorkflowEditor';
import ResultsTable from './components/ResultsTable';
import { useFlowStore } from './store';

const App: React.FC = () => {
  const view = useFlowStore((s) => s.view);

  return (
    <div style={{ minHeight: '100vh', background: '#0f172a' }}>
      {view === 'dashboard' && <Dashboard />}
      {view === 'editor' && <WorkflowEditor />}
      {view === 'results' && <ResultsTable />}
    </div>
  );
};

export default App;
