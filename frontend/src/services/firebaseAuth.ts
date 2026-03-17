export type User = {
  uid: string;
  email?: string;
  isAnonymous?: boolean;
  getIdToken: () => Promise<string>;
};

type StoredUser = {
  uid: string;
  email?: string;
  password?: string;
  isAnonymous?: boolean;
};

const STORAGE_KEY = 'aura.auth.currentUser';
const USERS_KEY = 'aura.auth.users';

const listeners = new Set<(user: User | null) => void>();
let currentUser: User | null = fromStorage();

export const hasFirebaseConfig = true;
export const app = {};
export const auth = {};

function normalizeUser(user: StoredUser): User {
  return {
    uid: user.uid,
    email: user.email,
    isAnonymous: user.isAnonymous,
    getIdToken: async () => `local-token-${user.uid}`,
  };
}

function fromStorage(): User | null {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return null;

  try {
    return normalizeUser(JSON.parse(raw) as StoredUser);
  } catch {
    return null;
  }
}

function saveCurrentUser(user: StoredUser | null) {
  if (!user) {
    localStorage.removeItem(STORAGE_KEY);
    currentUser = null;
  } else {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(user));
    currentUser = normalizeUser(user);
  }

  listeners.forEach((callback) => callback(currentUser));
}

function loadUsers(): StoredUser[] {
  const raw = localStorage.getItem(USERS_KEY);
  if (!raw) return [];
  try {
    return JSON.parse(raw) as StoredUser[];
  } catch {
    return [];
  }
}

function saveUsers(users: StoredUser[]) {
  localStorage.setItem(USERS_KEY, JSON.stringify(users));
}

export function subscribeAuthState(callback: (user: User | null) => void) {
  listeners.add(callback);
  callback(currentUser);

  return () => {
    listeners.delete(callback);
  };
}

export async function loginWithEmailPassword(email: string, password: string) {
  const users = loadUsers();
  const user = users.find((item) => item.email?.toLowerCase() === email.toLowerCase() && item.password === password);

  if (!user) {
    throw new Error('Credenciais inválidas.');
  }

  saveCurrentUser(user);
}

export async function registerWithEmailPassword(email: string, password: string) {
  const users = loadUsers();
  const hasEmail = users.some((item) => item.email?.toLowerCase() === email.toLowerCase());

  if (hasEmail) {
    throw new Error('Já existe uma conta com este e-mail.');
  }

  const newUser: StoredUser = {
    uid: `user_${Date.now()}`,
    email,
    password,
    isAnonymous: false,
  };

  users.push(newUser);
  saveUsers(users);
  saveCurrentUser(newUser);
}

export async function loginAnonymously() {
  const anon: StoredUser = {
    uid: `anon_${Date.now()}`,
    isAnonymous: true,
  };

  saveCurrentUser(anon);
}

export async function logout() {
  saveCurrentUser(null);
}
