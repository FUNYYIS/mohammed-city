import type { MissionStorage } from '../missions/runtime/MissionRuntime';

export class BrowserMissionStorage implements MissionStorage {
  getItem(key: string): string | null {
    try {
      return window.localStorage.getItem(key);
    } catch {
      return null;
    }
  }

  setItem(key: string, value: string): void {
    try {
      window.localStorage.setItem(key, value);
    } catch {
      // Private browsing or storage pressure may disable persistence.
    }
  }

  removeItem(key: string): void {
    try {
      window.localStorage.removeItem(key);
    } catch {
      // Reset still applies to the in-memory runtime when storage is blocked.
    }
  }
}
