import type { SessionData } from '../types';

/**
 * sessionService - خدمة إدارة الجلسة المخصصة
 * تعتمد على sessionToken بدلاً من Firebase Tokens
 */

const SESSION_KEY = 'arbahy_session_v2';
const TOKEN_EXPIRY_BUFFER = 5 * 60 * 1000; // 5 minutes

export const sessionService = {
  saveSession(session: SessionData): void {
    try {
      localStorage.setItem(SESSION_KEY, JSON.stringify(session));
    } catch (error) {
      console.error('Error saving session:', error);
    }
  },

  getSession(): SessionData | null {
    try {
      const data = localStorage.getItem(SESSION_KEY);
      if (!data) return null;

      const session = JSON.parse(data) as Partial<SessionData>;
      
      if (!session.uid || !session.sessionToken) {
        return null;
      }

      return session as SessionData;
    } catch (error) {
      console.error('Error reading session:', error);
      return null;
    }
  },

  clearSession(): void {
    try {
      localStorage.removeItem(SESSION_KEY);
      sessionStorage.clear();
    } catch (error) {
      console.error('Error clearing session:', error);
    }
  },

  isSessionValid(session: SessionData | null): boolean {
    if (!session) return false;
    if (Date.now() >= session.expiresAt) return false;
    if (!session.sessionToken) return false;
    return true;
  },

  isTokenExpiringSoon(session: SessionData | null): boolean {
    if (!session) return false;
    const timeUntilExpiry = session.expiresAt - Date.now();
    return timeUntilExpiry < TOKEN_EXPIRY_BUFFER && timeUntilExpiry > 0;
  },

  getTokenExpiryTime(session: SessionData | null): number {
    if (!session) return 0;
    const timeRemaining = session.expiresAt - Date.now();
    return Math.max(0, Math.floor(timeRemaining / 1000));
  },

  updateSession(updates: Partial<SessionData>): void {
    const current = this.getSession();
    if (!current) return;
    const updated: SessionData = { ...current, ...updates };
    this.saveSession(updated);
  }
};
