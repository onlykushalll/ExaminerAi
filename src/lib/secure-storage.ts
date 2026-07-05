import { isTauri } from '@tauri-apps/api/core';

export async function secureGet(key: string): Promise<string | null> {
  if (isTauri()) {
    try {
      const { Store } = await import('@tauri-apps/plugin-store');
      const store = await Store.load('settings.json');
      const val = await store.get<string>(key);
      if (val) {
        // Sync to localStorage for sync getters
        localStorage.setItem(key, val);
        return val;
      }
    } catch (e) {
      console.error('Failed to get from Tauri Store, falling back to localStorage:', e);
    }
  }
  return localStorage.getItem(key);
}

export async function secureSet(key: string, value: string): Promise<void> {
  // Sync to localStorage for sync getters
  localStorage.setItem(key, value);
  
  if (isTauri()) {
    try {
      const { Store } = await import('@tauri-apps/plugin-store');
      const store = await Store.load('settings.json');
      await store.set(key, value);
      await store.save();
      return;
    } catch (e) {
      console.error('Failed to save to Tauri Store:', e);
    }
  }
}
