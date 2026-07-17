import React, { createContext, useContext, useState, useEffect, useMemo, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { adoptActiveCartForUser, releaseActiveCart } from './guest-cart';

const AuthContext = createContext(null);

export const useAuth = () => useContext(AuthContext);

const STORAGE_KEY = 'prosource_session_v1';
const PROFILE_KEY = 'prosource_profile_v1';

/** Auth pages themselves: never a valid post-login destination (would loop). */
const AUTH_PATHS = ['/sign-in', '/create-account'];

/**
 * Sanitize a post-login `?returnTo=` destination.
 *
 * Open-redirect guard: the value must resolve to *this* origin, so absolute
 * URLs ("https://evil.com"), protocol-relative ("//evil.com"), backslash
 * variants ("/\evil.com") and non-http schemes ("javascript:…") all resolve to
 * a different origin (or fail to parse) and fall back. Returns `fallback`
 * (default null) for anything it doesn't positively trust.
 */
export const safeReturnTo = (raw, fallback = null) => {
  if (typeof raw !== 'string' || !raw) return fallback;
  // Must be an absolute internal path. `raw` is already decoded by
  // URLSearchParams; decoding again would re-open encoded attacks.
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

/**
 * Rehydrate the persisted session, discarding one that can't work.
 *
 * "Demo: Skip Signup" used to build a session with `userId: null`. Those are
 * still sitting in real browsers' localStorage, and they rehydrate into the
 * worst possible state: `isLoggedIn` is true, so the UI offers the full app and
 * hides the sign-in entry points, but every `loadUserData` silently returns its
 * fallback and every `saveUserData` throws "Not signed in". The user appears
 * signed in to an app that cannot persist a single thing, with nothing on
 * screen saying so.
 *
 * `userId` is what every persistence call is keyed on, so a session without one
 * is not a session. Dropping it here renders the app logged-out and lets the
 * user sign in again, self-healing every stale browser on next load.
 *
 * Deliberately NOT re-authenticating from here: a stale session should send
 * someone back to the door, not quietly hand them a new identity.
 */
const loadSession = () => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || !parsed.userId) {
      // Clear the dead session *and* its cached profile: the two are written
      // and cleared as one record everywhere else in this file. Nothing else is
      // touched: the guest cart is a separate key and survives, so the user
      // drops back to being a guest holding the cart they already had.
      localStorage.removeItem(STORAGE_KEY);
      localStorage.removeItem(PROFILE_KEY);
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
};

/**
 * Every showroom the account works with, primary first.
 *
 * An account can work with more than one showroom (each with its own account
 * manager), but `showroom` (singular) predates that and is read all over the
 * app, so it stays: it is always `showrooms[0]`. This derivation is the bridge.
 * Sessions and profiles written before multi-showroom carry only the singular
 * field, so promote it to a one-element list rather than reporting no showrooms
 * at all. Returns [] only when there is genuinely nothing to show.
 */
const deriveShowrooms = (list, single) => {
  if (Array.isArray(list) && list.length) return list;
  return single ? [single] : [];
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
  // No display name until a session supplies one. Every consumer falls back
  // ('You' / 'there'), so an empty string is the honest neutral default.
  const [userName, setUserName] = useState(initial?.name || '');
  const [userId, setUserId] = useState(initial?.userId || null);
  const [token, setToken] = useState(initial?.token || null);
  const [userType, setUserType] = useState(initial?.userType || 'tradepro');
  const [showroom, setShowroom] = useState(initial?.showroom || null);
  // Raw list as supplied by the session/profile, or null when the record
  // predates multi-showroom. `showrooms` below is what consumers read.
  const [showroomList, setShowroomList] = useState(initial?.showrooms || null);
  const [accountManager, setAccountManager] = useState(initial?.accountManager || null);
  const [profile, setProfile] = useState(cachedProfile);
  const [profileLoading, setProfileLoading] = useState(false);

  /**
   * Where "home" is for this account.
   *
   * Not everyone's home is the member dashboard. Showroom staff have no
   * projects, carts or orders of their own, so sending them there lands them in
   * an empty copy of somebody else's app. Pages hardcoded `/settings` in their
   * back link, which is right for a member and wrong for an account manager, so
   * the answer lives here rather than in nine components.
   */
  const homePath = useMemo(
    () => (userType === 'accountmanager' ? '/am' : '/settings'),
    [userType]
  );

  /**
   * All showrooms the account works with, primary first. Additive: `showroom`
   * and `accountManager` keep meaning exactly what they mean today (the
   * primary's), so nothing reading the singular fields changes.
   */
  const showrooms = useMemo(
    // The cached profile is a source too, not just the session. A session
    // persisted before `showrooms` existed has only the singular `showroom`,
    // and the profile blob is where the full list actually lives.
    () => deriveShowrooms(showroomList || profile?.showrooms, showroom),
    [showroomList, profile, showroom]
  );

  /**
   * Adopt the active cart into the account.
   *
   * Runs on session *restore* as well as at sign-in: finalizeSession only fires
   * on the sign-in itself, so without this a returning user's cart would never
   * reconnect to their account after a page reload: no mirror, no continuity.
   * `adoptActiveCartForUser` is idempotent and no-ops once it has run for a
   * given userId, so this is safe on every mount.
   */
  useEffect(() => {
    if (!userId) return;
    adoptActiveCartForUser(userId).catch((err) =>
      console.warn('Cart adoption failed:', err.message)
    );
  }, [userId]);

  /**
   * Backfill `showrooms` for a session that predates multi-showroom.
   *
   * `finalizeSession` persists the list, but only fires at sign-in, and the
   * profile is never refetched on a returning visit. So a browser holding a
   * session from before that change would keep reporting a single showroom
   * forever: the project wizard would never offer a choice, and the feature
   * would look broken rather than absent. Fetch the profile once, and only for
   * the sessions that are actually missing the list. Everyone else pays nothing.
   */
  const backfilledShowrooms = useRef(false);
  useEffect(() => {
    if (!userId || backfilledShowrooms.current) return;
    if (showroomList?.length || profile?.showrooms?.length) return;
    backfilledShowrooms.current = true;
    refreshProfile().catch((err) =>
      console.warn('Showroom backfill failed:', err.message)
    );
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, showroomList, profile]);

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
   * Does NOT log the user in. Call finalizeSession() once you're ready
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
      if (p?.showrooms?.length) setShowroomList(p.showrooms);
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
   * `overrides` lets callers pass userId/email explicitly, which is useful during
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
      // Carry the full list, not just the primary. This object is what `persist`
      // writes and `loadSession` reads back, so a key missing here is a key the
      // app can never see again: an account with several showrooms would look
      // like it had one, and anything gated on having a choice (the project
      // wizard's showroom step) would never appear. Callers that predate
      // multi-showroom pass nothing, which is fine: `showrooms` below falls back
      // to the singular one.
      showrooms: Array.isArray(sessionInput.showrooms) && sessionInput.showrooms.length
        ? sessionInput.showrooms
        : null,
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
    setShowroomList(session.showrooms);
    setAccountManager(session.accountManager);
    setIsLoggedIn(true);

    // Best-effort profile fetch; don't block login on it. For brand-new users
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

    // The guest cart is adopted into the account by the effect above, which
    // fires as soon as setUserId lands, covering sign-in and session restore
    // through one path.

    // Honor a post-login destination captured when a logged-out user hit a
    // protected URL (see NotFoundRedirect in main.jsx). Only navigate when
    // there's a trusted returnTo to consume: callers that finalize a session
    // without one (the landing page, and the quote wizard, which finalizes
    // mid-modal and then renders its own success step) must stay put.
    const dest = safeReturnTo(new URLSearchParams(location.search).get('returnTo'));
    if (dest) navigate(dest, { replace: true });
  };

  /**
   * "Demo: Skip Signup" signs into the shared, pre-seeded demo account.
   *
   * This used to fake a session locally with `userId: null`, which made every
   * persistence helper above a silent no-op (saveUserData threw "Not signed
   * in"). It now goes through /api/demo-session for a real userId + token, so
   * the demo app saves like any other account, and its data survives across
   * clicks, because the endpoint seeds only what's missing.
   *
   * Async and throws: callers must await and surface the failure.
   * `name` only overrides the display name (the demo's greeting); the account
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
      showrooms: data.showrooms,
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
    // The active cart is the *account's* cart once adopted: it's mirrored to
    // their blob and comes back on next sign-in. Leaving it in localStorage
    // would hand it to whoever uses this browser next.
    releaseActiveCart();
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
        showrooms,
        homePath,
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
