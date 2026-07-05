import { Routes, Route } from 'react-router-dom';
import HomePage from './pages/HomePage';
import TestPage from './pages/TestPage';
import ResultsPage from './pages/ResultsPage';
import MyPapersPage from './pages/MyPapersPage';
import SettingsPage from './pages/SettingsPage';

export default function App() {
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
