import { useState } from 'react';
import HeroPage from './HeroPage';
import SimulationPage from './SimulationPage';
import DashboardPage from './DashboardPage';

const Index = () => {
  const [page, setPage] = useState('hero');

  return (
    <div className="scanlines">
      {page === 'hero' && <HeroPage onNavigate={setPage} />}
      {page === 'simulation' && <SimulationPage onNavigate={setPage} />}
      {page === 'dashboard' && <DashboardPage onNavigate={setPage} />}
    </div>
  );
};

export default Index;
