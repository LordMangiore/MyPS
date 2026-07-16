import React, { createContext, useContext, useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

const AuthContext = createContext(null);

export const useAuth = () => useContext(AuthContext);

const STORAGE_KEY = 'prosource_session_v1';
const PROFILE_KEY = 'prosource_profile_v1';

/** Auth pages themselves — never a valid post-login destination (would loop). */
const AUTH_PATHS = ['/sign-in', '/create-account'];

/**
 * Sanitize a post-login `?returnTo=` destination.
 *
 * Open-redirect guard: the value must resolve to *this* origin, so absolute
 * URLs ("https://evil.com"), protocol-relative ("//evil.com"), backslash
 * variants ("/\evil.com") and non-http schemes ("javascript:…") all resolve to
 * a different origin — or fail to parse — and fall back. Returns `fallback`
 * (default null) for anything it doesn't positively trust.
 */
export const safeReturnTo = (raw, fallback = null) => {
  if (typeof raw !== 'string' || !raw) return fallback;
  // Must be an absolute internal path. `raw` is already decoded by
  // URLSearchParams — decoding again would re-open encoded attacks.
  if (!raw.startsWith('/')) return fallback;
  let url;
  try {
    url = new URL(raw, window.location.origin);
  } catch {
    return fallback;
  }
  if (url.origin !== window.location.origin) return fallback;
  if (AUTH_PATHS.includes(url.pathname)) return fallback;
  return `${url.pathname}${url.search}${url.hash}`;
};

const loadSession = () => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
};

