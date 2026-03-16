const STORAGE_KEY = 'remembered_credentials';

interface StoredCredentials {
  email: string;
  password: string;
}

export const credentialStorage = {
  save(email: string, password: string): void {
    const credentials: StoredCredentials = {
      email,
      password: btoa(password)
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(credentials));
  },

  load(): StoredCredentials | null {
    const data = localStorage.getItem(STORAGE_KEY);
    if (!data) return null;
    
    try {
      const credentials = JSON.parse(data) as StoredCredentials;
      return {
        email: credentials.email,
        password: atob(credentials.password)
      };
    } catch {
      return null;
    }
  },

  clear(): void {
    localStorage.removeItem(STORAGE_KEY);
  },

  hasStored(): boolean {
    return localStorage.getItem(STORAGE_KEY) !== null;
  }
};
