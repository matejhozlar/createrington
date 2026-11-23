export interface SafeStorage {
  get(key: string): string | null;
  getJson(key: string): unknown;
  set(key: string, value: string): boolean;
  setJson(key: string, value: unknown): boolean;
  remove(key: string): void;
}

function safeStorage(area: () => Storage): SafeStorage {
  const get = (key: string): string | null => {
    try {
      return area().getItem(key);
    } catch {
      return null;
    }
  };

  const set = (key: string, value: string): boolean => {
    try {
      area().setItem(key, value);
      return true;
    } catch {
      return false;
    }
  };

  return {
    get,
    getJson(key) {
      const raw = get(key);
      if (raw === null) return null;
      try {
        return JSON.parse(raw) as unknown;
      } catch {
        return null;
      }
    },
    set,
    setJson: (key, value) => set(key, JSON.stringify(value)),
    remove(key) {
      try {
        area().removeItem(key);
      } catch {
        return;
      }
    },
  };
}

export const localStore = safeStorage(() => localStorage);
export const sessionStore = safeStorage(() => sessionStorage);
