import { useEffect, useState } from 'react';
import { Routes, Route, useNavigate, useLocation } from 'react-router-dom';
import HomePage from './pages/HomePage';
import TestPage from './pages/TestPage';
import ResultsPage from './pages/ResultsPage';
import MyPapersPage from './pages/MyPapersPage';
import SettingsPage from './pages/SettingsPage'; // Settings dashboard component
import { secureGet } from '@/lib/secure-storage';
import { OllamaSetup } from '@/components/OllamaSetup';

export default function App() {
  const navigate = useNavigate();
  const location = useLocation();
  const [showOllamaSetup, setShowOllamaSetup] = useState(false);

  useEffect(() => {
    const isTauri = typeof window !== 'undefined' && (window as any).__TAURI__ !== undefined;
    const setupComplete = localStorage.getItem('ollama-setup-complete');
    
    if (isTauri && !setupComplete) {
      setShowOllamaSetup(true);
    }
  }, []);

  useEffect(() => {
    async function initKeysAndOnboarding() {
      // Injected from .env via vite define config
      const fallbackGroq = (process.env as any).GROQ_API_KEY || "";
      const fallbackOpenRouter = (process.env as any).OPENROUTER_API_KEY || "";

      // Sync secure keys from Tauri Store or fallback to injected environment variables
      const groqKey = await secureGet('GROQ_API_KEY') || fallbackGroq;
      const openRouterKey = await secureGet('OPENROUTER_API_KEY') || fallbackOpenRouter;

      if (groqKey) localStorage.setItem('GROQ_API_KEY', groqKey);
      if (openRouterKey) localStorage.setItem('OPENROUTER_API_KEY', openRouterKey);

      // Auto-set onboarding complete if we have at least one key configured
      if (groqKey || openRouterKey) {
        localStorage.setItem('onboarding-complete', 'true');
      }

      // Onboarding check
      const onboardingComplete = localStorage.getItem('onboarding-complete');
      if (!onboardingComplete && location.pathname !== '/settings' && !showOllamaSetup) {
        navigate('/settings?onboarding=true');
      }
    }
    initKeysAndOnboarding();
  }, [navigate, location.pathname, showOllamaSetup]);

  const handleSetupComplete = () => {
    localStorage.setItem('ollama-setup-complete', 'true');
    setShowOllamaSetup(false);
  };

  return (
    <>
      {showOllamaSetup && <OllamaSetup onComplete={handleSetupComplete} />}
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/test" element={<TestPage />} />
        <Route path="/results" element={<ResultsPage />} />
        <Route path="/my-papers" element={<MyPapersPage />} />
        <Route path="/settings" element={<SettingsPage />} />
      </Routes>
    </>
  );
}
