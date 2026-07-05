import { useEffect, useState } from 'react';
import { AppShell } from '@/components/app-shell';
import { PageHeader } from '@/components/page-header';
import { Key, Server, Settings2 } from 'lucide-react';

export default function SettingsPage() {
  const [groqKey, setGroqKey] = useState('');
  const [openRouterKey, setOpenRouterKey] = useState('');
  const [ollamaUrl, setOllamaUrl] = useState('http://localhost:11434');
  const [statusMessage, setStatusMessage] = useState('');

  useEffect(() => {
    // Load existing settings
    if (typeof window !== 'undefined') {
      setGroqKey(localStorage.getItem('GROQ_API_KEY') || '');
      setOpenRouterKey(localStorage.getItem('OPENROUTER_API_KEY') || '');
      setOllamaUrl(localStorage.getItem('OLLAMA_URL') || 'http://localhost:11434');
    }
  }, []);

  const handleSave = () => {
    localStorage.setItem('GROQ_API_KEY', groqKey);
    localStorage.setItem('OPENROUTER_API_KEY', openRouterKey);
    localStorage.setItem('OLLAMA_URL', ollamaUrl);
    setStatusMessage('Settings saved successfully!');
    setTimeout(() => setStatusMessage(''), 3000);
  };

  return (
    <AppShell currentPath="/settings">
      <PageHeader
        eyebrow="Config"
        title="Settings"
        description="Configure API credentials and endpoints for offline/online parsing and CBSE evaluations."
      />

      <div className="max-w-2xl space-y-6">
        {statusMessage && (
          <div className="rounded-2xl bg-teal-50 border border-teal-200 p-4 text-sm text-teal-800 font-medium">
            {statusMessage}
          </div>
        )}

        <div className="card-surface p-6 rounded-[2rem] border border-slate-200 bg-white">
          <h2 className="text-lg font-semibold text-ink flex items-center gap-2 mb-4">
            <Key className="h-5 w-5 text-accent" />
            API Keys & Providers
          </h2>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1" htmlFor="groq-key">
                Groq API Key (Primary)
              </label>
              <input
                id="groq-key"
                type="password"
                value={groqKey}
                onChange={(e) => setGroqKey(e.target.value)}
                placeholder="gsk_..."
                className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm focus:border-amber-400 focus:outline-none"
              />
              <p className="mt-1 text-xs text-slate-500">
                Used as the primary engine for question layout structuring and grading.
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1" htmlFor="openrouter-key">
                OpenRouter API Key (Fallback)
              </label>
              <input
                id="openrouter-key"
                type="password"
                value={openRouterKey}
                onChange={(e) => setOpenRouterKey(e.target.value)}
                placeholder="sk-or-..."
                className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm focus:border-amber-400 focus:outline-none"
              />
              <p className="mt-1 text-xs text-slate-500">
                Used if the primary Groq engine encounters rate limits or quota errors.
              </p>
            </div>
          </div>
        </div>

        <div className="card-surface p-6 rounded-[2rem] border border-slate-200 bg-white">
          <h2 className="text-lg font-semibold text-ink flex items-center gap-2 mb-4">
            <Server className="h-5 w-5 text-accent" />
            Local OCR Model
          </h2>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1" htmlFor="ollama-url">
              Ollama Endpoint URL
            </label>
            <input
              id="ollama-url"
              type="text"
              value={ollamaUrl}
              onChange={(e) => setOllamaUrl(e.target.value)}
              placeholder="http://localhost:11434"
              className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm focus:border-amber-400 focus:outline-none"
            />
            <p className="mt-1 text-xs text-slate-500">
              The endpoint of your local Ollama runtime running <code>glm-ocr</code>.
            </p>
          </div>
        </div>

        <button
          onClick={handleSave}
          className="rounded-full bg-ink px-6 py-3.5 text-sm font-semibold text-white shadow-soft transition hover:bg-slate-800"
          style={{ color: '#ffffff' }}
        >
          Save Configurations
        </button>
      </div>
    </AppShell>
  );
}
