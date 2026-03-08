import { useState } from 'react';
import HeroPage from './HeroPage';
import SimulationPage from './SimulationPage';
import DashboardPage from './DashboardPage';
import ThemePicker from '@/components/ThemePicker';
import ParticleField from '@/components/ParticleField';
import { ThemeProvider } from '@/contexts/ThemeContext';

const Index = () => {
  const [page, setPage] = useState('hero');
  const [transitioning, setTransitioning] = useState(false);

  const navigate = (target: string) => {
    setTransitioning(true);
    setTimeout(() => {
      setPage(target);
      setTransitioning(false);
    }, 300);
  };

  return (
    <ThemeProvider>
      <div className="scanlines">
        <ParticleField />
        <ThemePicker />
        <div className={`transition-opacity duration-300 ${transitioning ? 'opacity-0' : 'opacity-100'}`}>
          {page === 'hero' && <HeroPage onNavigate={navigate} />}
          {page === 'simulation' && <SimulationPage onNavigate={navigate} />}
          {page === 'dashboard' && <DashboardPage onNavigate={navigate} />}
        </div>
      </div>
    </ThemeProvider>
  );
};

export default Index;
