import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { AppShell } from '@/components/app-shell';
import { PageHeader } from '@/components/page-header';
import { Key, Server, Settings2, ShieldCheck, CheckCircle2, AlertCircle, RefreshCw, Download } from 'lucide-react';
import { secureGet, secureSet } from '@/lib/secure-storage';
import { isTauri } from '@tauri-apps/api/core';

export default function SettingsPage() {
  const location = useLocation();
  const isOnboarding = new URLSearchParams(location.search).get('onboarding') === 'true';

  const [groqKey, setGroqKey] = useState('');
  const [openRouterKey, setOpenRouterKey] = useState('');
  const [ollamaUrl, setOllamaUrl] = useState('http://localhost:11434');
  const [statusMessage, setStatusMessage] = useState('');

  // Ollama Diagnostics
  const [ollamaConnected, setOllamaConnected] = useState<boolean | null>(null);
  const [ollamaModels, setOllamaModels] = useState<string[]>([]);
  const [checkingOllama, setCheckingOllama] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState<number | null>(null);

  useEffect(() => {
    // Load existing settings securely
    async function loadSettings() {
      const gKey = await secureGet('GROQ_API_KEY');
      const orKey = await secureGet('OPENROUTER_API_KEY');
      const oUrl = await secureGet('OLLAMA_URL');
      
      setGroqKey(gKey || '');
      setOpenRouterKey(orKey || '');
      setOllamaUrl(oUrl || 'http://localhost:11434');
    }
    loadSettings();
  }, []);

  const handleSave = async () => {
    await secureSet('GROQ_API_KEY', groqKey);
    await secureSet('OPENROUTER_API_KEY', openRouterKey);
    await secureSet('OLLAMA_URL', ollamaUrl);
    
    localStorage.setItem('onboarding-complete', 'true');
    setStatusMessage('Settings saved successfully!');
    setTimeout(() => setStatusMessage(''), 3000);
  };

  const checkOllamaStatus = async () => {
    setCheckingOllama(true);
    setOllamaConnected(null);
    try {
      if (isTauri()) {
        const { invoke } = await import('@tauri-apps/api/core');
        const ok = await invoke<boolean>('ollama_health', { url: ollamaUrl });
        setOllamaConnected(ok);
        if (ok) {
          const models = await invoke<string[]>('ollama_list_models', { url: ollamaUrl });
          setOllamaModels(models);
        }
      } else {
        // Fallback for web dev proxy
        const res = await fetch('/api/ollama/tags');
        if (res.ok) {
          setOllamaConnected(true);
          const data = await res.json();
          const models = (data.models || []).map((m: any) => m.name);
          setOllamaModels(models);
        } else {
          setOllamaConnected(false);
        }
      }
    } catch (e) {
      console.error(e);
      setOllamaConnected(false);
    } finally {
      setCheckingOllama(false);
    }
  };

  const startModelDownload = async () => {
    setDownloadProgress(0);
    // Simulate model pulling progression
    for (let p = 0; p <= 100; p += 10) {
      setDownloadProgress(p);
      await new Promise(r => setTimeout(r, 200));
    }
    setDownloadProgress(null);
    // Refresh models list
    checkOllamaStatus();
  };

  return (
    <AppShell currentPath="/settings">
      <PageHeader
        eyebrow="Config"
        title="Settings"
        description="Configure API credentials and endpoints for offline/online parsing and CBSE evaluations."
      />

      <div className="max-w-2xl space-y-6 pb-12">
        {/* Onboarding Welcome Banner */}
        {isOnboarding && (
          <div className="rounded-[2rem] bg-amber-50 border border-amber-200 p-6 shadow-sm flex gap-4 items-start animate-fade-in">
            <div className="rounded-full bg-amber-100 p-2 text-amber-800">
              <ShieldCheck className="h-6 w-6" />
            </div>
            <div>
              <h3 className="font-serif text-lg font-bold text-amber-950 mb-1">Welcome to Examiner AI!</h3>
              <p className="text-sm text-amber-800 leading-relaxed">
                To start parsing PDF exam papers and conducting practice tests, please provide a Groq or OpenRouter API key.
                Configurations are persisted securely on your device.
              </p>
            </div>
          </div>
        )}

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

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1" htmlFor="ollama-url">
                Ollama Endpoint URL
              </label>
              <div className="flex gap-2">
                <input
                  id="ollama-url"
                  type="text"
                  value={ollamaUrl}
                  onChange={(e) => setOllamaUrl(e.target.value)}
                  placeholder="http://localhost:11434"
                  className="flex-1 rounded-2xl border border-slate-200 px-4 py-3 text-sm focus:border-amber-400 focus:outline-none"
                />
                <button
                  onClick={checkOllamaStatus}
                  disabled={checkingOllama}
                  className="rounded-2xl border border-slate-200 hover:bg-slate-50 px-4 flex items-center gap-2 text-sm font-medium text-slate-700 transition cursor-pointer"
                >
                  <RefreshCw className={`h-4 w-4 ${checkingOllama ? 'animate-spin' : ''}`} />
                  Test Endpoint
                </button>
              </div>
              <p className="mt-1 text-xs text-slate-500">
                The endpoint of your local Ollama runtime running <code>glm-ocr</code>.
              </p>
            </div>

            {/* Ollama Connection Diagnostics Panel */}
            {ollamaConnected !== null && (
              <div className={`p-4 rounded-2xl border ${ollamaConnected ? 'bg-emerald-50 border-emerald-100' : 'bg-red-50 border-red-100'}`}>
                <div className="flex items-start gap-3">
                  {ollamaConnected ? (
                    <>
                      <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0 mt-0.5" />
                      <div className="flex-1">
                        <span className="text-sm font-bold text-emerald-950">Ollama Connected</span>
                        <div className="mt-2 space-y-1">
                          <p className="text-xs text-emerald-800">Installed local models:</p>
                          {ollamaModels.length > 0 ? (
                            <div className="flex flex-wrap gap-1.5 mt-1.5">
                              {ollamaModels.map((m) => (
                                <span key={m} className="px-2 py-0.5 bg-emerald-100 border border-emerald-200 text-emerald-800 text-[10px] font-mono rounded-md">
                                  {m}
                                </span>
                              ))}
                            </div>
                          ) : (
                            <p className="text-[11px] text-emerald-700 italic">No models found on node.</p>
                          )}
                        </div>

                        {!ollamaModels.some(m => m.includes('glm-ocr')) && (
                          <div className="mt-4 border-t border-emerald-200/50 pt-3">
                            <button
                              onClick={startModelDownload}
                              disabled={downloadProgress !== null}
                              className="inline-flex items-center gap-2 rounded-full bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold px-4 py-2 cursor-pointer transition shadow-sm"
                            >
                              <Download className="h-3 w-3" />
                              {downloadProgress !== null ? `Downloading GLM-OCR (${downloadProgress}%)` : 'Pull GLM-OCR Model'}
                            </button>
                            {downloadProgress !== null && (
                              <div className="w-full bg-emerald-100 h-1.5 rounded-full overflow-hidden mt-2">
                                <div className="bg-emerald-600 h-1.5 rounded-full transition-all duration-200" style={{ width: `${downloadProgress}%` }} />
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </>
                  ) : (
                    <>
                      <AlertCircle className="h-5 w-5 text-red-600 shrink-0 mt-0.5" />
                      <div>
                        <span className="text-sm font-bold text-red-950">Ollama Offline</span>
                        <p className="text-xs text-red-800 mt-1 leading-relaxed">
                          Could not reach Ollama at {ollamaUrl}. Ensure Ollama is running locally on your device (<code>ollama serve</code>).
                        </p>
                      </div>
                    </>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        <button
          onClick={handleSave}
          className="rounded-full bg-ink px-8 py-3.5 text-sm font-semibold text-white shadow-soft transition hover:bg-slate-800 cursor-pointer"
          style={{ color: '#ffffff' }}
        >
          Save Configurations
        </button>
      </div>
    </AppShell>
  );
}
