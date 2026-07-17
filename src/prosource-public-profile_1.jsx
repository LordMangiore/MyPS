import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useAuth } from './auth-context';
import ConsultationWizard from './prosource-consultation-wizard';
import {
  findPro,
  proFullName,
  ratingOf,
  reviewCountOf,
  reviewBreakdownOf,
  reviewTagsOf,
  reviewsForTag,
} from './pro-directory';
import {
  Star,
  MapPin,
  Phone,
  Mail,
  MessageCircle,
  Calendar,
  Clock,
  CheckCircle,
  Shield,
  Award,
  Briefcase,
  Users,
  ChevronRight,
  ChevronDown,
  Share2,
  Heart,
  Image,
  X,
  ThumbsUp,
  Pencil,
  Save,
  Globe,
  Lock,
  Plus,
  Trash2,
  ArrowLeft
} from 'lucide-react';

const ProSourcePublicProfile = () => {
  const { profile, saveProfile: persistProfile, userId, showrooms } = useAuth();
  /**
   * Whose profile this is, and it is now answered by the URL rather than by a
   * flag on it.
   *
   * /profile/:proId is a pro out of the directory: somebody else, read only.
   * /profile with no id is your own, editable, read from your own account.
   *
   * This used to be one page for both, switched by `?own=1`, and the switch
   * changed two buttons and nothing else. Both readings rendered the SAME state,
   * which was seeded from the signed-in account and back-filled with one
   * hardcoded pro's defaults, so "look at a pro" showed you your own name and
   * business over that pro's bio, address, reviews and phone number. There was
   * no arrangement of flags that fixed it, because there was only ever one
   * person's worth of state. Two sources, two routes.
   *
   * `?own=1` is still accepted and ignored: every My Profile link in the app
   * carries it, and they all still mean the same thing they meant, which is
   * this route without an id.
   */
  const { proId } = useParams();
  const directoryPro = proId ? findPro(proId) : null;
  const isOwnProfile = !proId;
  // A URL naming a pro who is not in the directory. Not the same as your own
  // profile and not an empty one: it is a page about somebody who does not
  // exist, and the only honest thing to render is that.
  const proNotFound = !!proId && !directoryPro;

  // Demo-only favorited-pros store, keyed per pro so saving one does not save
  // them all. Your own profile is not something you save.
  const PRO_SLUG = proId || 'me';
  const [proSaved, setProSaved] = useState(() => {
    try {
      const raw = localStorage.getItem('prosource_saved_pros');
      const list = raw ? JSON.parse(raw) : [];
      return Array.isArray(list) && list.includes(PRO_SLUG);
    } catch { return false; }
  });
  const toggleProSaved = () => {
    try {
      const raw = localStorage.getItem('prosource_saved_pros');
      const list = raw ? JSON.parse(raw) : [];
      const next = proSaved
        ? list.filter((s) => s !== PRO_SLUG)
        : [...new Set([...list, PRO_SLUG])];
      localStorage.setItem('prosource_saved_pros', JSON.stringify(next));
      setProSaved(!proSaved);
    } catch {}
  };
  const [showAllPhotos, setShowAllPhotos] = useState(false);
  const [reviewFilter, setReviewFilter] = useState('all');
  const [consultOpen, setConsultOpen] = useState(false);
  const [openCredential, setOpenCredential] = useState(null);

  // Where "(N reviews)" scrolls to.
  const reviewsRef = useRef(null);
  const scrollToReviews = () =>
    reviewsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });

  /**
   * Copy a link to whoever is being shown.
   *
   * `window.location.href` deliberately, rather than a link built from PRO_SLUG:
   * on your own profile the honest answer is the page you are on, and on a pro's
   * it is already their canonical URL now that they have one. Before there were
   * per-pro routes there was no link worth copying, which is presumably why this
   * button never did anything.
   */
  const [shareLabel, setShareLabel] = useState('Share');
  const shareTimer = useRef(null);
  const copyProfileLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setShareLabel('Link copied');
    } catch {
      // Clipboard can be refused (permissions, insecure origin). Say so rather
      // than flash a success and leave nothing on the clipboard.
      setShareLabel('Press Ctrl+C');
    }
    clearTimeout(shareTimer.current);
    shareTimer.current = setTimeout(() => setShareLabel('Share'), 2500);
  };
  useEffect(() => () => clearTimeout(shareTimer.current), []);

  /**
   * The word in front of the score. It used to be the literal "Exceptional",
   * which was true of the one hardcoded 5.0 and would be a lie over a 3.8.
   */
  const ratingLabel = (rating) => {
    if (rating >= 4.8) return 'Exceptional';
    if (rating >= 4.4) return 'Great';
    if (rating >= 3.5) return 'Good';
    return 'Rated';
  };

  // Edit mode
  const [isEditing, setIsEditing] = useState(false);
  const [snapshot, setSnapshot] = useState(null);
  const [savingProfile, setSavingProfile] = useState(false);

  /**
   * What the fields below start as.
   *
   * A pro's page is the pro's, whole: their name, their bio, their address,
   * their phone. Your page is yours, and where you have not filled something in
   * it starts EMPTY rather than borrowing from a pro. That emptiness is the fix.
   * These defaults used to be Mae Reedy's, so an account with no bio published
   * hers under its own name, an account with no address published her street,
   * and both looked authored rather than blank.
   */
  const p = profile || {};
  const ba = p.businessAddress || p.address || {};
  const init = directoryPro
    ? {
        firstName: directoryPro.firstName,
        lastName: directoryPro.lastName,
        company: directoryPro.company,
        bio: directoryPro.bio,
        specialties: directoryPro.specialties,
        phone: directoryPro.phone,
        businessPhone: '',
        location: directoryPro.location,
        street: directoryPro.address.street,
        city: directoryPro.address.city,
        state: directoryPro.address.state,
        zip: directoryPro.address.zip,
        certifications: directoryPro.certifications,
      }
    : {
        firstName: p.firstName || '',
        lastName: p.lastName || '',
        company: p.business?.name || '',
        bio: p.bio || '',
        specialties: p.specialties || [],
        phone: p.phone || '',
        businessPhone: p.business?.phone || '',
        location: p.location || (ba.city && ba.state ? `${ba.city}, ${ba.state}` : ''),
        street: ba.street || '',
        city: ba.city || '',
        state: ba.state || '',
        zip: ba.zip || '',
        certifications: p.certifications || [],
      };

  const [firstName, setFirstName] = useState(init.firstName);
  const [lastName, setLastName] = useState(init.lastName);
  const [companyName, setCompanyName] = useState(init.company);
  const [bio, setBio] = useState(init.bio);
  const [specialties, setSpecialties] = useState(init.specialties);
  const [newSpecialty, setNewSpecialty] = useState('');
  const [primaryPhone, setPrimaryPhone] = useState(init.phone);
  const [businessPhone, setBusinessPhone] = useState(init.businessPhone);
  const [location, setLocation] = useState(init.location);
  const [streetAddress, setStreetAddress] = useState(init.street);
  const [city, setCity] = useState(init.city);
  const [stateName, setStateName] = useState(init.state);
  const [zip, setZip] = useState(init.zip);
  const [profileVisibility, setProfileVisibility] = useState(p.profileVisibility || 'public');
  const [certifications, setCertifications] = useState(init.certifications);
  const [portfolioPhotos, setPortfolioPhotos] = useState(
    directoryPro
      ? Array.from({ length: directoryPro.photoCount }, (_, i) => i + 1)
      : p.portfolioPhotos || []
  );

  // When the profile blob loads after mount, refresh fields if the user is
  // still on defaults. Don't clobber unsaved edits.
  //
  // Never on a pro's page. The blob is the SIGNED-IN account's, and letting it
  // land here would rewrite the pro you are reading with your own name a beat
  // after it rendered: exactly the bug the two routes exist to remove.
  useEffect(() => {
    if (directoryPro || !profile || isEditing) return;
    if (profile.firstName) setFirstName(profile.firstName);
    if (profile.lastName) setLastName(profile.lastName);
    if (profile.business?.name) setCompanyName(profile.business.name);
    if (profile.bio) setBio(profile.bio);
    if (profile.specialties) setSpecialties(profile.specialties);
    if (profile.phone) setPrimaryPhone(profile.phone);
    if (profile.business?.phone) setBusinessPhone(profile.business.phone);
    const addr = profile.businessAddress || profile.address;
    if (addr) {
      if (addr.street) setStreetAddress(addr.street);
      if (addr.city) setCity(addr.city);
      if (addr.state) setStateName(addr.state);
      if (addr.zip) setZip(addr.zip);
      if (addr.city && addr.state) setLocation(`${addr.city}, ${addr.state}`);
    }
    if (profile.profileVisibility) setProfileVisibility(profile.profileVisibility);
    if (profile.certifications) setCertifications(profile.certifications);
    if (profile.portfolioPhotos) setPortfolioPhotos(profile.portfolioPhotos);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile]);

  const colors = {
    red: '#BA0C2F',
    darkBlue: '#003087',
    lightBlue: '#6CACE4',
    green: '#07542E',
    gold: '#f59e0b',
    gray100: '#f5f5f5',
    gray200: '#e5e5e5',
    gray300: '#d4d4d4',
    gray400: '#a3a3a3',
    gray500: '#737373',
    gray600: '#525252',
    gray700: '#404040',
    gray900: '#171717',
  };

  const styles = {
    wrapper: {
      background: '#fafafa',
      minHeight: '100vh',
      fontFamily: "'Open Sans', -apple-system, BlinkMacSystemFont, sans-serif",
    },
    container: {
      maxWidth: 1140,
      margin: '0 auto',
      padding: '0 24px',
    },
    backLink: {
      display: 'inline-flex',
      alignItems: 'center',
      gap: 8,
      color: colors.darkBlue,
      fontSize: 14,
      fontWeight: 500,
      textDecoration: 'none',
      padding: '16px 24px',
    },
    // Hero Section
    hero: {
      background: '#fff',
      borderBottom: `1px solid ${colors.gray200}`,
    },
    coverPhoto: {
      height: 200,
      background: `linear-gradient(135deg, ${colors.darkBlue} 0%, ${colors.lightBlue} 100%)`,
      position: 'relative',
    },
    heroContent: {
      display: 'flex',
      gap: 24,
      padding: '0 24px 24px',
      marginTop: -60,
      position: 'relative',
    },
    profilePhoto: {
      width: 140,
      height: 140,
      borderRadius: 12,
      border: '4px solid #fff',
      background: colors.gray200,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontSize: 48,
      fontWeight: 600,
      color: colors.gray500,
      boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
      flexShrink: 0,
      position: 'relative',
      overflow: 'hidden',
    },
    heroInfo: {
      flex: 1,
      paddingTop: 70,
    },
    badges: {
      display: 'flex',
      gap: 8,
      marginBottom: 8,
    },
    badge: {
      display: 'inline-flex',
      alignItems: 'center',
      gap: 4,
      padding: '4px 10px',
      borderRadius: 4,
      fontSize: 11,
      fontWeight: 600,
      textTransform: 'uppercase',
    },
    verifiedBadge: {
      background: '#dbeafe',
      color: colors.darkBlue,
    },
    topProBadge: {
      background: '#fef3c7',
      color: '#92400e',
    },
    proName: {
      fontSize: 32,
      fontWeight: 700,
      color: colors.gray900,
      marginBottom: 4,
    },
    companyName: {
      fontSize: 18,
      color: colors.gray600,
      marginBottom: 12,
    },
    ratingRow: {
      display: 'flex',
      alignItems: 'center',
      gap: 12,
      marginBottom: 12,
    },
    ratingScore: {
      fontSize: 18,
      fontWeight: 700,
      color: colors.gray900,
    },
    stars: {
      display: 'flex',
      gap: 2,
    },
    reviewCount: {
      fontSize: 14,
      color: colors.darkBlue,
      fontWeight: 500,
      cursor: 'pointer',
    },
    locationRow: {
      display: 'flex',
      alignItems: 'center',
      gap: 6,
      fontSize: 14,
      color: colors.gray500,
    },
    heroActions: {
      display: 'flex',
      gap: 8,
      paddingTop: 70,
      alignItems: 'flex-start',
      alignSelf: 'flex-start',
    },
    shareBtn: {
      padding: '8px 12px',
      background: '#fff',
      border: `1px solid ${colors.gray300}`,
      borderRadius: 6,
      cursor: 'pointer',
      display: 'inline-flex',
      alignItems: 'center',
      gap: 4,
      fontSize: 13,
      color: colors.gray600,
      height: 'fit-content',
    },
    saveBtn: {
      padding: '8px 12px',
      background: '#fff',
      border: `1px solid ${colors.gray300}`,
      borderRadius: 6,
      cursor: 'pointer',
      display: 'inline-flex',
      alignItems: 'center',
      gap: 4,
      fontSize: 13,
      color: colors.gray600,
      height: 'fit-content',
    },
    // Main Layout
    mainLayout: {
      padding: '24px 0 48px',
    },
    mainContent: {
      display: 'flex',
      flexDirection: 'column',
      gap: 24,
    },
    // Cards
    card: {
      background: '#fff',
      borderRadius: 12,
      border: `1px solid ${colors.gray200}`,
      overflow: 'hidden',
    },
    cardHeader: {
      padding: '20px 24px',
      borderBottom: `1px solid ${colors.gray100}`,
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    cardTitle: {
      fontSize: 18,
      fontWeight: 600,
      color: colors.gray900,
      margin: 0,
    },
    cardBody: {
      padding: 24,
    },
    // Overview Stats
    overviewGrid: {
      display: 'grid',
      gridTemplateColumns: 'repeat(2, 1fr)',
      gap: 16,
    },
    overviewItem: {
      display: 'flex',
      alignItems: 'center',
      gap: 12,
    },
    overviewIcon: {
      width: 40,
      height: 40,
      borderRadius: 8,
      background: colors.gray100,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      color: colors.darkBlue,
    },
    overviewLabel: {
      fontSize: 13,
      color: colors.gray500,
    },
    overviewValue: {
      fontSize: 14,
      fontWeight: 600,
      color: colors.gray900,
    },
    // About
    aboutText: {
      fontSize: 14,
      lineHeight: 1.7,
      color: colors.gray700,
    },
    readMore: {
      color: colors.darkBlue,
      fontWeight: 500,
      background: 'none',
      border: 'none',
      cursor: 'pointer',
      fontSize: 14,
      marginTop: 8,
      padding: 0,
    },
    // Specialties
    chipContainer: {
      display: 'flex',
      flexWrap: 'wrap',
      gap: 8,
      alignItems: 'center',
    },
    chip: {
      padding: '8px 16px',
      background: colors.gray100,
      borderRadius: 20,
      fontSize: 13,
      color: colors.gray700,
      border: `1px solid ${colors.gray200}`,
    },
    // Gallery
    gallery: {
      display: 'grid',
      gridTemplateColumns: 'repeat(3, 1fr)',
      gap: 8,
    },
    galleryItem: {
      aspectRatio: '1',
      borderRadius: 8,
      background: colors.gray200,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      cursor: 'pointer',
      overflow: 'hidden',
      position: 'relative',
    },
    galleryOverlay: {
      position: 'absolute',
      inset: 0,
      background: 'rgba(0,0,0,0.5)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      color: '#fff',
      fontSize: 14,
      fontWeight: 600,
    },
    seeAllBtn: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 4,
      padding: '12px',
      background: 'none',
      border: 'none',
      color: colors.darkBlue,
      fontSize: 14,
      fontWeight: 500,
      cursor: 'pointer',
      width: '100%',
      borderTop: `1px solid ${colors.gray100}`,
    },
    // Reviews
    reviewSummary: {
      display: 'flex',
      gap: 32,
      marginBottom: 24,
      paddingBottom: 24,
      borderBottom: `1px solid ${colors.gray100}`,
    },
    reviewScoreBox: {
      textAlign: 'center',
    },
    reviewScoreBig: {
      fontSize: 48,
      fontWeight: 700,
      color: colors.gray900,
      lineHeight: 1,
    },
    reviewScoreLabel: {
      fontSize: 14,
      color: colors.gray500,
      marginTop: 4,
    },
    reviewBars: {
      flex: 1,
    },
    reviewBarRow: {
      display: 'flex',
      alignItems: 'center',
      gap: 8,
      marginBottom: 6,
    },
    reviewBarLabel: {
      width: 16,
      fontSize: 13,
      color: colors.gray500,
    },
    reviewBarTrack: {
      flex: 1,
      height: 8,
      background: colors.gray200,
      borderRadius: 4,
      overflow: 'hidden',
    },
    reviewBarFill: (percent) => ({
      width: `${percent}%`,
      height: '100%',
      background: colors.darkBlue,
      borderRadius: 4,
    }),
    reviewBarPercent: {
      width: 36,
      fontSize: 13,
      color: colors.gray500,
      textAlign: 'right',
    },
    reviewHighlights: {
      fontSize: 14,
      color: colors.gray600,
      marginBottom: 16,
    },
    highlightBold: {
      fontWeight: 600,
      color: colors.gray900,
    },
    reviewFilters: {
      display: 'flex',
      flexWrap: 'wrap',
      gap: 8,
      marginBottom: 24,
    },
    filterChip: (isActive) => ({
      padding: '6px 12px',
      borderRadius: 16,
      fontSize: 12,
      fontWeight: 500,
      border: `1px solid ${isActive ? colors.darkBlue : colors.gray300}`,
      background: isActive ? '#e0e7ff' : '#fff',
      color: isActive ? colors.darkBlue : colors.gray600,
      cursor: 'pointer',
    }),
    reviewCard: {
      padding: '20px 0',
      borderBottom: `1px solid ${colors.gray100}`,
    },
    reviewHeader: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      marginBottom: 12,
    },
    reviewerInfo: {
      display: 'flex',
      alignItems: 'center',
      gap: 12,
    },
    reviewerAvatar: {
      width: 40,
      height: 40,
      borderRadius: '50%',
      background: colors.gray200,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontSize: 14,
      fontWeight: 600,
      color: colors.gray500,
    },
    reviewerName: {
      fontSize: 14,
      fontWeight: 600,
      color: colors.gray900,
    },
    reviewerMeta: {
      fontSize: 12,
      color: colors.gray500,
    },
    reviewDate: {
      fontSize: 12,
      color: colors.gray500,
    },
    reviewText: {
      fontSize: 14,
      lineHeight: 1.6,
      color: colors.gray700,
      marginBottom: 12,
    },
    reviewDetails: {
      fontSize: 12,
      color: colors.gray500,
      marginBottom: 12,
    },
    reviewPhotos: {
      display: 'flex',
      gap: 8,
    },
    reviewPhoto: {
      width: 80,
      height: 80,
      borderRadius: 6,
      background: colors.gray200,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
    },
    reviewHelpful: {
      display: 'flex',
      alignItems: 'center',
      gap: 6,
      marginTop: 12,
      fontSize: 13,
      color: colors.gray500,
    },
    helpfulBtn: {
      display: 'flex',
      alignItems: 'center',
      gap: 4,
      padding: '4px 8px',
      background: 'none',
      border: `1px solid ${colors.gray300}`,
      borderRadius: 4,
      fontSize: 12,
      color: colors.gray600,
      cursor: 'pointer',
    },
    // Sidebar
    sidebar: {
      display: 'flex',
      flexDirection: 'column',
      gap: 24,
    },
    stickyBox: {
      position: 'sticky',
      top: 24,
      display: 'flex',
      flexDirection: 'column',
      gap: 24,
    },
    ctaCard: {
      background: '#fff',
      borderRadius: 12,
      border: `1px solid ${colors.gray200}`,
      padding: 24,
    },
    ctaTitle: {
      fontSize: 18,
      fontWeight: 600,
      color: colors.gray900,
      marginBottom: 4,
    },
    ctaSubtitle: {
      fontSize: 13,
      color: colors.gray500,
      marginBottom: 20,
    },
    formGroup: {
      marginBottom: 16,
    },
    formLabel: {
      display: 'block',
      fontSize: 13,
      fontWeight: 500,
      color: colors.gray700,
      marginBottom: 6,
    },
    formInput: {
      width: '100%',
      padding: '10px 12px',
      border: `1px solid ${colors.gray300}`,
      borderRadius: 6,
      fontSize: 14,
      outline: 'none',
      boxSizing: 'border-box',
    },
    formSelect: {
      width: '100%',
      padding: '10px 12px',
      border: `1px solid ${colors.gray300}`,
      borderRadius: 6,
      fontSize: 14,
      background: '#fff',
      cursor: 'pointer',
      boxSizing: 'border-box',
    },
    btnPrimary: {
      width: '100%',
      padding: '14px 24px',
      background: colors.darkBlue,
      color: '#fff',
      border: 'none',
      borderRadius: 6,
      fontSize: 14,
      fontWeight: 600,
      cursor: 'pointer',
      marginBottom: 12,
    },
    btnOutline: {
      width: '100%',
      padding: '12px 24px',
      background: '#fff',
      color: colors.darkBlue,
      border: `1px solid ${colors.darkBlue}`,
      borderRadius: 6,
      fontSize: 14,
      fontWeight: 500,
      cursor: 'pointer',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
    },
    onlineStatus: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      fontSize: 13,
      color: colors.green,
      marginTop: 12,
    },
    onlineDot: {
      width: 8,
      height: 8,
      borderRadius: '50%',
      background: colors.green,
    },
    showroomCard: {
      background: '#fff',
      borderRadius: 12,
      border: `1px solid ${colors.gray200}`,
      padding: 20,
    },
    showroomTitle: {
      fontSize: 14,
      fontWeight: 600,
      color: colors.gray900,
      marginBottom: 4,
    },
    showroomName: {
      fontSize: 13,
      color: colors.darkBlue,
      fontWeight: 500,
      marginBottom: 12,
    },
    showroomContact: {
      display: 'flex',
      alignItems: 'center',
      gap: 8,
      marginBottom: 8,
    },
    showroomContactIcon: {
      color: colors.gray400,
    },
    showroomContactText: {
      fontSize: 13,
      color: colors.gray600,
    },
    showroomMap: {
      height: 120,
      borderRadius: 8,
      background: colors.gray200,
      marginTop: 12,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontSize: 12,
      color: colors.gray500,
    },
    credentialsCard: {
      background: '#fff',
      borderRadius: 12,
      border: `1px solid ${colors.gray200}`,
      padding: 20,
    },
    credentialItem: {
      display: 'flex',
      alignItems: 'center',
      gap: 10,
      padding: '10px 0',
      borderBottom: `1px solid ${colors.gray100}`,
    },
    credentialIcon: {
      color: colors.green,
    },
    credentialText: {
      fontSize: 13,
      color: colors.gray700,
    },
    viewCredentials: {
      color: colors.darkBlue,
      fontSize: 13,
      fontWeight: 500,
      background: 'none',
      border: 'none',
      cursor: 'pointer',
      padding: 0,
      marginTop: 12,
    },
    // Edit mode styles
    editToggleBtn: {
      padding: '8px 16px',
      background: colors.darkBlue,
      color: '#fff',
      border: 'none',
      borderRadius: 6,
      cursor: 'pointer',
      display: 'inline-flex',
      alignItems: 'center',
      gap: 6,
      fontSize: 13,
      fontWeight: 600,
      height: 'fit-content',
    },
    editActionBar: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: '12px 24px',
      background: '#fffbeb',
      borderBottom: '1px solid #fde68a',
    },
    editActionBarText: {
      fontSize: 14,
      fontWeight: 500,
      color: '#92400e',
    },
    saveCancelRow: {
      display: 'flex',
      gap: 8,
    },
    cancelBtn: {
      padding: '8px 16px',
      background: '#fff',
      border: `1px solid ${colors.gray300}`,
      borderRadius: 6,
      cursor: 'pointer',
      fontSize: 13,
      fontWeight: 500,
      color: colors.gray600,
    },
    saveProfileBtn: {
      padding: '8px 16px',
      background: colors.darkBlue,
      color: '#fff',
      border: 'none',
      borderRadius: 6,
      cursor: 'pointer',
      fontSize: 13,
      fontWeight: 600,
      display: 'inline-flex',
      alignItems: 'center',
      gap: 6,
    },
    inlineInput: {
      padding: '8px 12px',
      border: `1px solid ${colors.gray300}`,
      borderRadius: 6,
      fontSize: 14,
      fontFamily: 'inherit',
      width: '100%',
      boxSizing: 'border-box',
      outline: 'none',
    },
    inlineTextarea: {
      padding: '8px 12px',
      border: `1px solid ${colors.gray300}`,
      borderRadius: 6,
      fontSize: 14,
      fontFamily: 'inherit',
      width: '100%',
      boxSizing: 'border-box',
      minHeight: 120,
      resize: 'vertical',
      lineHeight: 1.7,
      outline: 'none',
    },
    editableChip: {
      padding: '8px 12px 8px 16px',
      background: colors.gray100,
      borderRadius: 20,
      fontSize: 13,
      color: colors.gray700,
      border: `1px solid ${colors.gray200}`,
      display: 'inline-flex',
      alignItems: 'center',
      gap: 6,
    },
    chipRemoveBtn: {
      background: 'none',
      border: 'none',
      cursor: 'pointer',
      color: colors.gray500,
      padding: 0,
      lineHeight: 1,
      display: 'flex',
      alignItems: 'center',
    },
    addChipBtn: {
      padding: '8px 16px',
      background: 'transparent',
      border: `1px dashed ${colors.gray300}`,
      borderRadius: 20,
      fontSize: 13,
      color: colors.gray500,
      cursor: 'pointer',
      display: 'inline-flex',
      alignItems: 'center',
      gap: 4,
    },
    visibilityBar: {
      display: 'flex',
      gap: 8,
      alignItems: 'center',
    },
    visibilityLabel: {
      fontSize: 12,
      color: colors.gray500,
      marginRight: 4,
    },
    certItem: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: '12px 16px',
      background: colors.gray100,
      borderRadius: 8,
      marginBottom: 8,
    },
    certFields: {
      display: 'flex',
      gap: 8,
      marginTop: 6,
    },
    galleryRemoveBtn: {
      position: 'absolute',
      top: 6,
      right: 6,
      width: 24,
      height: 24,
      borderRadius: '50%',
      background: 'rgba(0,0,0,0.6)',
      border: 'none',
      color: '#fff',
      cursor: 'pointer',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 0,
    },
    editFormLabel: {
      display: 'block',
      fontSize: 12,
      fontWeight: 600,
      color: colors.gray500,
      textTransform: 'uppercase',
      letterSpacing: '0.5px',
      marginBottom: 6,
    },
  };

  /**
   * The reputation half of the page: stats, reviews, rating, chips.
   *
   * Sourced from the directory pro being viewed, and on your own profile from
   * the demo's sample pro, which is what your own profile has always shown.
   * The reviews are filler and are meant to be: they exist to show what a
   * populated profile looks like. What is no longer filler is the arithmetic
   * around them. Rating, review count, star breakdown and chip counts are all
   * derived from the review list itself (see src/pro-directory.js), so the
   * headline cannot claim thirty over a list of six, and a chip cannot offer
   * eleven and deliver one. That derivation is what makes the chips safe to
   * wire up.
   */
  const shownPro = directoryPro || findPro('mae-reedy');
  const pro = {
    memberSince: shownPro.memberSince,
    rating: ratingOf(shownPro),
    reviewCount: reviewCountOf(shownPro),
    stats: shownPro.stats,
    reviews: shownPro.reviews,
  };

  const reviewBreakdown = reviewBreakdownOf(shownPro);
  const filterTags = reviewTagsOf(shownPro);
  // The chips actually filter now. `reviewFilter` used to be set by them and
  // read by nothing.
  const visibleReviews = reviewsForTag(shownPro, reviewFilter);
  const visiblePhotos =
    isEditing || showAllPhotos ? portfolioPhotos : portfolioPhotos.slice(0, 6);

  // Derived from the names on screen rather than stored, so it cannot disagree
  // with the heading right beside it while someone is typing into either field.
  const shownInitials =
    `${(firstName[0] || '').toUpperCase()}${(lastName[0] || '').replace('.', '').toUpperCase()}` || '?';

  /**
   * The showroom on the sidebar: the pro's when you are reading a pro, and your
   * account's own when you are reading yourself. Null when there is neither,
   * which is a real state for a signed-out visitor, and the card is dropped
   * rather than filled with somebody else's address.
   */
  const shownShowroom = useMemo(() => {
    if (directoryPro) return directoryPro.showroom;
    const mine = (showrooms || [])[0];
    return mine ? { name: mine.name, address: mine.address, phone: mine.phone } : null;
  }, [directoryPro, showrooms]);


  const renderStars = (rating, size = 16) => {
    return (
      <div style={styles.stars}>
        {[1, 2, 3, 4, 5].map((star) => (
          <Star
            key={star}
            size={size}
            fill={star <= rating ? colors.gold : 'transparent'}
            color={star <= rating ? colors.gold : colors.gray300}
          />
        ))}
      </div>
    );
  };

  // Edit mode helpers
  const enterEditMode = () => {
    setSnapshot({
      firstName, lastName, companyName, bio,
      specialties: [...specialties],
      primaryPhone, businessPhone, location,
      streetAddress, city, stateName, zip,
      profileVisibility,
      certifications: certifications.map(c => ({ ...c })),
      portfolioPhotos: [...portfolioPhotos],
    });
    setIsEditing(true);
  };

  const cancelEdit = () => {
    if (snapshot) {
      setFirstName(snapshot.firstName);
      setLastName(snapshot.lastName);
      setCompanyName(snapshot.companyName);
      setBio(snapshot.bio);
      setSpecialties(snapshot.specialties);
      setPrimaryPhone(snapshot.primaryPhone);
      setBusinessPhone(snapshot.businessPhone);
      setLocation(snapshot.location);
      setStreetAddress(snapshot.streetAddress);
      setCity(snapshot.city);
      setStateName(snapshot.stateName);
      setZip(snapshot.zip);
      setProfileVisibility(snapshot.profileVisibility);
      setCertifications(snapshot.certifications);
      setPortfolioPhotos(snapshot.portfolioPhotos);
    }
    setSnapshot(null);
    setIsEditing(false);
  };

  const saveProfile = async () => {
    setSavingProfile(true);
    try {
      await persistProfile({
        firstName,
        lastName,
        bio,
        specialties,
        phone: primaryPhone,
        location,
        profileVisibility,
        certifications,
        portfolioPhotos,
        business: {
          ...(profile?.business || {}),
          name: companyName,
          phone: businessPhone,
        },
        businessAddress: {
          street: streetAddress,
          city,
          state: stateName,
          zip,
        },
      });
      setSnapshot(null);
      setIsEditing(false);
    } catch (err) {
      alert(`Could not save profile: ${err.message}`);
    } finally {
      setSavingProfile(false);
    }
  };

  const addSpecialty = () => {
    if (newSpecialty.trim() && !specialties.includes(newSpecialty.trim())) {
      setSpecialties([...specialties, newSpecialty.trim()]);
      setNewSpecialty('');
    }
  };

  const removeSpecialty = (index) => {
    setSpecialties(specialties.filter((_, i) => i !== index));
  };

  const addCertification = () => {
    const newId = Math.max(0, ...certifications.map(c => c.id)) + 1;
    setCertifications([...certifications, { id: newId, name: '', issuer: '', date: '' }]);
  };

  const removeCertification = (id) => {
    setCertifications(certifications.filter(c => c.id !== id));
  };

  const updateCertification = (id, field, value) => {
    setCertifications(certifications.map(c =>
      c.id === id ? { ...c, [field]: value } : c
    ));
  };

  const removePhoto = (index) => {
    setPortfolioPhotos(portfolioPhotos.filter((_, i) => i !== index));
  };

  /**
   * There is no addPhoto, and that is the fix rather than the gap.
   *
   * It used to push the next integer onto the list and save it, so "Add Photo"
   * produced a grey placeholder tile and persisted it to your profile forever.
   * Nothing was uploaded, because nothing in this app can upload: no storage, no
   * endpoint, no field to hold a URL. A control that reports success and adds a
   * picture of nothing is worse than no control, which is the whole reason this
   * pass exists. removePhoto stays: profiles saved before this can still be
   * cleared of the tiles that button minted.
   */

  const visibilityBtnStyle = (isActive, type) => ({
    padding: '6px 12px',
    border: `1px solid ${isActive ? (type === 'public' ? colors.green : colors.gray400) : colors.gray300}`,
    borderRadius: 6,
    background: isActive ? (type === 'public' ? '#e8f5e9' : colors.gray100) : '#fff',
    color: isActive ? (type === 'public' ? colors.green : colors.gray600) : colors.gray500,
    fontSize: 12,
    fontWeight: 500,
    cursor: 'pointer',
    display: 'inline-flex',
    alignItems: 'center',
    gap: 4,
  });

  /**
   * A URL naming a pro who is not in the directory.
   *
   * Says so, rather than falling back to a pro who does exist or to your own
   * profile. Both would answer a question about somebody else with a page about
   * somebody else again, and the reader would have no way to tell. Same reason
   * the project page answers a bad id with "not found" instead of a new draft.
   */
  if (proNotFound) {
    return (
      <div style={styles.wrapper}>
        <Link to="/pros" style={styles.backLink}>
          <ArrowLeft size={18} /> Back to Find a Pro
        </Link>
        <div style={{ maxWidth: 560, margin: '48px auto', textAlign: 'center' }}>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: colors.gray900, margin: '0 0 8px' }}>
            We could not find that pro
          </h1>
          <p style={{ color: colors.gray500, fontSize: 14, lineHeight: 1.6, margin: 0 }}>
            The link may be out of date, or they may no longer be listed. Everyone
            working out of your showroom is on <Link to="/pros" style={{ color: colors.darkBlue, fontWeight: 600 }}>Find a Pro</Link>.
          </p>
        </div>
      </div>
    );
  }

  return (
     <div style={styles.wrapper}>
      {/* Back to where you came from: a pro's page belongs to the directory,
          your own belongs to your dashboard. This was always the dashboard,
          which on a pro's page sent a signed-out visitor somewhere they cannot
          go. */}
      <Link to={directoryPro ? '/pros' : '/settings'} style={styles.backLink}>
        <ArrowLeft size={18} /> {directoryPro ? 'Back to Find a Pro' : 'Back to Dashboard'}
      </Link>

      {/* Edit Mode Banner */}
      {isEditing && (
        <div style={styles.editActionBar}>
          <div style={styles.editActionBarText}>
            Editing your profile
          </div>
          <div style={styles.saveCancelRow}>
            <button style={styles.cancelBtn} onClick={cancelEdit}>Cancel</button>
            <button style={styles.saveProfileBtn} onClick={saveProfile}>
              <Save size={14} /> Save Profile
            </button>
          </div>
        </div>
      )}

      {/* Hero Section */}
      <div style={styles.hero}>
        {/* "Change Cover Photo" lived here and did nothing. There is no image
            upload anywhere in this app: no storage, no endpoint, and no field on
            a profile to hold a URL. Same answer as the project page's photo
            tab, for the same reason. The gradient is the cover. */}
        <div style={styles.coverPhoto} />
        <div style={styles.container}>
          <div className="flex-wrap" style={styles.heroContent}>
            {/* The initials of whoever this page is about. This was the literal
                string "MR", so every pro and every account wore Mae Reedy's
                monogram: the single clearest symptom of one page rendering one
                hardcoded person. */}
            {/* No camera overlay in edit mode. It was a div with a camera icon
                and no handler: it darkened on hover, invited the click, and
                swallowed it. See the cover photo above for why there is nothing
                to wire it to. */}
            <div style={styles.profilePhoto}>
              {shownInitials}
            </div>
            <div style={styles.heroInfo}>
              {isEditing ? (
                <div style={{ display: 'flex', gap: 12, marginBottom: 8 }}>
                  <input
                    style={{ ...styles.inlineInput, maxWidth: 180 }}
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    placeholder="First Name"
                  />
                  <input
                    style={{ ...styles.inlineInput, maxWidth: 180 }}
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    placeholder="Last Name"
                  />
                </div>
              ) : (
                <h1 style={styles.proName}>{firstName} {lastName}</h1>
              )}

              {isEditing ? (
                <input
                  style={{ ...styles.inlineInput, maxWidth: 360, marginBottom: 12 }}
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  placeholder="Company Name"
                />
              ) : (
                <div style={styles.companyName}>{companyName}</div>
              )}

              <div style={styles.ratingRow}>
                <span style={styles.ratingScore}>{ratingLabel(pro.rating)} {pro.rating.toFixed(1)}</span>
                {renderStars(pro.rating)}
                {/* Was an <a> with no href, styled like a link and doing
                    nothing. It is the reviews, so it goes to the reviews. */}
                <button
                  type="button"
                  style={{ ...styles.reviewCount, background: 'none', border: 'none', padding: 0, cursor: 'pointer', font: 'inherit' }}
                  onClick={scrollToReviews}
                >({pro.reviewCount} reviews)</button>
              </div>

              {isEditing ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <MapPin size={14} color={colors.gray500} />
                  <input
                    style={{ ...styles.inlineInput, maxWidth: 200 }}
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    placeholder="City, State"
                  />
                </div>
              ) : (
                <div style={styles.locationRow}>
                  <MapPin size={14} />
                  {location} &bull; Member since {pro.memberSince}
                </div>
              )}
            </div>

            <div style={styles.heroActions}>
              {!isEditing ? (
                <>
                  {isOwnProfile && (
                    <button style={styles.editToggleBtn} onClick={enterEditMode}>
                      <Pencil size={14} /> Edit Profile
                    </button>
                  )}
                  {/* Share copies the URL rather than opening the OS share
                      sheet: navigator.share is not there on desktop Chrome,
                      which is where this gets demoed, and a button that works on
                      one machine and silently does nothing on another is the
                      thing being fixed. Clipboard is available everywhere this
                      runs and the label says what happened. */}
                  <button style={styles.shareBtn} onClick={copyProfileLink}>
                    <Share2 size={14} /> {shareLabel}
                  </button>
                  {!isOwnProfile && (
                    <button
                      style={{
                        ...styles.saveBtn,
                        ...(proSaved ? { background: '#fee2e2', borderColor: '#fca5a5', color: '#9a0a27' } : {}),
                      }}
                      onClick={toggleProSaved}
                      title={proSaved ? 'Remove from saved pros' : 'Save this pro for later'}
                    >
                      <Heart
                        size={14}
                        fill={proSaved ? '#9a0a27' : 'none'}
                      />
                      {proSaved ? 'Saved' : 'Save'}
                    </button>
                  )}
                </>
              ) : (
                <div style={styles.visibilityBar}>
                  <span style={styles.visibilityLabel}>Visibility:</span>
                  <button
                    onClick={() => setProfileVisibility('public')}
                    style={visibilityBtnStyle(profileVisibility === 'public', 'public')}
                  >
                    <Globe size={12} /> Public
                  </button>
                  <button
                    onClick={() => setProfileVisibility('private')}
                    style={visibilityBtnStyle(profileVisibility === 'private', 'private')}
                  >
                    <Lock size={12} /> Private
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div style={styles.container}>
        <div className="grid grid-cols-1 md:grid-cols-[1fr_380px] gap-6" style={styles.mainLayout}>
          {/* Left Column */}
          <div style={styles.mainContent}>
            {/* About */}
            <div style={styles.card}>
              <div style={styles.cardHeader}>
                <h2 style={styles.cardTitle}>About</h2>
              </div>
              <div style={styles.cardBody}>
                {isEditing ? (
                  <textarea
                    style={styles.inlineTextarea}
                    value={bio}
                    onChange={(e) => setBio(e.target.value)}
                    placeholder="Tell potential clients about yourself and your work..."
                  />
                ) : (
                  <p style={styles.aboutText}>{bio}</p>
                )}
              </div>
            </div>

            {/* Specialties */}
            <div style={styles.card}>
              <div style={styles.cardHeader}>
                <h2 style={styles.cardTitle}>Specialties</h2>
              </div>
              <div style={styles.cardBody}>
                <div style={styles.chipContainer}>
                  {specialties.map((specialty, i) =>
                    isEditing ? (
                      <span key={i} style={styles.editableChip}>
                        {specialty}
                        <button style={styles.chipRemoveBtn} onClick={() => removeSpecialty(i)}>
                          <X size={12} />
                        </button>
                      </span>
                    ) : (
                      <span key={i} style={styles.chip}>{specialty}</span>
                    )
                  )}
                  {isEditing && (
                    <>
                      <input
                        style={{ ...styles.inlineInput, maxWidth: 180 }}
                        value={newSpecialty}
                        onChange={(e) => setNewSpecialty(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && addSpecialty()}
                        placeholder="New specialty..."
                      />
                      <button style={styles.addChipBtn} onClick={addSpecialty}>
                        <Plus size={12} /> Add
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* Contact & Business Info (edit mode only) */}
            {isEditing && (
              <div style={styles.card}>
                <div style={styles.cardHeader}>
                  <h2 style={styles.cardTitle}>Contact & Business Info</h2>
                </div>
                <div style={styles.cardBody}>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                    <div>
                      <label style={styles.editFormLabel}>Primary Phone</label>
                      <input
                        style={styles.inlineInput}
                        value={primaryPhone}
                        onChange={(e) => setPrimaryPhone(e.target.value)}
                      />
                    </div>
                    <div>
                      <label style={styles.editFormLabel}>Business Phone</label>
                      <input
                        style={styles.inlineInput}
                        value={businessPhone}
                        onChange={(e) => setBusinessPhone(e.target.value)}
                        placeholder="Optional"
                      />
                    </div>
                  </div>
                  <div style={{ marginBottom: 16 }}>
                    <label style={styles.editFormLabel}>Street Address</label>
                    <input
                      style={styles.inlineInput}
                      value={streetAddress}
                      onChange={(e) => setStreetAddress(e.target.value)}
                    />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-[2fr_1fr_1fr] gap-4">
                    <div>
                      <label style={styles.editFormLabel}>City</label>
                      <input
                        style={styles.inlineInput}
                        value={city}
                        onChange={(e) => setCity(e.target.value)}
                      />
                    </div>
                    <div>
                      <label style={styles.editFormLabel}>State</label>
                      <input
                        style={styles.inlineInput}
                        value={stateName}
                        onChange={(e) => setStateName(e.target.value)}
                      />
                    </div>
                    <div>
                      <label style={styles.editFormLabel}>ZIP Code</label>
                      <input
                        style={styles.inlineInput}
                        value={zip}
                        onChange={(e) => setZip(e.target.value)}
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Certifications & Licenses (edit mode only) */}
            {isEditing && (
              <div style={styles.card}>
                <div style={styles.cardHeader}>
                  <h2 style={styles.cardTitle}>Certifications & Licenses</h2>
                  <button style={styles.addChipBtn} onClick={addCertification}>
                    <Plus size={12} /> Add
                  </button>
                </div>
                <div style={styles.cardBody}>
                  {certifications.map((cert) => (
                    <div key={cert.id} style={styles.certItem}>
                      <div style={{ flex: 1 }}>
                        <input
                          style={{ ...styles.inlineInput, fontWeight: 600 }}
                          value={cert.name}
                          onChange={(e) => updateCertification(cert.id, 'name', e.target.value)}
                          placeholder="Certification name"
                        />
                        <div style={styles.certFields}>
                          <input
                            style={{ ...styles.inlineInput, flex: 1 }}
                            value={cert.issuer}
                            onChange={(e) => updateCertification(cert.id, 'issuer', e.target.value)}
                            placeholder="Issuing organization"
                          />
                          <input
                            style={{ ...styles.inlineInput, maxWidth: 120 }}
                            value={cert.date}
                            onChange={(e) => updateCertification(cert.id, 'date', e.target.value)}
                            placeholder="Date"
                          />
                        </div>
                      </div>
                      <button
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: colors.red, marginLeft: 12, padding: 4 }}
                        onClick={() => removeCertification(cert.id)}
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Projects Gallery */}
            <div style={styles.card}>
              <div style={styles.cardHeader}>
                <h2 style={styles.cardTitle}>Projects & Photos</h2>
              </div>
              <div style={styles.cardBody}>
                {/* The grid used to render every photo and then offer a "View
                    all" button under it, which is why that button had nothing to
                    do: everything was already on screen and `showAllPhotos` was
                    read by nobody. Six, then the rest on request, gives both
                    controls something real to mean. Editing always shows all of
                    them: you cannot manage what is hidden. */}
                {portfolioPhotos.length === 0 ? (
                  <div style={{ fontSize: 13, color: colors.gray500, padding: '16px 0' }}>
                    {isOwnProfile
                      ? 'No photos on your profile yet.'
                      : 'This pro has not added photos yet.'}
                  </div>
                ) : (
                <div className="grid grid-cols-2 md:grid-cols-3 gap-2" style={{ ...styles.gallery, display: undefined, gridTemplateColumns: undefined, gap: undefined }}>
                  {visiblePhotos.map((item, i) => (
                    <div key={i} style={styles.galleryItem}>
                      <Image size={32} color={colors.gray400} />
                      {isEditing && (
                        <button style={styles.galleryRemoveBtn} onClick={() => removePhoto(i)}>
                          <X size={12} />
                        </button>
                      )}
                      {!isEditing && !showAllPhotos && i === 5 && portfolioPhotos.length > 6 && (
                        <div style={styles.galleryOverlay} onClick={() => setShowAllPhotos(true)}>
                          See all ({portfolioPhotos.length})
                        </div>
                      )}
                    </div>
                  ))}
                </div>
                )}
              </div>
              {/* Only when there is something still hidden. A "View all 4
                  photos" button under four photos is the dead-button pattern
                  wearing a number. */}
              {!isEditing && portfolioPhotos.length > 6 && (
                <button style={styles.seeAllBtn} onClick={() => setShowAllPhotos((v) => !v)}>
                  {showAllPhotos
                    ? <>Show fewer <ChevronDown size={16} style={{ transform: 'rotate(180deg)' }} /></>
                    : <>View all {portfolioPhotos.length} photos <ChevronRight size={16} /></>}
                </button>
              )}
            </div>

            {/* Reviews */}
            <div style={styles.card} ref={reviewsRef}>
              <div style={styles.cardHeader}>
                <h2 style={styles.cardTitle}>Reviews</h2>
              </div>
              <div style={styles.cardBody}>
                <p style={styles.reviewHighlights}>
                  Customers rated this pro highly for{' '}
                  <span style={styles.highlightBold}>work quality</span>,{' '}
                  <span style={styles.highlightBold}>professionalism</span>, and{' '}
                  <span style={styles.highlightBold}>value</span>.
                </p>

                <div style={styles.reviewSummary}>
                  <div style={styles.reviewScoreBox}>
                    <div style={styles.reviewScoreBig}>{pro.rating.toFixed(1)}</div>
                    {renderStars(pro.rating, 18)}
                    <div style={styles.reviewScoreLabel}>{pro.reviewCount} reviews</div>
                  </div>
                  <div style={styles.reviewBars}>
                    {reviewBreakdown.map((item) => (
                      <div key={item.stars} style={styles.reviewBarRow}>
                        <span style={styles.reviewBarLabel}>{item.stars}</span>
                        <div style={styles.reviewBarTrack}>
                          <div style={styles.reviewBarFill(item.percent)} />
                        </div>
                        <span style={styles.reviewBarPercent}>{item.percent}%</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div style={{ fontSize: 13, color: colors.gray500, marginBottom: 8 }}>
                  Read reviews that mention:
                </div>
                <div style={styles.reviewFilters}>
                  {filterTags.map((tag) => (
                    <button
                      key={tag.id}
                      style={styles.filterChip(reviewFilter === tag.id)}
                      onClick={() => setReviewFilter(tag.id)}
                    >
                      {tag.label} &middot; {tag.count}
                    </button>
                  ))}
                </div>

                {visibleReviews.map((review) => (
                  <div key={review.id} style={styles.reviewCard}>
                    <div style={styles.reviewHeader}>
                      <div style={styles.reviewerInfo}>
                        <div style={styles.reviewerAvatar}>{review.initials}</div>
                        <div>
                          <div style={styles.reviewerName}>{review.name}</div>
                          <div style={styles.reviewerMeta}>
                            {renderStars(review.rating, 12)}
                          </div>
                        </div>
                      </div>
                      <span style={styles.reviewDate}>{review.date}</span>
                    </div>
                    <p style={styles.reviewText}>{review.text}</p>
                    <div style={styles.reviewDetails}>{review.details}</div>
                    {review.photos > 0 && (
                      <div style={styles.reviewPhotos}>
                        {[...Array(Math.min(review.photos, 3))].map((_, i) => (
                          <div key={i} style={styles.reviewPhoto}>
                            <Image size={24} color={colors.gray400} />
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Sidebar */}
          <div style={styles.sidebar}>
            <div style={styles.stickyBox}>
              {/* Consultation CTA. Only on somebody else's page: you cannot
                  hire yourself, and this card sat on your own profile offering
                  it. Note the whole card goes, not just the button. Leaving the
                  heading and the "replies within a business day" promise above a
                  hidden button would be the same claim with nothing under it. */}
              {directoryPro && (
              <div style={styles.ctaCard}>
                <div style={styles.ctaTitle}>Request a Consultation</div>
                <div style={styles.ctaSubtitle}>Free, no obligation · Replies within a business day</div>

                <button
                  onClick={() => setConsultOpen(true)}
                  style={{ ...styles.btnPrimary, marginTop: 4 }}
                >Request a Consultation</button>
                {/* "Send a message" is a member-only DM flow (distinct from
                    the consultation request, which is the public/guest path).
                    Hidden for logged-out viewers so we don't promise a DM
                    they can't actually use. */}
                {userId && (
                  <Link
                    to="/messages"
                    style={{ ...styles.btnOutline, textDecoration: 'none' }}
                  >
                    <MessageCircle size={16} /> Send a message
                  </Link>
                )}

              </div>
              )}

              {/* ProSource Showroom */}
              {/* The showroom this profile works out of. Hardcoded to Allen,
                  TX until now, under every pro and every account regardless of
                  where they are: a St. Louis contractor's page listed a Texas
                  showroom and a Texas phone number.

                  The map placeholder is gone rather than restyled. It was a grey
                  box with the word "placeholder" in it, promising a map that no
                  part of this app has ever had. */}
              {shownShowroom && (
                <div style={styles.showroomCard}>
                  <div style={styles.showroomTitle}>ProSource Showroom</div>
                  <div style={styles.showroomName}>{shownShowroom.name}</div>

                  <div style={styles.showroomContact}>
                    <MapPin size={14} style={styles.showroomContactIcon} />
                    <span style={{ ...styles.showroomContactText, whiteSpace: 'pre-line' }}>
                      {shownShowroom.address}
                    </span>
                  </div>
                  {shownShowroom.phone && (
                    <div style={styles.showroomContact}>
                      <Phone size={14} style={styles.showroomContactIcon} />
                      <span style={styles.showroomContactText}>{shownShowroom.phone}</span>
                    </div>
                  )}
                </div>
              )}

              {/* Credentials */}
              <div style={styles.credentialsCard}>
                <h3 style={{ ...styles.cardTitle, fontSize: 16, marginBottom: 12 }}>Credentials</h3>
                {/* Reads the certifications this profile actually carries. It
                    used to print "Licensed Contractor" and "Insured" as literals
                    regardless, so the pro's own list was editable, saved, and
                    then ignored by the card that claimed to show it.

                    "View credential details" was a button under two lines with
                    no detail behind them. The detail is the issuer and the date,
                    which the records have and the card was throwing away, so it
                    expands each one rather than navigating to a page that does
                    not exist. */}
                {certifications.length === 0 ? (
                  <div style={{ fontSize: 12, color: colors.gray500 }}>
                    {isOwnProfile
                      ? 'None added yet. Add them from Edit Profile.'
                      : 'This pro has not listed any credentials.'}
                  </div>
                ) : (
                  certifications.map((c, i) => {
                    const detail = [c.issuer, c.date].filter(Boolean).join(' · ');
                    const open = openCredential === c.id;
                    const last = i === certifications.length - 1;
                    return (
                      <div key={c.id ?? i} style={last ? { ...styles.credentialItem, borderBottom: 'none' } : styles.credentialItem}>
                        <CheckCircle size={16} style={styles.credentialIcon} />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <span style={styles.credentialText}>{c.name}</span>
                          {open && (
                            <div style={{ fontSize: 11, color: colors.gray500, marginTop: 4 }}>
                              {detail || 'No issuer or date on this credential.'}
                            </div>
                          )}
                        </div>
                        {detail && (
                          <button
                            type="button"
                            onClick={() => setOpenCredential(open ? null : c.id)}
                            title={open ? 'Hide details' : 'Show details'}
                            style={{ background: 'none', border: 'none', cursor: 'pointer', color: colors.gray500, padding: 2, display: 'flex' }}
                          >
                            <ChevronDown size={14} style={open ? { transform: 'rotate(180deg)' } : undefined} />
                          </button>
                        )}
                      </div>
                    );
                  })
                )}
                <p style={{ fontSize: 11, color: colors.gray500, marginTop: 12, lineHeight: 1.5 }}>
                  All credentials are self-reported by the professional and have not been independently verified by ProSource.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom sticky save bar */}
      {isEditing && (
        <div style={{ ...styles.editActionBar, position: 'sticky', bottom: 0, zIndex: 10, borderTop: '1px solid #fde68a', borderBottom: 'none' }}>
          <div style={styles.editActionBarText}>Unsaved changes</div>
          <div style={styles.saveCancelRow}>
            <button style={styles.cancelBtn} onClick={cancelEdit}>Cancel</button>
            <button style={styles.saveProfileBtn} onClick={saveProfile}>
              <Save size={14} /> Save Profile
            </button>
          </div>
        </div>
      )}

      {/* Only from a pro's page. The button that opens this does not exist on
          your own, because requesting a consultation with yourself is not a
          thing, and `firstName`/`lastName` there are YOURS: the old mount read
          them either way, so the wizard's "we sent it to X" named whoever was
          logged in. */}
      {directoryPro && (
        <ConsultationWizard
          isOpen={consultOpen}
          onClose={() => setConsultOpen(false)}
          pro={{
            name: proFullName(directoryPro),
            initials: `${directoryPro.firstName[0]}${directoryPro.lastName[0]}`.toUpperCase(),
            // Their directory id, not a userId, because a pro is not an account
            // (see src/pro-directory.js). It rides along so the request records
            // WHO it was about; it is not somewhere the request can be
            // delivered, and the wizard's copy must not imply that it is.
            proId: directoryPro.id,
            userId: null,
          }}
        />
      )}
    </div>
  );
};

export default ProSourcePublicProfile;
