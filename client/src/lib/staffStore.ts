import { User } from './types';
import { MOCK_USERS } from './mockData';

const STORAGE_KEY = 'maximus_staff';

export function loadStaff(): User[] {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored) {
    try {
      return JSON.parse(stored) as User[];
    } catch {
      return MOCK_USERS;
    }
  }
  return MOCK_USERS;
}

export function saveStaff(staff: User[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(staff));
}
