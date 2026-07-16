import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ShoppingBag, Headset, Home } from 'lucide-react';
import { useAuth } from './auth-context';
import AddressAutocomplete from './components/AddressAutocomplete';

/**
 * `initialPage` / `initialMode` let the router mount this straight onto the
 * email form (/sign-in, /create-account) instead of the marketing landing (/).
 * Both entry points run the identical email→OTP flow. The OTP verify response
 * tells us whether this is a new or returning user, so `authMode` only steers
 * copy, never behavior.
 */
const ProSourceLogin = ({ initialPage = 'email', initialMode = 'signin' }) => {
  const { login, requestCode, verifyCode, finalizeSession, lookupShowroom, saveProfile } = useAuth();
  const [page, setPage] = useState(initialPage); // email, auth, email-sent, step1..step4, hoStep1
  const [authMode, setAuthMode] = useState(initialMode); // 'signin' | 'signup'
  const [userType, setUserType] = useState('tradepro'); // 'tradepro' | 'homeowner'
  const [email, setEmail] = useState('');
  const [emailError, setEmailError] = useState(false);
  const [emailResent, setEmailResent] = useState(false);
  const [code, setCode] = useState('');
  const [codeError, setCodeError] = useState('');
  const [sending, setSending] = useState(false);
  const [verifying, setVerifying] = useState(false);
  // CRM lookup state, kicked off when zip is entered in Step 1, used to
  // render the assigned showroom + account manager on the final step.
  const [crmLookup, setCrmLookup] = useState(null);
  const [crmLookupZip, setCrmLookupZip] = useState(null);

  const triggerCrmLookup = (zip) => {
    const trimmed = String(zip || '').trim();
    if (!trimmed || !/^\d{5}/.test(trimmed)) return;
    if (crmLookupZip === trimmed && crmLookup) return; // already have it
    setCrmLookupZip(trimmed);
    setCrmLookup(null);
    lookupShowroom(trimmed)
      .then(setCrmLookup)
      .catch((err) => console.error('CRM lookup failed', err));
  };

  // Homeowner-only step state
  const [hoProject, setHoProject] = useState('');
  const [hoBudget, setHoBudget] = useState('');
  const [hoTimeline, setHoTimeline] = useState('');
  const [hoRooms, setHoRooms] = useState({ kitchen: false, bath: false, living: false, bedroom: false, basement: false, outdoor: false });
  const [hoWorkingWith, setHoWorkingWith] = useState({ designer: false, contractor: false, diy: false });
  const [hoHearAbout, setHoHearAbout] = useState('');
  const [hoOptInMarketing, setHoOptInMarketing] = useState(true);
  const [hoOptInTerms, setHoOptInTerms] = useState(false);
  const toggleHoRoom = (k) => setHoRooms(prev => ({ ...prev, [k]: !prev[k] }));
  const toggleHoWith = (k) => setHoWorkingWith(prev => ({ ...prev, [k]: !prev[k] }));
  // Step 1: About You
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phone, setPhone] = useState('');
  // Step 2: Your Business
  const [businessName, setBusinessName] = useState('');
  const [businessStreet, setBusinessStreet] = useState('');
  const [businessCity, setBusinessCity] = useState('');
  const [businessState, setBusinessState] = useState('MO');
  const [businessZip, setBusinessZip] = useState('');
  const [businessPhone, setBusinessPhone] = useState('');
  const [businessSameAddress, setBusinessSameAddress] = useState(false);
  const [tradeType, setTradeType] = useState('');
  const [businessType, setBusinessType] = useState('');
  const [licenseNumber, setLicenseNumber] = useState('');
  const [website, setWebsite] = useState('');
  const [employees, setEmployees] = useState('6-10');
  const [projects, setProjects] = useState('5-10');
  const [spend, setSpend] = useState('$20,000-$50,000');
  // Step 3: How You'll Work With Us
  const [showroomUsage, setShowroomUsage] = useState('accompany');
  const [interests, setInterests] = useState({ hardwood: false, lvp: false, tile: false, carpet: false, cabinets: false, countertops: false, install: false });
  const [currentSuppliers, setCurrentSuppliers] = useState('');
  const [upcomingProjects, setUpcomingProjects] = useState('');
  const [hearAbout, setHearAbout] = useState('');
  const [helpedBy, setHelpedBy] = useState('');
  const [optInTerms, setOptInTerms] = useState(false);
  const [showTerms, setShowTerms] = useState(false);
  const [optInUpdates, setOptInUpdates] = useState(true);
  const [optInConsent, setOptInConsent] = useState(true);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [page]);

  const [emailErrorMsg, setEmailErrorMsg] = useState('');

  const checkEmail = async () => {
    const trimmed = email.trim();
    if (!trimmed || !trimmed.includes('@')) {
      setEmailError(true);
      setEmailErrorMsg('Please enter a valid email address to continue.');
      return;
    }
    setEmailError(false);
    setEmailErrorMsg('');
    setSending(true);
    try {
      await requestCode(trimmed);
      setCode('');
      setCodeError('');
      setPage('email-sent');
    } catch (err) {
      setEmailError(true);
      setEmailErrorMsg(err.message || 'Failed to send code. Please try again.');
    } finally {
      setSending(false);
    }
  };

  const handleResend = async () => {
    try {
      await requestCode(email);
      setEmailResent(true);
      setTimeout(() => setEmailResent(false), 3000);
    } catch (err) {
      setCodeError(err.message || 'Failed to resend');
    }
  };

  const [pendingSession, setPendingSession] = useState(null);

  const handleVerify = async () => {
    if (code.length !== 6) {
      setCodeError('Enter the 6-digit code');
      return;
    }
    setVerifying(true);
    setCodeError('');
    try {
      const data = await verifyCode(email, code);
      const session = {
        email: data.user.email,
        name: data.user.name || data.user.email.split('@')[0],
        userId: data.user.id,
        token: data.token,
        isNewUser: !!data.isNewUser,
        firebaseUid: data.user.firebaseUid || null,
      };
      if (data.isNewUser) {
        // Stash session and walk the onboarding wizard before logging in.
        setPendingSession(session);
        setPage('typeChoice');
      } else {
        // Returning user. Log in immediately.
        finalizeSession(session);
      }
    } catch (err) {
      setCodeError(err.message || 'Invalid code');
    } finally {
      setVerifying(false);
    }
  };

  /** Build the profile payload that goes into the ps-users blob. */
  const buildProfilePayload = () => {
    const base = {
      email,
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      phone: phone.trim(),
      userType,
      showroom: crmLookup?.showroom || null,
      accountManager: crmLookup?.manager || null,
    };

    if (userType === 'homeowner') {
      return {
        ...base,
        address: {
          street: businessStreet.trim(),
          city: businessCity.trim(),
          state: businessState,
          zip: businessZip.trim(),
        },
        project: {
          type: hoProject,
          rooms: Object.keys(hoRooms).filter((k) => hoRooms[k]),
          budget: hoBudget,
          timeline: hoTimeline,
        },
        workingWith: Object.keys(hoWorkingWith).filter((k) => hoWorkingWith[k]),
        hearAbout: hoHearAbout,
        optInMarketing: hoOptInMarketing,
        optInTerms: hoOptInTerms,
      };
    }

    // tradepro
    return {
      ...base,
      businessAddress: {
        street: businessStreet.trim(),
        city: businessCity.trim(),
        state: businessState,
        zip: businessZip.trim(),
      },
      business: {
        name: businessName.trim(),
        phone: businessPhone.trim(),
        tradeType,
        businessType,
        licenseNumber: licenseNumber.trim(),
        website: website.trim(),
        employees,
        projects,
        spend,
      },
      preferences: {
        showroomUsage,
        interests: Object.keys(interests).filter((k) => interests[k]),
        currentSuppliers: currentSuppliers.trim(),
        upcomingProjects: upcomingProjects.trim(),
        hearAbout,
        helpedBy: helpedBy.trim(),
      },
      optInTerms,
      optInUpdates,
      optInConsent,
    };
  };

  const handleOnboardingComplete = async () => {
    if (pendingSession) {
      const payload = buildProfilePayload();
      // Save the profile first so it's persisted before the dashboard renders.
      // Don't block login if save fails. The user can re-save from settings.
      try {
        await saveProfile(payload, {
          userId: pendingSession.userId,
          email: pendingSession.email,
        });
      } catch (err) {
        console.error('Profile save failed:', err);
      }
      finalizeSession({
        ...pendingSession,
        name: firstName || pendingSession.name,
        userType,
        showroom: crmLookup?.showroom || null,
        accountManager: crmLookup?.manager || null,
      });
    } else {
      // No verified session behind this wizard (only reachable if someone lands
      // on the onboarding steps without verifying a code, since handleVerify always
      // sets pendingSession). We can't mint a real account without OTP verify,
      // so fall back to the demo account rather than a session that can't save.
      await login({ name: firstName.trim() || undefined });
    }
  };

  const toggleInterest = (key) => {
    setInterests(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const colors = {
    red: '#BA0C2F',
    blue: '#003087',
    blueLight: '#1a4a9e',
    bluePale: '#e8edf7',
    gray50: '#f9f9f8',
    gray100: '#f0eeeb',
    gray200: '#e2dfda',
    gray300: '#c8c4bc',
    gray500: '#8a867e',
    gray700: '#4a4642',
    gray900: '#1a1714',
    green: '#07542E',
    greenPale: '#e6f2ec',
    white: '#ffffff',
  };

  const s = {
    nav: {
      background: colors.white,
      borderBottom: `1px solid ${colors.gray200}`,
      height: 60,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      position: 'sticky',
      top: 0,
      zIndex: 100,
    },
    logoPs: {
      fontFamily: "'DM Serif Display', 'Georgia', serif",
      fontSize: 22,
      color: colors.blue,
      letterSpacing: -0.5,
      textDecoration: 'none',
    },
    logoWh: {
      fontSize: 11,
      fontWeight: 500,
      color: colors.gray500,
      letterSpacing: 1.5,
      textTransform: 'uppercase',
      marginLeft: 3,
    },
    navLinks: {
      display: 'flex',
      gap: 28,
    },
    navLink: {
      fontSize: 13,
      color: colors.gray700,
      textDecoration: 'none',
      fontWeight: 400,
      cursor: 'pointer',
    },
    authLayout: {
      minHeight: 'calc(100vh - 60px)',
    },
    authLeft: {
      background: colors.blue,
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'center',
      position: 'relative',
      overflow: 'hidden',
    },
    authLeftContent: {
      position: 'relative',
      zIndex: 1,
    },
    authEyebrow: {
      fontSize: 11,
      letterSpacing: 2,
      textTransform: 'uppercase',
      color: 'rgba(255,255,255,0.5)',
      marginBottom: 16,
      fontWeight: 500,
    },
    authHeadline: {
      fontFamily: "'DM Serif Display', 'Georgia', serif",
      color: colors.white,
      lineHeight: 1.15,
      marginBottom: 20,
    },
    authHeadlineClass: 'text-[28px] md:text-[40px]',
    authBody: {
      fontSize: 15,
      color: 'rgba(255,255,255,0.7)',
      lineHeight: 1.7,
      marginBottom: 40,
      maxWidth: 380,
    },
    authBenefits: {
      display: 'flex',
      flexDirection: 'column',
      gap: 14,
    },
    authBenefit: {
      display: 'flex',
      alignItems: 'center',
      gap: 12,
    },
    benefitDot: {
      width: 6,
      height: 6,
      borderRadius: '50%',
      background: colors.red,
      flexShrink: 0,
    },
    benefitText: {
      fontSize: 14,
      color: 'rgba(255,255,255,0.8)',
    },
    authRight: {
      background: '#f7f8fa',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
    },
    authFormWrap: {
      width: '100%',
      maxWidth: 400,
    },
    authTitle: {
      fontSize: 24,
      fontWeight: 600,
      color: colors.gray900,
      marginBottom: 6,
    },
    authSubtitle: {
      fontSize: 14,
      color: colors.gray500,
      marginBottom: 32,
      lineHeight: 1.5,
    },
    field: {
      marginBottom: 18,
    },
    fieldLabel: {
      display: 'block',
      fontSize: 12,
      fontWeight: 500,
      color: colors.gray700,
      marginBottom: 6,
      letterSpacing: 0.3,
    },
    input: {
      width: '100%',
      padding: '11px 14px',
      border: `1.5px solid ${colors.gray200}`,
      borderRadius: 6,
      fontSize: 14,
      fontFamily: "'DM Sans', sans-serif",
      color: colors.gray900,
      background: colors.white,
      outline: 'none',
      boxSizing: 'border-box',
    },
    select: {
      width: '100%',
      padding: '11px 14px',
      border: `1.5px solid ${colors.gray200}`,
      borderRadius: 6,
      fontSize: 14,
      fontFamily: "'DM Sans', sans-serif",
      color: colors.gray900,
      background: colors.white,
      outline: 'none',
      boxSizing: 'border-box',
      cursor: 'pointer',
    },
    textarea: {
      width: '100%',
      padding: '11px 14px',
      border: `1.5px solid ${colors.gray200}`,
      borderRadius: 6,
      fontSize: 14,
      fontFamily: "'DM Sans', sans-serif",
      color: colors.gray900,
      background: colors.white,
      outline: 'none',
      boxSizing: 'border-box',
      resize: 'vertical',
    },
    btnPrimary: {
      width: '100%',
      padding: '13px 24px',
      border: 'none',
      borderRadius: 6,
      fontSize: 14,
      fontWeight: 600,
      fontFamily: "'DM Sans', sans-serif",
      cursor: 'pointer',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      background: colors.blue,
      color: colors.white,
      transition: 'all 0.15s',
    },
    btnSecondary: {
      width: '100%',
      padding: '13px 24px',
      border: `1.5px solid ${colors.gray200}`,
      borderRadius: 6,
      fontSize: 14,
      fontWeight: 600,
      fontFamily: "'DM Sans', sans-serif",
      cursor: 'pointer',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      background: colors.gray100,
      color: colors.gray700,
      transition: 'all 0.15s',
    },
    divider: {
      display: 'flex',
      alignItems: 'center',
      gap: 12,
      margin: '20px 0',
    },
    dividerLine: {
      flex: 1,
      height: 1,
      background: colors.gray200,
    },
    dividerText: {
      fontSize: 12,
      color: colors.gray300,
      fontWeight: 500,
    },
    linkText: {
      fontSize: 13,
      color: colors.gray500,
      textAlign: 'center',
      marginTop: 16,
    },
    link: {
      color: colors.blue,
      textDecoration: 'none',
      fontWeight: 500,
      cursor: 'pointer',
    },
    alertInfo: {
      padding: '12px 14px',
      borderRadius: 6,
      fontSize: 13,
      marginBottom: 20,
      display: 'flex',
      alignItems: 'flex-start',
      gap: 10,
      background: colors.bluePale,
      color: colors.blue,
      border: '1px solid rgba(0,48,135,0.15)',
    },
    // Onboarding
    onboardingLayout: {
      flex: 1,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      padding: '48px 24px 80px',
      background: colors.gray50,
      minHeight: 'calc(100vh - 60px)',
    },
    stepIndicator: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 16,
    },
    stepDot: (status) => ({
      width: 32,
      height: 32,
      borderRadius: '50%',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontSize: 13,
      fontWeight: 600,
      background: status === 'done' ? colors.green : status === 'active' ? colors.blue : colors.gray200,
      color: status === 'pending' ? colors.gray500 : colors.white,
    }),
    stepLine: (done) => ({
      width: 60,
      height: 2,
      background: done ? colors.green : colors.gray200,
    }),
    onboardingCard: {
      background: colors.white,
      borderRadius: 10,
      border: `1px solid ${colors.gray200}`,
      boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
      width: '100%',
      maxWidth: 600,
    },
    onboardingCardTitle: {
      fontSize: 22,
      fontWeight: 600,
      color: colors.gray900,
      marginBottom: 6,
    },
    onboardingCardSub: {
      fontSize: 14,
      color: colors.gray500,
      marginBottom: 32,
      lineHeight: 1.5,
    },
    sectionLabel: {
      fontSize: 11,
      fontWeight: 600,
      letterSpacing: 1.5,
      textTransform: 'uppercase',
      color: colors.gray300,
      marginBottom: 16,
      paddingBottom: 8,
      borderBottom: `1px solid ${colors.gray100}`,
    },
    fieldRow: {
      gap: 12,
    },
    fieldRowClass: 'grid grid-cols-1 md:grid-cols-2',
    checkboxGroup: {
      display: 'flex',
      flexDirection: 'column',
      gap: 8,
      marginTop: 4,
    },
    checkboxItem: {
      display: 'flex',
      alignItems: 'center',
      gap: 10,
      cursor: 'pointer',
    },
    checkbox: {
      width: 16,
      height: 16,
      accentColor: colors.blue,
      cursor: 'pointer',
      flexShrink: 0,
    },
    checkboxLabel: {
      fontSize: 13,
      color: colors.gray700,
    },
    // Email sent
    emailIcon: {
      width: 72,
      height: 72,
      background: colors.bluePale,
      borderRadius: '50%',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontSize: 32,
      margin: '0 auto 20px',
    },
    emailTitle: {
      fontSize: 22,
      fontWeight: 600,
      color: colors.gray900,
      marginBottom: 8,
    },
    emailBody: {
      fontSize: 14,
      color: colors.gray500,
      lineHeight: 1.7,
      marginBottom: 28,
    },
    // Decorative circles for auth left
    circleTop: {
      content: '',
      position: 'absolute',
      top: -100,
      right: -100,
      width: 400,
      height: 400,
      borderRadius: '50%',
      background: 'rgba(255,255,255,0.04)',
    },
    circleBottom: {
      content: '',
      position: 'absolute',
      bottom: -80,
      left: -60,
      width: 300,
      height: 300,
      borderRadius: '50%',
      background: 'rgba(186,12,47,0.15)',
    },
    // AM match card
    amMatch: {
      background: colors.bluePale,
      border: '1.5px solid rgba(0,48,135,0.15)',
      borderRadius: 10,
      padding: 20,
      display: 'flex',
      alignItems: 'center',
      gap: 16,
      marginBottom: 28,
    },
    amAvatar: {
      width: 56,
      height: 56,
      borderRadius: '50%',
      objectFit: 'cover',
      border: '2px solid rgba(0,48,135,0.2)',
      flexShrink: 0,
    },
    amName: {
      fontSize: 16,
      fontWeight: 600,
      color: colors.blue,
      marginBottom: 2,
    },
    amRole: {
      fontSize: 13,
      color: colors.gray500,
    },
    amBadge: {
      fontSize: 11,
      fontWeight: 600,
      letterSpacing: 0.5,
      background: colors.blue,
      color: colors.white,
      padding: '2px 8px',
      borderRadius: 20,
      display: 'inline-block',
      marginTop: 4,
    },
  };

  // ---------- NAV ----------
  const renderNav = () => (
    <nav style={s.nav} className="px-4 md:px-8">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, width: '100%' }}>
        <Link to="/" style={{ display: 'flex', alignItems: 'baseline', gap: 3, textDecoration: 'none' }}>
          <span style={s.logoPs}>ProSource</span>
          <span style={s.logoWh} className="hidden sm:inline">Wholesale</span>
        </Link>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Link
            to="/profile"
            className="hidden md:inline"
            style={{ color: colors.gray700, fontSize: 14, fontWeight: 500, textDecoration: 'none' }}
          >Find a Pro</Link>
          {/* Guest browsing stays one tap away; the label collapses to the icon
              on narrow screens to make room for the two auth CTAs. */}
          <Link
            to="/shop"
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              padding: '8px 12px',
              border: `1px solid ${colors.gray300}`,
              borderRadius: 6,
              color: colors.gray900,
              fontSize: 13, fontWeight: 600,
              textDecoration: 'none',
              background: '#fff',
              whiteSpace: 'nowrap',
            }}
            aria-label="Browse products"
          >
            <ShoppingBag size={15} /> <span className="hidden md:inline">Browse products</span>
          </Link>
          <Link
            to="/sign-in"
            style={{
              padding: '8px 4px',
              color: colors.gray900,
              fontSize: 13, fontWeight: 600,
              textDecoration: 'none',
              whiteSpace: 'nowrap',
            }}
          >Sign In</Link>
          <Link
            to="/create-account"
            style={{
              padding: '8px 14px',
              borderRadius: 6,
              background: colors.blue,
              color: '#fff',
              fontSize: 13, fontWeight: 600,
              textDecoration: 'none',
              whiteSpace: 'nowrap',
            }}
          >Create Account</Link>
        </div>
      </div>
    </nav>
  );

  // ---------- Demo: Skip Signup ----------
  // Signs into one of the pre-seeded demo accounts via /api/demo-session, so the
  // demo session is a real one that actually persists. It's a network call:
  // show progress, and never fail silently.
  //
  // Three accounts, so the same app can be shown from all three sides of a job:
  // the trade pro buying the materials, the account manager selling them, and
  // the homeowner the job is for. The trade pro is the original button and the
  // default, unchanged: same label, same place, same call.
  //
  // `demoLoading` holds the persona currently signing in (or null), rather than
  // three booleans: it doubles as the mutual exclusion between the buttons, so a
  // second click while one is in flight can't start a race between two
  // identities. Errors are per persona, so a failure marks the button that
  // caused it and leaves the other two usable.
  const [demoLoading, setDemoLoading] = useState(null);
  const [demoErrors, setDemoErrors] = useState({});

  /**
   * Sign in as one of the demo personas.
   *
   * The trade pro goes through auth-context's `login()`, which is exactly what
   * it has always done. `login()` takes no persona and POSTs an empty body,
   * which the endpoint reads as the default (the trade pro), so that path is
   * untouched.
   *
   * The other two can't use `login()`: there's no way to get a persona through
   * it. Rather than change that shared function's signature, they do what
   * `login()` does (POST, then hand the response to `finalizeSession`) with the
   * persona in the body. Same endpoint, same response shape, same session
   * plumbing: only the account on the other end differs.
   */
  const startDemo = async (persona) => {
    if (persona === 'tradepro') {
      await login({ name: 'Justin' });
      return;
    }
    const res = await fetch('/api/demo-session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ persona }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.user?.id) {
      throw new Error(data.error || 'Could not start the demo session');
    }
    finalizeSession({
      email: data.user.email,
      name: data.user.name,
      userId: data.user.id,
      token: data.token,
      isNewUser: !!data.isNewUser,
      firebaseUid: data.user.firebaseUid || null,
      userType: data.userType,
      showroom: data.showroom,
      accountManager: data.accountManager,
    });
  };

  const handleDemo = (persona) => async () => {
    setDemoLoading(persona);
    setDemoErrors((prev) => ({ ...prev, [persona]: '' }));
    try {
      await startDemo(persona);
    } catch (err) {
      setDemoErrors((prev) => ({
        ...prev,
        [persona]: err.message || 'Could not start the demo session. Try again.',
      }));
      setDemoLoading(null);
    }
    // On success this component unmounts as the router swaps to the dashboard.
    // Leave `demoLoading` set so the buttons can't be fired mid-navigation.
  };

  // The two extra personas. The trade pro isn't here: it keeps its own button
  // above these, at full width, with the label it has always had.
  const extraDemoPersonas = [
    { key: 'am', label: 'Account manager', Icon: Headset },
    { key: 'homeowner', label: 'Homeowner', Icon: Home },
  ];

  const demoErrorText = (
    <>
      {Object.entries(demoErrors)
        .filter(([, msg]) => msg)
        .map(([key, msg]) => (
          <div
            key={key}
            role="alert"
            style={{ marginTop: 6, fontSize: 12, color: colors.red, textAlign: 'center' }}
          >
            {msg}
          </div>
        ))}
    </>
  );

  const renderDemoSkip = () => (
    <>
      <button
        onClick={handleDemo('tradepro')}
        disabled={!!demoLoading}
        style={{
          marginTop: 14,
          width: '100%',
          padding: '10px 14px',
          background: 'transparent',
          border: `1px dashed ${demoErrors.tradepro ? colors.red : colors.gray300}`,
          borderRadius: 6,
          fontSize: 12,
          fontWeight: 500,
          color: demoLoading ? colors.gray300 : colors.gray500,
          cursor: demoLoading ? 'default' : 'pointer',
          fontFamily: 'inherit',
        }}
      >
        {demoLoading === 'tradepro' ? 'Starting demo…' : 'Demo: Skip Signup →'}
      </button>

      {/* Says what the button above actually signs you in as, and introduces the
          two alternatives, without touching that button's own label. */}
      <div
        style={{
          marginTop: 8,
          fontSize: 11,
          color: colors.gray300,
          textAlign: 'center',
        }}
      >
        Trade pro view. Or explore as:
      </div>

      <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
        {extraDemoPersonas.map(({ key, label, Icon }) => (
          <button
            key={key}
            onClick={handleDemo(key)}
            disabled={!!demoLoading}
            style={{
              flex: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 5,
              padding: '7px 8px',
              background: 'transparent',
              border: `1px dashed ${demoErrors[key] ? colors.red : colors.gray300}`,
              borderRadius: 6,
              fontSize: 11,
              fontWeight: 500,
              color: demoLoading ? colors.gray300 : colors.gray500,
              cursor: demoLoading ? 'default' : 'pointer',
              fontFamily: 'inherit',
            }}
          >
            <Icon size={12} strokeWidth={2} />
            {demoLoading === key ? 'Starting…' : label}
          </button>
        ))}
      </div>

      {demoErrorText}
    </>
  );

  // ---------- AUTH LEFT PANEL ----------
  const renderAuthLeft = (eyebrow, headline, body, benefits) => (
    <div style={s.authLeft} className="p-8 md:p-14">
      <div style={s.circleTop} />
      <div style={s.circleBottom} />
      <div style={s.authLeftContent}>
        <div style={s.authEyebrow}>{eyebrow}</div>
        <div className={s.authHeadlineClass} style={s.authHeadline} dangerouslySetInnerHTML={{ __html: headline }} />
        <div style={s.authBody}>{body}</div>
        {benefits && (
          <div style={s.authBenefits}>
            {benefits.map((b, i) => (
              <div key={i} style={s.authBenefit}>
                <div style={s.benefitDot} />
                <div style={s.benefitText}>{b}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );

  // ---------- Inline email + Send Code form ----------
  const renderUserTypeChooser = ({ darkBg = false } = {}) => {
    const options = [
      { value: 'tradepro', label: "I'm a Trade Pro" },
      { value: 'homeowner', label: "I'm a Homeowner" },
    ];
    return (
      <div style={{ marginBottom: 16 }}>
        <div className="grid grid-cols-2 gap-2">
          {options.map(opt => {
            const isActive = userType === opt.value;
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => setUserType(opt.value)}
                style={{
                  padding: '12px 14px',
                  borderRadius: 8,
                  fontSize: 14,
                  fontWeight: isActive ? 700 : 500,
                  fontFamily: 'inherit',
                  cursor: 'pointer',
                  border: `1.5px solid ${
                    isActive
                      ? (darkBg ? colors.white : colors.blue)
                      : (darkBg ? 'rgba(255,255,255,0.25)' : colors.gray200)
                  }`,
                  background: isActive
                    ? (darkBg ? colors.white : colors.bluePale)
                    : (darkBg ? 'rgba(255,255,255,0.05)' : colors.white),
                  color: isActive
                    ? (darkBg ? colors.blue : colors.blue)
                    : (darkBg ? 'rgba(255,255,255,0.85)' : colors.gray700),
                  transition: 'all 0.15s ease',
                }}
              >
                {opt.label}
              </button>
            );
          })}
        </div>
      </div>
    );
  };

  const renderInlineEmailForm = ({ darkBg = false } = {}) => (
    <div>
      <form
        className="flex flex-col sm:flex-row gap-2"
        onSubmit={(e) => { e.preventDefault(); checkEmail(); }}
      >
        <input
          type="email"
          placeholder="you@yourbusiness.com"
          value={email}
          onChange={(e) => { setEmail(e.target.value); setEmailError(false); }}
          style={{
            flex: 1,
            padding: '14px 16px',
            borderRadius: 8,
            border: `1.5px solid ${emailError ? colors.red : (darkBg ? 'transparent' : colors.gray200)}`,
            background: darkBg ? colors.white : colors.white,
            color: colors.gray900,
            fontSize: 15,
            fontFamily: 'inherit',
            outline: 'none',
            minWidth: 0,
          }}
        />
        <button
          type="submit"
          disabled={!email.trim() || sending}
          style={{
            padding: '14px 24px',
            borderRadius: 8,
            border: 'none',
            background: !email.trim() || sending
              ? (darkBg ? 'rgba(255,255,255,0.2)' : colors.gray300)
              : colors.red,
            color: colors.white,
            fontWeight: 700,
            fontSize: 15,
            cursor: email.trim() && !sending ? 'pointer' : 'not-allowed',
            fontFamily: 'inherit',
            whiteSpace: 'nowrap',
            boxShadow: email.trim() && !sending && darkBg ? '0 4px 14px rgba(186,12,47,0.4)' : 'none',
            transition: 'all 0.15s ease',
          }}
        >
          {sending ? 'Sending…' : 'Send code'}
        </button>
      </form>
      {emailError && (
        <div style={{ color: darkBg ? '#ffb4b4' : colors.red, fontSize: 13, fontWeight: 500, marginTop: 8 }}>
          {emailErrorMsg || 'Please enter a valid email address to continue.'}
        </div>
      )}
      <div style={{ fontSize: 13, color: darkBg ? 'rgba(255,255,255,0.65)' : colors.gray500, marginTop: 10 }}>
        We'll email you a 6-digit code. No password required.
      </div>
    </div>
  );

  // ==================== PAGE: EMAIL CHECK ====================
  const renderEmailPage = () => (
    <>
      {/* Hero */}
      <section
        style={{
          background: colors.blue,
          color: colors.white,
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        <div style={s.circleTop} />
        <div style={s.circleBottom} />
        <div
          className="px-6 py-12 md:px-12 md:py-20"
          style={{ position: 'relative', zIndex: 1, maxWidth: 1100, margin: '0 auto' }}
        >
          <div style={s.authEyebrow}>Trade Pro Membership</div>
          <h1
            className={s.authHeadlineClass}
            style={{ ...s.authHeadline, maxWidth: 640 }}
            dangerouslySetInnerHTML={{ __html: 'Your showroom.<br/>Your business.<br/>Your ProSource.' }}
          />
          <p style={{ ...s.authBody, maxWidth: 560, marginBottom: 32 }}>
            Access member pricing, manage projects, and connect with your ProSource team, all in one place.
          </p>
          <div style={{ maxWidth: 520 }}>
            {renderInlineEmailForm({ darkBg: true })}
          </div>
        </div>
      </section>

      {/* Landing content */}
      {renderLanding()}

      {/* Bottom CTA */}
      <section
        id="get-started"
        style={{ background: colors.white, padding: '64px 24px' }}
      >
        <div style={{ maxWidth: 540, margin: '0 auto', textAlign: 'center' }}>
          <div style={{ fontSize: 12, letterSpacing: 2, textTransform: 'uppercase', color: colors.red, fontWeight: 600, marginBottom: 12 }}>
            Get started
          </div>
          <h2 style={{ fontFamily: "'DM Serif Display', 'Georgia', serif", fontSize: 32, color: colors.gray900, lineHeight: 1.2, margin: '0 0 12px' }}>
            Sign in or create your account.
          </h2>
          <p style={{ fontSize: 15, color: colors.gray700, lineHeight: 1.6, marginBottom: 24 }}>
            Enter your email and we'll send a one-time code. No password required.
          </p>
          <div style={{ textAlign: 'left' }}>
            {renderInlineEmailForm({ darkBg: false })}
            {renderDemoSkip()}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer style={{ background: colors.gray900, padding: '24px', textAlign: 'center' }}>
        <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.6)' }}>
          ProSource Wholesale &middot; Trade pricing on flooring, cabinets &amp; countertops
        </div>
      </footer>
    </>
  );

  // ---------- LANDING PAGE SECTIONS ----------
  const renderLanding = () => (
    <div style={{ background: colors.white }}>
      {/* How it works */}
      <section style={{ padding: '64px 24px' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: 48 }}>
            <div style={{ fontSize: 12, letterSpacing: 2, textTransform: 'uppercase', color: colors.red, fontWeight: 600, marginBottom: 12 }}>How it works</div>
            <h2 style={{ fontFamily: "'DM Serif Display', 'Georgia', serif", fontSize: 36, color: colors.gray900, lineHeight: 1.15, margin: 0 }}>Three steps to wholesale pricing.</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              { n: '1', title: 'Apply online', body: 'Tell us about your business: trade type, projects, showroom preference. Takes about three minutes.' },
              { n: '2', title: 'Visit your showroom', body: 'Your dedicated account manager finalizes your membership and walks you through products in person.' },
              { n: '3', title: 'Start sourcing', body: 'Browse 50,000+ products at member pricing. Build quotes, manage projects, collaborate with clients, online or in the app.' },
            ].map(step => (
              <div key={step.n} style={{ textAlign: 'left' }}>
                <div style={{
                  width: 40, height: 40, borderRadius: '50%',
                  background: colors.bluePale, color: colors.blue,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontWeight: 700, fontSize: 18, marginBottom: 16,
                }}>{step.n}</div>
                <div style={{ fontSize: 18, fontWeight: 600, color: colors.gray900, marginBottom: 8 }}>{step.title}</div>
                <div style={{ fontSize: 15, color: colors.gray700, lineHeight: 1.6 }}>{step.body}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* What's included */}
      <section style={{ background: colors.gray50, padding: '64px 24px' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: 48 }}>
            <div style={{ fontSize: 12, letterSpacing: 2, textTransform: 'uppercase', color: colors.red, fontWeight: 600, marginBottom: 12 }}>What's included</div>
            <h2 style={{ fontFamily: "'DM Serif Display', 'Georgia', serif", fontSize: 36, color: colors.gray900, lineHeight: 1.15, margin: 0 }}>Built for trade professionals.</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            {[
              { title: 'Wholesale pricing', body: 'Save on flooring, cabinets, countertops, tile, and more. Every day, no negotiation needed.' },
              { title: 'Dedicated account manager', body: 'A real person at your local showroom who knows your business and helps you win bids.' },
              { title: 'Project management', body: 'Organize quotes, products, clients, and team members on one canvas per project.' },
              { title: 'Trade Pro App', body: 'Approve estimates, pay invoices, and schedule pickups from your phone, even when you’re on a jobsite.' },
              { title: 'Client collaboration', body: 'Share inspiration boards and product selections with clients without giving up your margins.' },
              { title: 'Referral bonuses', body: 'Earn back on every client purchase. Track your year-to-date credit right from your dashboard.' },
            ].map(item => (
              <div key={item.title} style={{
                background: colors.white,
                border: `1px solid ${colors.gray200}`,
                borderRadius: 12,
                padding: 24,
              }}>
                <div style={{ fontSize: 17, fontWeight: 600, color: colors.gray900, marginBottom: 8 }}>{item.title}</div>
                <div style={{ fontSize: 14, color: colors.gray700, lineHeight: 1.6 }}>{item.body}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

    </div>
  );

  // ==================== PAGE: AUTH (dedicated sign-in / create-account) ====================
  // Same email→OTP flow either way; only the framing differs.
  const authCopy = {
    signin: {
      eyebrow: 'Welcome back',
      headline: 'Good to see you again.',
      body: 'Sign in to access your member pricing, projects, and ProSource team.',
      benefits: null,
      title: 'Sign in',
      subtitle: "Enter the email on your account and we'll send you a one-time code.",
      cta: 'Send my code',
      switchNote: 'New to ProSource?',
      switchLabel: 'Create an account',
      switchTo: '/create-account',
      switchMode: 'signup',
    },
    signup: {
      eyebrow: 'Trade Pro Membership',
      headline: 'Create your ProSource account.',
      body: 'Member pricing, project tools, and a dedicated account manager at your local showroom.',
      benefits: [
        'Wholesale pricing on 50,000+ products',
        'A dedicated account manager who knows your business',
        'Quotes, projects, and client collaboration in one place',
      ],
      title: 'Create your account',
      subtitle: "Start with your email. We'll send a one-time code, then ask a few quick questions.",
      cta: 'Get started',
      switchNote: 'Already a member?',
      switchLabel: 'Sign in',
      switchTo: '/sign-in',
      switchMode: 'signin',
    },
  };

  const renderAuthPage = () => {
    const copy = authCopy[authMode] || authCopy.signin;
    return (
      <div style={s.authLayout} className="grid grid-cols-1 md:grid-cols-2">
        {renderAuthLeft(copy.eyebrow, copy.headline, copy.body, copy.benefits)}
        <div style={s.authRight} className="px-6 py-10 md:px-14 md:py-12">
          <div style={s.authFormWrap}>
            <div style={s.authTitle}>{copy.title}</div>
            <div style={s.authSubtitle}>{copy.subtitle}</div>
            <form onSubmit={(e) => { e.preventDefault(); checkEmail(); }}>
              <div style={s.field}>
                <label style={s.fieldLabel}>Email address</label>
                <input
                  type="email"
                  autoFocus
                  autoComplete="email"
                  style={{ ...s.input, borderColor: emailError ? colors.red : colors.gray200 }}
                  placeholder="you@yourbusiness.com"
                  value={email}
                  onChange={(e) => { setEmail(e.target.value); setEmailError(false); }}
                />
                {emailError && (
                  <div style={{ color: colors.red, fontSize: 12, fontWeight: 500, marginTop: 8 }}>
                    {emailErrorMsg || 'Please enter a valid email address to continue.'}
                  </div>
                )}
              </div>
              <button
                type="submit"
                style={{
                  ...s.btnPrimary,
                  background: email.trim() && !sending ? colors.blue : colors.gray300,
                  cursor: email.trim() && !sending ? 'pointer' : 'not-allowed',
                }}
                disabled={!email.trim() || sending}
              >
                {sending ? 'Sending…' : `${copy.cta} →`}
              </button>
            </form>
            <div style={{ fontSize: 13, color: colors.gray500, marginTop: 10 }}>
              We'll email you a 6-digit code. No password required.
            </div>

            <div style={s.divider}>
              <div style={s.dividerLine} />
              <span style={s.dividerText}>or</span>
              <div style={s.dividerLine} />
            </div>

            <Link
              to="/shop"
              style={{ ...s.btnSecondary, textDecoration: 'none' }}
            >
              <ShoppingBag size={15} /> Browse products as a guest
            </Link>

            <div style={s.linkText}>
              {copy.switchNote}{' '}
              <Link to={copy.switchTo} style={s.link} onClick={() => setAuthMode(copy.switchMode)}>
                {copy.switchLabel}
              </Link>
            </div>
            {renderDemoSkip()}
          </div>
        </div>
      </div>
    );
  };

  // ==================== PAGE: EMAIL SENT (OTP code entry) ====================
  // One verify path for both intents: otp-verify tells us which it actually
  // was, so `authMode` here only picks the wording.
  const renderEmailSentPage = () => (
    <div style={s.authLayout} className="grid grid-cols-1 md:grid-cols-2">
      {renderAuthLeft(
        'Check your inbox',
        'Enter your 6-digit code.',
        'We just emailed you a one-time code. It expires in 10 minutes.',
        null
      )}
      <div style={s.authRight} className="px-6 py-10 md:px-14 md:py-12">
        <div style={s.authFormWrap}>
          <div style={{ textAlign: 'center' }}>
            <div style={s.emailIcon}>&#9993;</div>
            <div style={s.emailTitle}>
              {authMode === 'signup' ? 'Confirm your email' : 'Enter your login code'}
            </div>
            <div style={s.emailBody}>
              We sent a 6-digit code to <strong style={{ color: colors.gray900 }}>{email}</strong>.<br />
              {authMode === 'signup' ? 'Enter it below to continue.' : 'Enter it below to sign in.'}
            </div>
            <div style={s.field}>
              <input
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                pattern="\d{6}"
                maxLength={6}
                placeholder="123456"
                value={code}
                onChange={(e) => {
                  const digits = e.target.value.replace(/\D/g, '').slice(0, 6);
                  setCode(digits);
                  if (codeError) setCodeError('');
                }}
                onKeyDown={(e) => { if (e.key === 'Enter' && code.length === 6) handleVerify(); }}
                style={{
                  ...s.input,
                  textAlign: 'center',
                  fontSize: 28,
                  letterSpacing: 12,
                  fontWeight: 600,
                  padding: '14px',
                  borderColor: codeError ? colors.red : colors.gray200,
                }}
              />
              {codeError && (
                <div style={{ color: colors.red, fontSize: 12, fontWeight: 500, marginTop: 8 }}>{codeError}</div>
              )}
            </div>
            <button
              style={{
                ...s.btnPrimary,
                marginBottom: 12,
                background: code.length === 6 && !verifying ? colors.blue : colors.gray300,
                cursor: code.length === 6 && !verifying ? 'pointer' : 'not-allowed',
              }}
              disabled={code.length !== 6 || verifying}
              onClick={handleVerify}
            >
              {verifying ? 'Verifying…' : (authMode === 'signup' ? 'Continue →' : 'Sign in →')}
            </button>
            {/* Back to wherever this flow started: the dedicated form for the
                /sign-in + /create-account entries, the landing page otherwise. */}
            <button style={s.btnSecondary} onClick={() => setPage(initialPage)}>
              &larr; Use a different email
            </button>
            <div style={{ ...s.linkText, marginTop: 16 }}>
              Didn't get it?{' '}
              <a style={s.link} onClick={handleResend}>
                {emailResent ? 'Email resent ✓' : 'Resend email'}
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  // ==================== USER TYPE CHOICE (first wizard step) ====================
  const renderTypeChoice = () => {
    const options = [
      {
        value: 'tradepro',
        label: "I'm a Trade Pro",
        body: 'Contractor, installer, designer, or remodeler. Wholesale pricing, project tools, and a dedicated account manager.',
      },
      {
        value: 'homeowner',
        label: "I'm a Homeowner",
        body: 'Working on a project at your own home. We\'ll connect you with a showroom and a real human to help.',
      },
    ];
    return (
      <div style={s.onboardingLayout}>
        <div style={{ width: '100%', maxWidth: 640, textAlign: 'center', marginBottom: 24 }}>
          <div style={{ fontSize: 12, fontWeight: 600, letterSpacing: 1.5, textTransform: 'uppercase', color: colors.red, marginBottom: 8 }}>Welcome</div>
          <div style={{ fontFamily: "'DM Serif Display', 'Georgia', serif", fontSize: 32, color: colors.gray900, lineHeight: 1.15 }}>
            Tell us a bit about yourself.
          </div>
          <div style={{ fontSize: 14, color: colors.gray500, marginTop: 10 }}>
            We'll tailor the rest of signup based on what brings you here.
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4" style={{ width: '100%', maxWidth: 640 }}>
          {options.map(opt => {
            const isActive = userType === opt.value;
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => setUserType(opt.value)}
                style={{
                  textAlign: 'left',
                  padding: '24px',
                  borderRadius: 12,
                  border: `2px solid ${isActive ? colors.blue : colors.gray200}`,
                  background: isActive ? colors.bluePale : colors.white,
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                  transition: 'all 0.15s ease',
                  boxShadow: isActive ? '0 4px 14px rgba(0,48,135,0.15)' : 'none',
                }}
              >
                <div style={{ fontSize: 17, fontWeight: 700, color: colors.gray900, marginBottom: 6 }}>{opt.label}</div>
                <div style={{ fontSize: 13, color: colors.gray500, lineHeight: 1.55 }}>{opt.body}</div>
              </button>
            );
          })}
        </div>

        <div style={{ marginTop: 24, width: '100%', maxWidth: 640 }}>
          <button
            style={{ ...s.btnPrimary, width: '100%' }}
            onClick={() => setPage(userType === 'homeowner' ? 'hoStep1' : 'step1')}
          >
            Continue &rarr;
          </button>
        </div>
      </div>
    );
  };

  // ---------- Reusable chip group for homeowner steps ----------
  const renderChips = (items, value, onChange, multi = false) => (
    <div className="flex flex-wrap gap-2">
      {items.map(item => {
        const v = typeof item === 'string' ? item : item.value;
        const label = typeof item === 'string' ? item : item.label;
        const isActive = multi ? !!value[v] : value === v;
        return (
          <button
            key={v}
            type="button"
            onClick={() => onChange(v)}
            style={{
              padding: '8px 14px',
              borderRadius: 6,
              fontSize: 13,
              fontWeight: isActive ? 600 : 500,
              fontFamily: 'inherit',
              cursor: 'pointer',
              border: `1.5px solid ${isActive ? colors.blue : colors.gray200}`,
              background: isActive ? colors.bluePale : colors.white,
              color: isActive ? colors.blue : colors.gray700,
            }}
          >{label}</button>
        );
      })}
    </div>
  );

  // ---------- Step indicator (homeowner) ----------
  const renderHoStepIndicator = (current) => (
    <div style={{ width: '100%', maxWidth: 600, marginBottom: 32, textAlign: 'center' }}>
      <div style={s.stepIndicator}>
        <div style={s.stepDot(current === 1 ? 'active' : current > 1 ? 'done' : 'pending')}>1</div>
        <div style={s.stepLine(current > 1)} />
        <div style={s.stepDot(current === 2 ? 'active' : current > 2 ? 'done' : 'pending')}>2</div>
        <div style={s.stepLine(current > 2)} />
        <div style={s.stepDot(current === 3 ? 'active' : current > 3 ? 'done' : 'pending')}>3</div>
      </div>
      <div style={{ fontSize: 14, fontWeight: 600, color: colors.gray900, marginBottom: 4 }}>
        {current === 1 ? 'About you' : current === 2 ? 'Your project' : 'How we can help'}
      </div>
      <div style={{ fontSize: 12, color: colors.gray500 }}>Step {current} of 3</div>
    </div>
  );

  // ==================== HOMEOWNER STEP 1: About you ====================
  const renderHomeownerStep1 = () => {
    const ready = firstName.trim() && lastName.trim() && businessStreet.trim() && businessCity.trim() && businessZip.trim();
    return (
      <div style={s.onboardingLayout}>
        {renderHoStepIndicator(1)}

        <div style={s.onboardingCard} className="p-6 md:p-10">
          <div style={s.onboardingCardTitle}>About you</div>
          <div style={s.onboardingCardSub}>We'll use this to set up your account and connect you with the right ProSource showroom.</div>

          <div style={{ ...s.alertInfo, marginBottom: 18, marginTop: 8 }}>
            <span style={{ fontSize: 16, flexShrink: 0, marginTop: 1 }}>&#9993;</span>
            <span>Creating account for <strong>{email}</strong></span>
          </div>

          <div style={s.sectionLabel}>Your name</div>
          <div style={s.fieldRow} className={s.fieldRowClass}>
            <div style={s.field}>
              <label style={s.fieldLabel}>First name *</label>
              <input style={s.input} value={firstName} onChange={(e) => setFirstName(e.target.value)} />
            </div>
            <div style={s.field}>
              <label style={s.fieldLabel}>Last name *</label>
              <input style={s.input} value={lastName} onChange={(e) => setLastName(e.target.value)} />
            </div>
          </div>
          <div style={s.field}>
            <label style={s.fieldLabel}>Phone (optional)</label>
            <input style={s.input} type="tel" placeholder="(314) 555-0000" value={phone} onChange={(e) => setPhone(e.target.value)} />
          </div>

          <div style={{ ...s.sectionLabel, marginTop: 28 }}>Home address</div>
          <div style={s.field}>
            <label style={s.fieldLabel}>Street address *</label>
            <AddressAutocomplete
              style={s.input}
              value={businessStreet}
              onChange={setBusinessStreet}
              onSelect={({ street, city, state, zip }) => {
                setBusinessStreet(street);
                if (city) setBusinessCity(city);
                if (state) setBusinessState(state);
                if (zip) setBusinessZip(zip);
              }}
              placeholder="Start typing your address…"
            />
          </div>
          <div style={s.fieldRow} className={s.fieldRowClass}>
            <div style={s.field}>
              <label style={s.fieldLabel}>City *</label>
              <input style={s.input} value={businessCity} onChange={(e) => setBusinessCity(e.target.value)} />
            </div>
            <div style={s.field}>
              <label style={s.fieldLabel}>State *</label>
              <input style={s.input} value={businessState} onChange={(e) => setBusinessState(e.target.value)} />
            </div>
          </div>
          <div style={s.field}>
            <label style={s.fieldLabel}>Zip *</label>
            <input style={s.input} value={businessZip} onChange={(e) => setBusinessZip(e.target.value)} />
          </div>

          <div style={{ marginTop: 24 }}>
            <button
              style={{
                ...s.btnPrimary, width: '100%',
                background: ready ? colors.blue : colors.gray300,
                cursor: ready ? 'pointer' : 'not-allowed',
              }}
              onClick={ready ? () => { triggerCrmLookup(businessZip); setPage('hoStep2'); } : undefined}
            >
              Continue &rarr;
            </button>
          </div>
        </div>
      </div>
    );
  };

  // ==================== HOMEOWNER STEP 2: Your project ====================
  const renderHomeownerStep2 = () => {
    const projects = ['Kitchen remodel', 'Bathroom remodel', 'Whole-home renovation', 'Flooring only', 'Outdoor / patio', 'Other'];
    const budgets = ['Under $10k', '$10k-$25k', '$25k-$50k', '$50k-$100k', 'Over $100k', 'Not sure yet'];
    const timelines = ['Now (within 1 month)', '1-3 months', '3-6 months', '6+ months', 'Just browsing'];
    const rooms = [
      { value: 'kitchen', label: 'Kitchen' },
      { value: 'bath', label: 'Bathroom' },
      { value: 'living', label: 'Living room' },
      { value: 'bedroom', label: 'Bedroom' },
      { value: 'basement', label: 'Basement' },
      { value: 'outdoor', label: 'Outdoor' },
    ];
    const ready = hoProject;
    return (
      <div style={s.onboardingLayout}>
        {renderHoStepIndicator(2)}

        <div style={s.onboardingCard} className="p-6 md:p-10">
          <div style={s.onboardingCardTitle}>Your project</div>
          <div style={s.onboardingCardSub}>Tell us what you're planning so we can match you with the right products and pricing.</div>

          <div style={{ ...s.sectionLabel, marginTop: 18 }}>What are you working on? *</div>
          {renderChips(projects, hoProject, setHoProject)}

          <div style={{ ...s.sectionLabel, marginTop: 24 }}>Which rooms are involved?</div>
          {renderChips(rooms, hoRooms, toggleHoRoom, true)}

          <div style={{ ...s.sectionLabel, marginTop: 24 }}>Budget range</div>
          {renderChips(budgets, hoBudget, (v) => setHoBudget(hoBudget === v ? '' : v))}

          <div style={{ ...s.sectionLabel, marginTop: 24 }}>Timeline</div>
          {renderChips(timelines, hoTimeline, (v) => setHoTimeline(hoTimeline === v ? '' : v))}

          <div style={{ marginTop: 24, display: 'flex', gap: 12 }}>
            <button
              style={{ ...s.btnSecondary, width: 'auto', padding: '13px 24px' }}
              onClick={() => setPage('hoStep1')}
            >&larr; Back</button>
            <button
              style={{
                ...s.btnPrimary, flex: 1,
                background: ready ? colors.blue : colors.gray300,
                cursor: ready ? 'pointer' : 'not-allowed',
              }}
              onClick={ready ? () => setPage('hoStep3') : undefined}
            >
              Continue &rarr;
            </button>
          </div>
        </div>
      </div>
    );
  };

  // ==================== HOMEOWNER STEP 3: How we can help ====================
  const renderHomeownerStep3 = () => {
    const withOptions = [
      { value: 'designer', label: 'An interior designer' },
      { value: 'contractor', label: 'A contractor / builder' },
      { value: 'diy', label: 'On my own (DIY)' },
    ];
    const hearAboutOptions = ['A friend or family member', 'A contractor or designer', 'Google / web search', 'Social media', 'Drove past a showroom', 'Other'];
    return (
      <div style={s.onboardingLayout}>
        {renderHoStepIndicator(3)}

        <div style={s.onboardingCard} className="p-6 md:p-10">
          <div style={s.onboardingCardTitle}>How we can help</div>
          <div style={s.onboardingCardSub}>A few last questions so we can match you with the right account manager.</div>

          <div style={{ ...s.sectionLabel, marginTop: 18 }}>Who are you working with?</div>
          {renderChips(withOptions, hoWorkingWith, toggleHoWith, true)}

          <div style={{ ...s.sectionLabel, marginTop: 24 }}>How did you hear about ProSource?</div>
          {renderChips(hearAboutOptions, hoHearAbout, (v) => setHoHearAbout(hoHearAbout === v ? '' : v))}

          <div style={{ marginTop: 28 }}>
            <label style={{ ...s.checkboxItem, marginBottom: 10 }}>
              <input type="checkbox" style={s.checkbox} checked={hoOptInTerms} onChange={() => setHoOptInTerms(!hoOptInTerms)} />
              <span style={{ fontSize: 13, color: colors.gray900, fontWeight: 500 }}>
                I agree to ProSource's Terms of Service and Privacy Policy *
              </span>
            </label>
            <label style={s.checkboxItem}>
              <input type="checkbox" style={s.checkbox} checked={hoOptInMarketing} onChange={() => setHoOptInMarketing(!hoOptInMarketing)} />
              <span style={{ fontSize: 13, color: colors.gray700 }}>
                Email me product updates, promotions, and inspiration
              </span>
            </label>
          </div>

          <div style={{
            marginTop: 24, padding: '14px 16px',
            background: colors.greenPale, border: `1px solid rgba(7,84,46,0.15)`,
            borderRadius: 6, fontSize: 13, color: colors.green, lineHeight: 1.6,
          }}>
            A ProSource account manager will reach out shortly to help you plan. No pressure, no obligation.
          </div>

          <div style={{ marginTop: 20, display: 'flex', gap: 12 }}>
            <button
              style={{ ...s.btnSecondary, width: 'auto', padding: '13px 24px' }}
              onClick={() => setPage('hoStep2')}
            >&larr; Back</button>
            <button
              style={{
                ...s.btnPrimary, flex: 1,
                background: hoOptInTerms ? colors.blue : colors.gray300,
                cursor: hoOptInTerms ? 'pointer' : 'not-allowed',
              }}
              onClick={hoOptInTerms ? handleOnboardingComplete : undefined}
            >
              Create My Account
            </button>
          </div>
        </div>
      </div>
    );
  };

  const renderStep1 = () => {
    // Mirrors the "*" markers below. State is a select with a default, so it
    // can't be empty.
    const ready = firstName.trim() && lastName.trim() && phone.trim()
      && businessStreet.trim() && businessCity.trim() && businessZip.trim();
    return (
    <div style={s.onboardingLayout}>
      <div style={{ width: '100%', maxWidth: 600, marginBottom: 32, textAlign: 'center' }}>
        <div style={s.stepIndicator}>
          <div style={s.stepDot('active')}>1</div>
          <div style={s.stepLine(false)} />
          <div style={s.stepDot('pending')}>2</div>
          <div style={s.stepLine(false)} />
          <div style={s.stepDot('pending')}>3</div>
          <div style={s.stepLine(false)} />
          <div style={s.stepDot('pending')}>4</div>
        </div>
        <div style={{ fontSize: 14, fontWeight: 600, color: colors.gray900, marginBottom: 4 }}>About you</div>
        <div style={{ fontSize: 12, color: colors.gray500 }}>Step 1 of 4</div>
      </div>

      <div style={s.onboardingCard} className="p-6 md:p-10">
        <div style={s.onboardingCardTitle}>Let's get to know you</div>
        <div style={s.onboardingCardSub}>We'll use this to set up your account and connect you with the right ProSource showroom.</div>

        <div style={{ ...s.alertInfo, marginBottom: 18, marginTop: 8 }}>
          <span style={{ fontSize: 16, flexShrink: 0, marginTop: 1 }}>&#9993;</span>
          <span>Creating account for <strong>{email}</strong></span>
        </div>

        <div style={s.sectionLabel}>Your name</div>
        <div style={s.fieldRow} className={s.fieldRowClass}>
          <div style={s.field}>
            <label style={s.fieldLabel}>First name *</label>
            <input style={s.input} value={firstName} onChange={(e) => setFirstName(e.target.value)} />
          </div>
          <div style={s.field}>
            <label style={s.fieldLabel}>Last name *</label>
            <input style={s.input} value={lastName} onChange={(e) => setLastName(e.target.value)} />
          </div>
        </div>

        <div style={s.field}>
          <label style={s.fieldLabel}>Cell phone *</label>
          <input style={s.input} type="tel" placeholder="(314) 555-0000" value={phone} onChange={(e) => setPhone(e.target.value)} />
        </div>

        <div style={{ ...s.sectionLabel, marginTop: 28 }}>Business address</div>
        <div style={s.field}>
          <label style={s.fieldLabel}>Street address *</label>
          <input style={s.input} value={businessStreet} onChange={(e) => setBusinessStreet(e.target.value)} />
        </div>
        <div style={s.fieldRow} className={s.fieldRowClass}>
          <div style={s.field}>
            <label style={s.fieldLabel}>City *</label>
            <input style={s.input} value={businessCity} onChange={(e) => setBusinessCity(e.target.value)} />
          </div>
          <div style={s.field}>
            <label style={s.fieldLabel}>State *</label>
            <select style={s.select} value={businessState} onChange={(e) => setBusinessState(e.target.value)}>
              <option>MO</option><option>IL</option><option>NC</option><option>TX</option><option>CA</option><option>FL</option><option>NY</option><option>OH</option>
            </select>
          </div>
        </div>
        <div style={s.fieldRow} className={s.fieldRowClass}>
          <div style={s.field}>
            <label style={s.fieldLabel}>Zip code *</label>
            <input style={s.input} value={businessZip} onChange={(e) => setBusinessZip(e.target.value)} />
          </div>
          <div style={s.field} />
        </div>

        <div style={{ marginTop: 28 }}>
          <button
            style={{
              ...s.btnPrimary,
              background: ready ? colors.blue : colors.gray300,
              cursor: ready ? 'pointer' : 'not-allowed',
            }}
            onClick={ready ? () => { triggerCrmLookup(businessZip); setPage('step2'); } : undefined}
          >
            Continue &rarr;
          </button>
        </div>
      </div>
    </div>
    );
  };

  // ==================== PAGE: STEP 2 (Your Business) ====================
  const renderStep2 = () => {
    const ready = businessName.trim() && tradeType && businessType;
    return (
    <div style={s.onboardingLayout}>
      <div style={{ width: '100%', maxWidth: 600, marginBottom: 32, textAlign: 'center' }}>
        <div style={s.stepIndicator}>
          <div style={s.stepDot('done')}>&#10003;</div>
          <div style={s.stepLine(true)} />
          <div style={s.stepDot('active')}>2</div>
          <div style={s.stepLine(false)} />
          <div style={s.stepDot('pending')}>3</div>
          <div style={s.stepLine(false)} />
          <div style={s.stepDot('pending')}>4</div>
        </div>
        <div style={{ fontSize: 14, fontWeight: 600, color: colors.gray900, marginBottom: 4 }}>Your business</div>
        <div style={{ fontSize: 12, color: colors.gray500 }}>Step 2 of 4</div>
      </div>

      <div style={s.onboardingCard} className="p-6 md:p-10">
        <div style={s.onboardingCardTitle}>Tell us about your business</div>
        <div style={s.onboardingCardSub}>This helps your ProSource team prepare for your first visit and match you with the right resources.</div>

        <div style={s.sectionLabel}>Business details</div>
        <div style={s.field}>
          <label style={s.fieldLabel}>Business / Company name *</label>
          <input style={s.input} value={businessName} onChange={(e) => setBusinessName(e.target.value)} placeholder="e.g. Stafford Builds LLC" />
        </div>
        <div style={s.field}>
          <label style={s.fieldLabel}>Business phone</label>
          <input style={s.input} type="tel" placeholder="(314) 555-0000" value={businessPhone} onChange={(e) => setBusinessPhone(e.target.value)} />
        </div>

        <div style={s.fieldRow} className={s.fieldRowClass}>
          <div style={s.field}>
            <label style={s.fieldLabel}>Business category *</label>
            <select style={s.select} value={tradeType} onChange={(e) => setTradeType(e.target.value)}>
              <option value="">Select one</option>
              <option>General Contractor</option>
              <option>Remodeler</option>
              <option>Home Builder</option>
              <option>Interior Designer</option>
              <option>Flooring Installer</option>
              <option>Property Manager</option>
              <option>Real Estate Developer</option>
              <option>Architect / Engineer</option>
              <option>Other</option>
            </select>
          </div>
          <div style={s.field}>
            <label style={s.fieldLabel}>Business type *</label>
            <select style={s.select} value={businessType} onChange={(e) => setBusinessType(e.target.value)}>
              <option value="">Select one</option>
              <option>Proprietorship</option>
              <option>Partnership</option>
              <option>Corporation</option>
              <option>LLC</option>
              <option>Non-Profit</option>
              <option>Other</option>
            </select>
          </div>
        </div>

        <div style={s.fieldRow} className={s.fieldRowClass}>
          <div style={s.field}>
            <label style={s.fieldLabel}>License number <span style={{ fontWeight: 400, color: colors.gray500 }}>(optional)</span></label>
            <input style={s.input} value={licenseNumber} onChange={(e) => setLicenseNumber(e.target.value)} placeholder="e.g. GC-12345" />
          </div>
          <div style={s.field}>
            <label style={s.fieldLabel}>Website or social <span style={{ fontWeight: 400, color: colors.gray500 }}>(optional)</span></label>
            <input style={s.input} value={website} onChange={(e) => setWebsite(e.target.value)} placeholder="e.g. www.yourcompany.com" />
          </div>
        </div>

        <div style={{ ...s.sectionLabel, marginTop: 28 }}>Scale & spending</div>
        <div style={s.fieldRow} className={s.fieldRowClass}>
          <div style={s.field}>
            <label style={s.fieldLabel}>Number of employees</label>
            <select style={s.select} value={employees} onChange={(e) => setEmployees(e.target.value)}>
              <option>Just me</option>
              <option>2-5</option>
              <option>6-10</option>
              <option>11-50</option>
              <option>50+</option>
            </select>
          </div>
          <div style={s.field}>
            <label style={s.fieldLabel}>Projects per year</label>
            <select style={s.select} value={projects} onChange={(e) => setProjects(e.target.value)}>
              <option>1-5</option>
              <option>5-10</option>
              <option>10-25</option>
              <option>25+</option>
            </select>
          </div>
        </div>

        <div style={s.field}>
          <label style={s.fieldLabel}>Average annual spend on flooring / surfaces</label>
          <select style={s.select} value={spend} onChange={(e) => setSpend(e.target.value)}>
            <option>Less than $20,000</option>
            <option>$20,000-$50,000</option>
            <option>$50,000-$100,000</option>
            <option>$100,000-$250,000</option>
            <option>$250,000-$500,000</option>
            <option>$500,000-$1M</option>
            <option>$1M+</option>
          </select>
        </div>

        <div style={{ marginTop: 28, display: 'flex', gap: 12 }}>
          <button style={{ ...s.btnSecondary, width: 'auto', padding: '13px 24px' }} onClick={() => setPage('step1')}>&larr; Back</button>
          <button
            style={{
              ...s.btnPrimary, flex: 1,
              background: ready ? colors.blue : colors.gray300,
              cursor: ready ? 'pointer' : 'not-allowed',
            }}
            onClick={ready ? () => setPage('step3') : undefined}
          >
            Continue &rarr;
          </button>
        </div>
      </div>
    </div>
    );
  };

  // ==================== PAGE: STEP 3 (How You'll Work With Us) ====================
  const renderStep3 = () => (
    <div style={s.onboardingLayout}>
      <div style={{ width: '100%', maxWidth: 600, marginBottom: 32, textAlign: 'center' }}>
        <div style={s.stepIndicator}>
          <div style={s.stepDot('done')}>&#10003;</div>
          <div style={s.stepLine(true)} />
          <div style={s.stepDot('done')}>&#10003;</div>
          <div style={s.stepLine(true)} />
          <div style={s.stepDot('active')}>3</div>
          <div style={s.stepLine(false)} />
          <div style={s.stepDot('pending')}>4</div>
        </div>
        <div style={{ fontSize: 14, fontWeight: 600, color: colors.gray900, marginBottom: 4 }}>How you'll work with us</div>
        <div style={{ fontSize: 12, color: colors.gray500 }}>Step 3 of 4</div>
      </div>

      <div style={s.onboardingCard} className="p-6 md:p-10">
        <div style={s.onboardingCardTitle}>How you'll work with us</div>
        <div style={s.onboardingCardSub}>Help us personalize your ProSource experience.</div>

        <div style={s.sectionLabel}>Showroom usage</div>
        <div style={{ fontSize: 13, color: colors.gray700, marginBottom: 12, lineHeight: 1.6 }}>
          How do you plan to use the ProSource showroom?
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 20 }}>
          <label style={s.checkboxItem}>
            <input type="radio" name="showroomUsage" style={{ ...s.checkbox, borderRadius: '50%' }} checked={showroomUsage === 'accompany'} onChange={() => setShowroomUsage('accompany')} />
            <span style={s.checkboxLabel}>I will accompany clients in the showroom and quote my own prices</span>
          </label>
          <label style={s.checkboxItem}>
            <input type="radio" name="showroomUsage" style={{ ...s.checkbox, borderRadius: '50%' }} checked={showroomUsage === 'unattended'} onChange={() => setShowroomUsage('unattended')} />
            <span style={s.checkboxLabel}>I will send clients unattended (by appointment only)</span>
          </label>
          <label style={s.checkboxItem}>
            <input type="radio" name="showroomUsage" style={{ ...s.checkbox, borderRadius: '50%' }} checked={showroomUsage === 'both'} onChange={() => setShowroomUsage('both')} />
            <span style={s.checkboxLabel}>Both, depending on the project</span>
          </label>
        </div>

        <div style={{ ...s.sectionLabel, marginTop: 28 }}>Product interests</div>
        <div style={s.field}>
          <label style={s.fieldLabel}>
            What products are you most interested in? <span style={{ fontWeight: 400, color: colors.gray500 }}>(select all that apply)</span>
          </label>
          <div style={s.checkboxGroup}>
            {[
              { key: 'hardwood', label: 'Flooring: Hardwood' },
              { key: 'lvp', label: 'Flooring: LVP / LVT' },
              { key: 'tile', label: 'Flooring: Tile & Stone' },
              { key: 'carpet', label: 'Flooring: Carpet' },
              { key: 'cabinets', label: 'Cabinets' },
              { key: 'countertops', label: 'Countertops' },
              { key: 'install', label: 'Installation Materials' },
            ].map((item) => (
              <label key={item.key} style={s.checkboxItem}>
                <input type="checkbox" style={s.checkbox} checked={interests[item.key]} onChange={() => toggleInterest(item.key)} />
                <span style={s.checkboxLabel}>{item.label}</span>
              </label>
            ))}
          </div>
        </div>

        <div style={s.field}>
          <label style={s.fieldLabel}>Current flooring / surface suppliers <span style={{ fontWeight: 400, color: colors.gray500 }}>(optional)</span></label>
          <input style={s.input} value={currentSuppliers} onChange={(e) => setCurrentSuppliers(e.target.value)} placeholder="e.g. Floor & Decor, local distributor, etc." />
        </div>

        <div style={s.field}>
          <label style={s.fieldLabel}>Upcoming projects <span style={{ fontWeight: 400, color: colors.gray500 }}>(optional)</span></label>
          <textarea
            style={s.textarea}
            rows={3}
            placeholder="Tell us about any upcoming projects so your account manager can prepare..."
            value={upcomingProjects}
            onChange={(e) => setUpcomingProjects(e.target.value)}
          />
        </div>

        <div style={s.fieldRow} className={s.fieldRowClass}>
          <div style={s.field}>
            <label style={s.fieldLabel}>How did you hear about ProSource?</label>
            <select style={s.select} value={hearAbout} onChange={(e) => setHearAbout(e.target.value)}>
              <option value="">Select one</option>
              <option>Referral from another trade pro</option>
              <option>Mailer</option>
              <option>Advertisement</option>
              <option>ProSource website</option>
              <option>Social media</option>
              <option>Email</option>
              <option>Showroom visit / drive-by</option>
              <option>Other</option>
            </select>
          </div>
          <div style={s.field}>
            <label style={s.fieldLabel}>Did anyone help you sign up? <span style={{ fontWeight: 400, color: colors.gray500 }}>(optional)</span></label>
            <input style={s.input} value={helpedBy} onChange={(e) => setHelpedBy(e.target.value)} placeholder="Name of ProSource staff" />
          </div>
        </div>

        <div style={{ marginTop: 28, display: 'flex', gap: 12 }}>
          <button style={{ ...s.btnSecondary, width: 'auto', padding: '13px 24px' }} onClick={() => setPage('step2')}>&larr; Back</button>
          <button style={{ ...s.btnPrimary, flex: 1 }} onClick={() => setPage('step4')}>Continue &rarr;</button>
        </div>
      </div>
    </div>
  );

  // ==================== PAGE: STEP 4 (Review & Agree) ====================
  const renderStep4 = () => (
    <div style={s.onboardingLayout}>
      <div style={{ width: '100%', maxWidth: 600, marginBottom: 32, textAlign: 'center' }}>
        <div style={s.stepIndicator}>
          <div style={s.stepDot('done')}>&#10003;</div>
          <div style={s.stepLine(true)} />
          <div style={s.stepDot('done')}>&#10003;</div>
          <div style={s.stepLine(true)} />
          <div style={s.stepDot('done')}>&#10003;</div>
          <div style={s.stepLine(true)} />
          <div style={s.stepDot('active')}>4</div>
        </div>
        <div style={{ fontSize: 14, fontWeight: 600, color: colors.gray900, marginBottom: 4 }}>Review & agree</div>
        <div style={{ fontSize: 12, color: colors.gray500 }}>Step 4 of 4</div>
      </div>

      <div style={s.onboardingCard} className="p-6 md:p-10">
        <div style={s.onboardingCardTitle}>Terms & Conditions of Membership</div>
        <div style={s.onboardingCardSub}>Please review the membership terms below. You'll need to agree before creating your account.</div>

        <div style={{
          marginTop: 20, padding: '20px 24px',
          background: '#fff', border: `1px solid ${colors.gray200}`, borderRadius: 8,
          fontSize: 13, color: colors.gray700, lineHeight: 1.8, maxHeight: 400, overflowY: 'auto',
        }}>
          <div style={{ fontWeight: 700, fontSize: 14, color: colors.gray900, marginBottom: 12, textTransform: 'uppercase', letterSpacing: 0.5 }}>Membership</div>
          <p style={{ margin: '0 0 10px' }}>1. ProSource Membership is non-transferable. Showroom membership cards may only be used by the individuals to whom they are issued. Member shall be responsible for all persons authorized to use Member's membership card.</p>
          <p style={{ margin: '0 0 10px' }}>2. ProSource Showroom reserves the right to refuse membership to any applicant. Membership may also be refused by ProSource National.</p>
          <p style={{ margin: '0 0 10px' }}>3. The Showroom reserves the right to refuse admission to any employee, agent, or customer of any member. Member agrees to comply with these Terms and Conditions of Membership and such other rules adopted by ProSource National and/or the Showroom from time to time. Membership is revocable by the ProSource Showroom at any time for noncompliance therewith.</p>
          <p style={{ margin: '0 0 10px' }}>4. Member is not permitted to use the "ProSource" mark in any advertisement, website, domain name, facsimile, email, email address or in any other manner whatsoever.</p>
          <p style={{ margin: '0 0 10px' }}>5. Member authorizes ProSource National and the Showroom to send emails to Member regarding promotions, new products, new programs, product or pricing changes, membership changes and any other related information.</p>

          <div style={{ fontWeight: 700, fontSize: 14, color: colors.gray900, marginBottom: 12, marginTop: 20, textTransform: 'uppercase', letterSpacing: 0.5 }}>Membership Fees, Employee Cardholders & Referral Guests</div>
          <p style={{ margin: '0 0 10px' }}>1. Membership Fee per initial 12-month period entitles the member to all the privileges of ProSource Wholesale Showrooms. Membership entitles Member to visit, without any additional fee, any ProSource Wholesale Showroom subject to compliance with each showroom's rules and conditions.</p>
          <p style={{ margin: '0 0 10px' }}>2. If membership card(s) is/are lost or stolen, member must report this as promptly as possible to the showroom.</p>
          <p style={{ margin: '0 0 10px' }}>3. Member cardholders may refer guests to ProSource by using referral appointment cards.</p>
          <p style={{ margin: '0 0 10px' }}>4. ProSource Wholesale Showrooms take no responsibility for any adverse circumstances that may arise as a result of our treatment of referral guests.</p>

          <div style={{ fontWeight: 700, fontSize: 14, color: colors.gray900, marginBottom: 12, marginTop: 20, textTransform: 'uppercase', letterSpacing: 0.5 }}>Renewing Membership</div>
          <p style={{ margin: '0 0 10px' }}>1. Renewal(s) must be completed by the primary business member. Membership needs to be renewed every 12 months. Renewal may require payment of renewal fee.</p>

          <div style={{ fontWeight: 700, fontSize: 14, color: colors.gray900, marginBottom: 12, marginTop: 20, textTransform: 'uppercase', letterSpacing: 0.5 }}>Purchasing Privileges, Guests & Other Rules</div>
          <p style={{ margin: '0 0 10px' }}>1. Each cardholder may bring guests when visiting the Showroom.</p>
          <p style={{ margin: '0 0 10px' }}>2. ProSource Wholesale Showrooms can refuse entry to any person at any time for any reason at its discretion.</p>
          <p style={{ margin: '0 0 10px' }}>3. No samples are to be removed from the showroom at any time without permission.</p>
          <p style={{ margin: '0 0 10px' }}>4. Member will be fully responsible for any damage caused to the Showroom, its furnishings, or its samples, by Member or Member's guests.</p>

          <div style={{ fontWeight: 700, fontSize: 14, color: colors.gray900, marginBottom: 12, marginTop: 20, textTransform: 'uppercase', letterSpacing: 0.5 }}>Ordering, Deposits, Payment & Cancellations</div>
          <p style={{ margin: '0 0 10px' }}>1. Member/cardholder shall make full 100% payment on all cabinet orders. A minimum deposit of 50% of total cost of merchandise or product (other than cabinets) is required upon time of ordering from ProSource.</p>
          <p style={{ margin: '0 0 10px' }}>2. Payment shall be by cash, authorized check, approved bank card, checking account, or ProTrade Credit as listed on cardholder membership application. All checks or credit card payments are subject to bank approval or verification.</p>
          <p style={{ margin: '0 0 10px' }}>3. Member/cardholder shall make full payment of any remaining balance due upon notification of arrival of material.</p>
          <p style={{ margin: '0 0 10px' }}>4. Any order placed for merchandise is not subject to change, cancellation, or return to ProSource. In the event member/cardholder fails to take delivery of goods or make payment when due, merchandise will be returned to manufacturer and a restocking fee of 25% of the total value of the order will be deducted from member's initial deposit.</p>
          <p style={{ margin: '0 0 10px' }}>5. Merchandise must be picked up by member/cardholder immediately upon receipt by ProSource.</p>
          <p style={{ margin: '0 0 10px' }}>6. Member/cardholder assumes full responsibility for installation (if any) performed, measurements, and inspection of merchandise.</p>
          <p style={{ margin: '0 0 10px' }}>7. The member/cardholder agrees that he will abide by and be bound by manufacturer's (and/or distributors, as applicable) policies regarding returns and/or manufacturing defects in material.</p>
          <p style={{ margin: '0 0 10px' }}>8. The member/cardholder may be personally liable for any debt that occurs as a result of his purchase from ProSource or for any check that is dishonored for any reason. If any legal action is brought by ProSource to collect any debt or dishonored check, the member/cardholder agrees to pay interest thereon at the highest rate allowed by law, and reasonable attorney's fees in addition to all other fees, costs and expenses of collection.</p>
          <p style={{ margin: 0 }}>9. The only warranty with respect to the merchandise sold by ProSource is that of the merchandise's manufacturer(s) and/or distributor(s), as applicable, if any.</p>
        </div>

        <div style={{ marginTop: 24 }}>
          <label style={{ ...s.checkboxItem, marginBottom: 10 }}>
            <input type="checkbox" style={s.checkbox} checked={optInTerms} onChange={() => setOptInTerms(!optInTerms)} />
            <span style={{ fontSize: 13, color: colors.gray900, fontWeight: 500 }}>I have read and agree to the Terms & Conditions of Membership *</span>
          </label>
          <label style={{ ...s.checkboxItem, marginBottom: 10 }}>
            <input type="checkbox" style={s.checkbox} checked={optInUpdates} onChange={() => setOptInUpdates(!optInUpdates)} />
            <span style={{ fontSize: 13, color: colors.gray700 }}>I agree to receive product updates and promotions from ProSource</span>
          </label>
          <label style={s.checkboxItem}>
            <input type="checkbox" style={s.checkbox} checked={optInConsent} onChange={() => setOptInConsent(!optInConsent)} />
            <span style={{ fontSize: 13, color: colors.gray700 }}>I consent to ProSource storing and processing the information provided</span>
          </label>
        </div>

        <div style={{
          marginTop: 24, padding: '14px 16px',
          background: colors.greenPale, border: `1px solid rgba(7,84,46,0.15)`,
          borderRadius: 6, fontSize: 13, color: colors.green, lineHeight: 1.6,
        }}>
          Your account manager will help you finalize your membership at your first showroom visit. This typically takes just a few minutes.
        </div>

        <div style={{ marginTop: 20, display: 'flex', gap: 12 }}>
          <button style={{ ...s.btnSecondary, width: 'auto', padding: '13px 24px' }} onClick={() => setPage('step3')}>&larr; Back</button>
          <button style={{
            ...s.btnPrimary, flex: 1,
            background: optInTerms ? colors.blue : colors.gray300,
            cursor: optInTerms ? 'pointer' : 'not-allowed',
          }} onClick={optInTerms ? handleOnboardingComplete : undefined}>
            Create My Account
          </button>
        </div>
      </div>
    </div>
  );

  // ==================== RENDER ====================
  return (
    <div style={{ fontFamily: "'DM Sans', sans-serif", background: colors.gray50, minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600&family=DM+Serif+Display&display=swap" rel="stylesheet" />
      {renderNav()}
      {page === 'email' && renderEmailPage()}
      {page === 'auth' && renderAuthPage()}
      {page === 'email-sent' && renderEmailSentPage()}
      {page === 'step1' && renderStep1()}
      {page === 'step2' && renderStep2()}
      {page === 'step3' && renderStep3()}
      {page === 'step4' && renderStep4()}
      {page === 'hoStep1' && renderHomeownerStep1()}
      {page === 'hoStep2' && renderHomeownerStep2()}
      {page === 'hoStep3' && renderHomeownerStep3()}
      {page === 'typeChoice' && renderTypeChoice()}
    </div>
  );
};

export default ProSourceLogin;
