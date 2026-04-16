import type { User } from "./types";

const CREDENTIALS_KEY = "maximus_credentials";

type CredentialsMap = Record<string, string>; // emailLower -> password

function safeParse<T>(raw: string | null): T | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export function loadCredentials(): CredentialsMap {
  const parsed = safeParse<CredentialsMap>(localStorage.getItem(CREDENTIALS_KEY));
  return parsed ?? {};
}

export function saveCredentials(map: CredentialsMap) {
  localStorage.setItem(CREDENTIALS_KEY, JSON.stringify(map));
}

export function ensureDefaultPasswordForStaff(staff: User[]) {
  const map = loadCredentials();
  let changed = false;

  for (const s of staff) {
    const key = (s.email || "").toLowerCase().trim();
    if (!key) continue;
    if (map[key] === undefined) {
      map[key] = "password";
      changed = true;
    }
  }

  if (changed) saveCredentials(map);
}

export function verifyPassword(email: string, password: string) {
  const key = (email || "").toLowerCase().trim();
  if (!key) return false;
  const map = loadCredentials();
  return map[key] === password;
}

export function updateLoginCredentials(params: {
  oldEmail: string;
  newEmail: string;
  newPassword?: string;
}) {
  const map = loadCredentials();

  const oldKey = (params.oldEmail || "").toLowerCase().trim();
  const newKey = (params.newEmail || "").toLowerCase().trim();

  if (!newKey) throw new Error("Email is required");

  const existingPassword = oldKey ? map[oldKey] : undefined;

  const passwordToSet =
    params.newPassword !== undefined ? params.newPassword : existingPassword ?? "password";

  if (oldKey && oldKey !== newKey) {
    delete map[oldKey];
  }

  map[newKey] = passwordToSet;
  saveCredentials(map);
}

export function generateTemporaryPassword() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
  let out = "";
  for (let i = 0; i < 10; i++) {
    out += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return out;
}