const loadCachedProfile = () => {
  try {
    const raw = localStorage.getItem(PROFILE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
};

export const AuthProvider = ({ children }) => {
  const initial = loadSession();
  const cachedProfile = loadCachedProfile();
  const navigate = useNavigate();
  const location = useLocation();
  const [isLoggedIn, setIsLoggedIn] = useState(!!initial);
  const [isNewUser, setIsNewUser] = useState(initial?.isNewUser || false);
  const [userEmail, setUserEmail] = useState(initial?.email || '');
  // No display name until a session supplies one — every consumer falls back
  // ('You' / 'there'), so an empty string is the honest neutral default.
  const [userName, setUserName] = useState(initial?.name || '');
  const [userId, setUserId] = useState(initial?.userId || null);
  const [token, setToken] = useState(initial?.token || null);
  const [userType, setUserType] = useState(initial?.userType || 'tradepro');
  const [showroom, setShowroom] = useState(initial?.showroom || null);
  const [accountManager, setAccountManager] = useState(initial?.accountManager || null);
  const [profile, setProfile] = useState(cachedProfile);
  const [profileLoading, setProfileLoading] = useState(false);

  const persist = (session) => {
    try {
      if (session) localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
      else localStorage.removeItem(STORAGE_KEY);
    } catch {}
  };

  const persistProfile = (p) => {
    try {
      if (p) localStorage.setItem(PROFILE_KEY, JSON.stringify(p));
      else localStorage.removeItem(PROFILE_KEY);
    } catch {}
  };

  /** Ask the (stubbed) CRM which showroom + account manager owns this zip. */
  const lookupShowroom = async (zip) => {
    const res = await fetch('/api/lookup-showroom', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ zip }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Lookup failed');
    return data;
  };

  /** Request a 6-digit code be emailed to the user. */
  const requestCode = async (email) => {
    const res = await fetch('/api/otp-send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Failed to send code');
    return data;
  };

  /**
   * Verify the 6-digit code. Returns { isNewUser, user, token }.
   * Does NOT log the user in — call finalizeSession() once you're ready
   * (immediately for returning users, after onboarding for new ones).
   */
  const verifyCode = async (email, code) => {
    const res = await fetch('/api/otp-verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, code }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Invalid code');
    return data;
  };

  /**
   * Generic per-user persistence helpers (projects, messages, etc.) backed by
   * the user-data Netlify function.
   */
  const loadUserData = async (key, fallback = null) => {
    if (!userId) return fallback;
    try {
      const res = await fetch(`/api/user-data?userId=${encodeURIComponent(userId)}&key=${encodeURIComponent(key)}`);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || `Failed to load ${key}`);
      if (data.value && typeof data.value === 'object' && 'value' in data.value) {
        return data.value.value ?? fallback;
      }
      return data.value ?? fallback;
    } catch (err) {
      console.warn(`loadUserData(${key}) failed:`, err.message);
      return fallback;
    }
  };

  const saveUserData = async (key, value) => {
    if (!userId) throw new Error('Not signed in');
    const res = await fetch('/api/user-data', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, key, value }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || `Failed to save ${key}`);
    return true;
  };

  /** Fetch the user's saved profile from the ps-users blob. */
  const fetchProfile = async ({ userId: uid, email } = {}) => {
    const params = new URLSearchParams();
    if (uid) params.set('userId', uid);
    else if (email) params.set('email', email);
    if (!params.toString()) return null;

    const res = await fetch(`/api/get-profile?${params}`);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Failed to load profile');
    return data.profile || null;
  };

  /** Refresh the in-context profile from the server. */
  const refreshProfile = async () => {
    if (!userId && !userEmail) return null;
    setProfileLoading(true);
    try {
      const p = await fetchProfile({ userId, email: userEmail });
      setProfile(p);
      persistProfile(p);
      if (p?.firstName) setUserName(p.firstName);
      if (p?.showroom) setShowroom(p.showroom);
      if (p?.accountManager) setAccountManager(p.accountManager);
      return p;
    } finally {
      setProfileLoading(false);
    }
  };

  /**
   * Persist the user's profile to the ps-users blob.
   * Merges with whatever's already saved (shallow). Returns the merged record.
   *
   * `overrides` lets callers pass userId/email explicitly — useful during
   * onboarding when the React state hasn't flushed yet from finalizeSession.
   */
  const saveProfile = async (profileData, overrides = {}) => {
    const uid = overrides.userId || userId;
    const mail = overrides.email || userEmail;
    if (!uid) throw new Error('Not signed in');
    const res = await fetch('/api/save-profile', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: uid, email: mail, profile: profileData }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Failed to save profile');
    setProfile(data.profile);
    persistProfile(data.profile);
    if (data.profile?.firstName) setUserName(data.profile.firstName);
    return data.profile;
  };

  /** Commit a verified session and flip isLoggedIn → true. */
  const finalizeSession = (sessionInput) => {
    const session = {
      email: sessionInput.email,
      name: sessionInput.name || (sessionInput.email ? sessionInput.email.split('@')[0] : 'Member'),
      userId: sessionInput.userId || null,
      token: sessionInput.token || null,
      isNewUser: !!sessionInput.isNewUser,
      firebaseUid: sessionInput.firebaseUid || null,
      userType: sessionInput.userType || 'tradepro',
      showroom: sessionInput.showroom || null,
      accountManager: sessionInput.accountManager || null,
    };
    persist(session);
    setUserEmail(session.email);
    setUserName(session.name);
    setUserId(session.userId);
    setToken(session.token);
    setIsNewUser(session.isNewUser);
    setUserType(session.userType);
    setShowroom(session.showroom);
    setAccountManager(session.accountManager);
    setIsLoggedIn(true);

    // Best-effort profile fetch — don't block login on it. For brand-new users
    // there's nothing to load yet; their first saveProfile will populate it.
    if (session.userId && !session.isNewUser) {
      fetchProfile({ userId: session.userId, email: session.email })
        .then((p) => {
          if (p) {
            setProfile(p);
            persistProfile(p);
            if (p.firstName) setUserName(p.firstName);
            // The profile blob carries showroom + AM (stamped during
            // submit-quote). Use it so the dashboard welcome modal and
            // "Your ProSource Team" panel show the real AM, not "PS".
            if (p.showroom && !session.showroom) {
              setShowroom(p.showroom);
              persist({ ...session, showroom: p.showroom, accountManager: p.accountManager || session.accountManager });
            }
            if (p.accountManager && !session.accountManager) {
              setAccountManager(p.accountManager);
            }
          }
        })
        .catch((err) => console.warn('Profile load failed:', err.message));
    }

    // Active cart stays put across sign-in — same localStorage store works
    // for guests and members. The user can save it to their library from the
    // shop quote page if they want a named snapshot.

    // Honor a post-login destination captured when a logged-out user hit a
    // protected URL (see NotFoundRedirect in main.jsx). Only navigate when
    // there's a trusted returnTo to consume: callers that finalize a session
    // without one — the landing page, and the quote wizard, which finalizes
    // mid-modal and then renders its own success step — must stay put.
    const dest = safeReturnTo(new URLSearchParams(location.search).get('returnTo'));
    if (dest) navigate(dest, { replace: true });
  };

  /**
   * "Demo: Skip Signup" — sign into the shared, pre-seeded demo account.
   *
   * This used to fake a session locally with `userId: null`, which made every
   * persistence helper above a silent no-op (saveUserData threw "Not signed
   * in"). It now goes through /api/demo-session for a real userId + token, so
   * the demo app saves like any other account — and its data survives across
   * clicks, because the endpoint seeds only what's missing.
   *
   * Async and throws: callers must await and surface the failure.
   * `name` only overrides the display name (the demo's greeting) — the account
   * itself is fixed server-side.
   */
  const login = async ({ name } = {}) => {
    const res = await fetch('/api/demo-session', { method: 'POST' });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.user?.id) {
      throw new Error(data.error || 'Could not start the demo session');
    }
    finalizeSession({
      email: data.user.email,
      name: name || data.user.name,
      userId: data.user.id,
      token: data.token,
      isNewUser: !!data.isNewUser,
      firebaseUid: data.user.firebaseUid || null,
      userType: data.userType,
      showroom: data.showroom,
      accountManager: data.accountManager,
    });
    return data;
  };

  const logout = () => {
    persist(null);
    persistProfile(null);
    setIsLoggedIn(false);
    setIsNewUser(false);
    setUserEmail('');
    setUserName('');
    setUserId(null);
    setToken(null);
    setProfile(null);
    localStorage.removeItem('prosource_welcome_dismissed');
  };

  return (
    <AuthContext.Provider
      value={{
        isLoggedIn,
        isNewUser,
        userEmail,
        userName,
        userId,
        token,
        userType,
        showroom,
        accountManager,
        profile,
        profileLoading,
        login,
        logout,
        requestCode,
        verifyCode,
        finalizeSession,
        lookupShowroom,
        saveProfile,
        refreshProfile,
        loadUserData,
        saveUserData,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};
