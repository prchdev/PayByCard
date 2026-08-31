// Client-side storage for the server-issued session token.
//
// The token is an opaque, signed, expiring value handed out by the backend when
// a sign-in completes. It is attached to every backend request so the server can
// establish who is calling instead of trusting an id sent in the request body.

const USER_TOKEN_KEY = 'pbc_session_token';
const ADMIN_TOKEN_KEY = 'pbc_admin_session_token';

export function setUserSessionToken(token: string | null | undefined): void {
  if (!token) return;
  try {
    sessionStorage.setItem(USER_TOKEN_KEY, token);
    localStorage.setItem(USER_TOKEN_KEY, token);
  } catch {
    // storage unavailable
  }
}

export function getUserSessionToken(): string | null {
  try {
    return sessionStorage.getItem(USER_TOKEN_KEY) || localStorage.getItem(USER_TOKEN_KEY);
  } catch {
    return null;
  }
}

export function clearUserSessionToken(): void {
  try {
    sessionStorage.removeItem(USER_TOKEN_KEY);
    localStorage.removeItem(USER_TOKEN_KEY);
  } catch {
    // ignore
  }
}

export function setAdminSessionToken(token: string | null | undefined): void {
  if (!token) return;
  try {
    sessionStorage.setItem(ADMIN_TOKEN_KEY, token);
    localStorage.setItem(ADMIN_TOKEN_KEY, token);
  } catch {
    // ignore
  }
}

export function getAdminSessionToken(): string | null {
  try {
    return sessionStorage.getItem(ADMIN_TOKEN_KEY) || localStorage.getItem(ADMIN_TOKEN_KEY);
  } catch {
    return null;
  }
}

export function clearAdminSessionToken(): void {
  try {
    sessionStorage.removeItem(ADMIN_TOKEN_KEY);
    localStorage.removeItem(ADMIN_TOKEN_KEY);
  } catch {
    // ignore
  }
}
