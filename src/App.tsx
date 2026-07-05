import { useEffect } from 'react';
import { Routes, Route, useNavigate, useLocation } from 'react-router-dom';
import HomePage from './pages/HomePage';
import TestPage from './pages/TestPage';
import ResultsPage from './pages/ResultsPage';
import MyPapersPage from './pages/MyPapersPage';
import SettingsPage from './pages/SettingsPage'; // Settings dashboard component
import { secureGet } from '@/lib/secure-storage';

export default function App() {
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    async function initKeysAndOnboarding() {
      // Sync secure keys from Tauri Store
      const groqKey = await secureGet('GROQ_API_KEY');
      const openRouterKey = await secureGet('OPENROUTER_API_KEY');
      if (groqKey) localStorage.setItem('GROQ_API_KEY', groqKey);
      if (openRouterKey) localStorage.setItem('OPENROUTER_API_KEY', openRouterKey);

      // Onboarding check
      const onboardingComplete = localStorage.getItem('onboarding-complete');
      if (!onboardingComplete && location.pathname !== '/settings') {
        navigate('/settings?onboarding=true');
      }
    }
    initKeysAndOnboarding();
  }, [navigate, location.pathname]);

  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/test" element={<TestPage />} />
      <Route path="/results" element={<ResultsPage />} />
      <Route path="/my-papers" element={<MyPapersPage />} />
      <Route path="/settings" element={<SettingsPage />} />
    </Routes>
  );
}
