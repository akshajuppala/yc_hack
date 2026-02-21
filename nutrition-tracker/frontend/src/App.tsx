import { useState } from 'react';
import MainMenu from './components/MainMenu';
import WebcamCapture from './components/WebcamCapture';
import Dashboard from './components/Dashboard';
import './index.css';

type Screen = 'menu' | 'capture' | 'dashboard';

function App() {
  const [screen, setScreen] = useState<Screen>('menu');
  const [capturedCount, setCapturedCount] = useState(0);

  const handleFoodCaptured = () => {
    setCapturedCount(prev => prev + 1);
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {screen === 'menu' && (
          <MainMenu
            capturedCount={capturedCount}
            onScanFood={() => setScreen('capture')}
            onViewDashboard={() => setScreen('dashboard')}
          />
        )}
        {screen === 'capture' && (
          <WebcamCapture
            onBack={() => setScreen('menu')}
            onViewDashboard={() => setScreen('dashboard')}
            onFoodCaptured={handleFoodCaptured}
          />
        )}
        {screen === 'dashboard' && (
          <Dashboard
            onBack={() => setScreen('menu')}
            onAddMore={() => setScreen('capture')}
            onSessionCleared={() => setCapturedCount(0)}
          />
        )}
      </div>
    </div>
  );
}

export default App;
