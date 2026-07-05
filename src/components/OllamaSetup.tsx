import { useEffect, useState } from 'react';
import { Loader2, CheckCircle2, AlertCircle } from 'lucide-react';

type SetupState = 'starting' | 'downloading' | 'ready' | 'error';

export function OllamaSetup({ onComplete }: { onComplete: () => void }) {
  const [state, setState] = useState<SetupState>('starting');
  const [progress, setProgress] = useState(0);
  const [statusMsg, setStatusMsg] = useState('Starting AI engine...');
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    let mounted = true;
    const isTauri = typeof window !== 'undefined' && (window as any).__TAURI__ !== undefined;

    async function setup() {
      if (!isTauri) {
        // Web mode — skip setup, Ollama is optional
        onComplete();
        return;
      }

      try {
        const { invoke } = await import('@tauri-apps/api/core');
        const { listen } = await import('@tauri-apps/api/event');

        // Listen for progress events
        const unlistenProgress = await listen<number>('ollama-pull-progress', (event) => {
          if (mounted) {
            setProgress(event.payload);
            if (event.payload < 100) {
              setState('downloading');
              setStatusMsg(`Downloading GLM-OCR model... ${event.payload}%`);
            }
          }
        });

        const unlistenStatus = await listen<string>('ollama-pull-status', (event) => {
          if (mounted) setStatusMsg(event.payload);
        });

        // Poll setup status
        const checkInterval = setInterval(async () => {
          try {
            const status = await invoke<any>('get_ollama_setup_status');
            if (status.ready) {
              if (mounted) {
                setState('ready');
                setStatusMsg('Ready!');
                setTimeout(() => onComplete(), 1000);
              }
              clearInterval(checkInterval);
            } else if (status.running && !status.has_glm_ocr) {
              if (mounted) {
                setState('downloading');
                setStatusMsg('Downloading GLM-OCR model... ');
              }
            }
          } catch {
            // ignore polling errors
          }
        }, 2000);

        // Initial check
        const status = await invoke<any>('get_ollama_setup_status');
        if (status.ready) {
          if (mounted) {
            setState('ready');
            setTimeout(() => onComplete(), 500);
          }
        } else {
          if (mounted) setState('downloading');
        }

        return () => {
          clearInterval(checkInterval);
          unlistenProgress();
          unlistenStatus();
        };
      } catch (err: any) {
        if (mounted) {
          setState('error');
          setErrorMsg(err.message || 'Setup failed');
        }
      }
    }

    const cleanup = setup();
    return () => { mounted = false; cleanup?.then(fn => fn && fn()); };
  }, [onComplete]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-mist">
      <div className="w-full max-w-md text-center p-8">
        {state === 'ready' ? (
          <CheckCircle2 className="h-16 w-16 text-emerald-600 mx-auto mb-4" />
        ) : state === 'error' ? (
          <AlertCircle className="h-16 w-16 text-red-600 mx-auto mb-4" />
        ) : (
          <Loader2 className="h-16 w-16 text-accent mx-auto mb-4 animate-spin" />
        )}

        <h2 className="font-serif text-2xl font-bold text-ink mb-2">
          {state === 'ready' ? 'All Ready!' :
           state === 'error' ? 'Setup Failed' :
           'Setting up Examiner AI'}
        </h2>

        <p className="text-sm text-slate-500 mb-6">{statusMsg}</p>

        {state === 'downloading' && (
          <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden mb-2">
            <div
              className="bg-accent h-2 rounded-full transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
        )}
        {state === 'downloading' && (
          <p className="text-xs font-mono text-accent">{progress}%</p>
        )}

        {state === 'error' && (
          <div className="mt-4">
            <p className="text-xs text-red-600 mb-4">{errorMsg}</p>
            <button
              onClick={() => window.location.reload()}
              className="rounded-full bg-ink px-6 py-2 text-sm text-white"
            >
              Retry
            </button>
          </div>
        )}

        {state === 'error' && (
          <p className="text-[11px] text-slate-400 mt-6">
            You can skip this and use Groq Vision OCR instead (uses API quota).
            <button onClick={onComplete} className="underline ml-1">Skip →</button>
          </p>
        )}
      </div>
    </div>
  );
}
