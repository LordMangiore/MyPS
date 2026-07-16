import React, { useState, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useAuth } from './auth-context';
import ConsultationWizard from './prosource-consultation-wizard';
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
  Camera,
  Globe,
  Lock,
  Plus,
  Trash2,
  ArrowLeft
} from 'lucide-react';

const ProSourcePublicProfile = () => {
  const { profile, saveProfile: persistProfile, userId } = useAuth();
  const [searchParams] = useSearchParams();
  // /profile is reused for both "your own profile" (My Profile menu link)
  // and "someone else's profile" (Find a Pro / connection card). The link
  // that lands here from the user menu carries ?own=1; everywhere else,
  // we treat it as a public pro profile being viewed by a homeowner.
  const isOwnProfile = searchParams.get('own') === '1';

  // Demo-only favorited-pros store. Keyed by the displayed pro slug;
  // there's only one pro in the demo so we use a stable identifier.
  const PRO_SLUG = 'mae-reedy';
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

  // Edit mode
  const [isEditing, setIsEditing] = useState(false);
  const [snapshot, setSnapshot] = useState(null);
  const [savingProfile, setSavingProfile] = useState(false);

  // Editable profile fields \u2014 seeded from the saved profile when available,
  // otherwise fall back to the demo sample data (Mae R.).
  const p = profile || {};
  const ba = p.businessAddress || p.address || {};

  const [firstName, setFirstName] = useState(p.firstName || 'Mae');
  const [lastName, setLastName] = useState(p.lastName || 'R.');
  const [companyName, setCompanyName] = useState(p.business?.name || 'Mae Reedy Build + Design');
  const [bio, setBio] = useState(p.bio || "Mae Reedy is the founder of Mae Reedy Build + Design, a Dallas-based studio known for pairing design vision with construction precision. Trained in art with roots in textiles and handmade goods, she entered interiors through hands-on collaboration and mentorship, then earned her contractor's license to serve her community when it needed qualified builders. Mae leads with process\u2014clear roadmaps, structured meetings, and visual presentations that reduce friction and keep projects on track.");
  const [specialties, setSpecialties] = useState(p.specialties || [
    'Kitchen & Bathroom',
    'Flooring Installation',
    'Interior Design',
    'Remodeling',
    'Room Additions',
    'Architects & Building Design',
  ]);
  const [newSpecialty, setNewSpecialty] = useState('');
  const [primaryPhone, setPrimaryPhone] = useState(p.phone || '972-449-0356');
  const [businessPhone, setBusinessPhone] = useState(p.business?.phone || '');
  const [location, setLocation] = useState(p.location || ((ba.city && ba.state) ? `${ba.city}, ${ba.state}` : 'Allen, TX'));
  const [streetAddress, setStreetAddress] = useState(ba.street || '25 Prestige Circle');
  const [city, setCity] = useState(ba.city || 'Allen');
  const [stateName, setStateName] = useState(ba.state || 'TX');
  const [zip, setZip] = useState(ba.zip || '75002');
  const [profileVisibility, setProfileVisibility] = useState(p.profileVisibility || 'public');
  const [certifications, setCertifications] = useState(p.certifications || [
    { id: 1, name: 'Licensed Contractor', issuer: 'Texas TDLR', date: 'Jan 2021' },
    { id: 2, name: 'Insured', issuer: '', date: '' },
  ]);
  const [portfolioPhotos, setPortfolioPhotos] = useState(p.portfolioPhotos || [1, 2, 3, 4, 5, 6]);

  // When the profile blob loads after mount, refresh fields if the user is
  // still on defaults. Don't clobber unsaved edits.
  useEffect(() => {
    if (!profile || isEditing) return;
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
    photoUploadOverlay: {
      position: 'absolute',
      inset: 0,
      background: 'rgba(0,0,0,0.4)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      cursor: 'pointer',
      borderRadius: 8,
    },
    coverPhotoEditBtn: {
      position: 'absolute',
      bottom: 16,
      right: 16,
      padding: '8px 16px',
      background: 'rgba(0,0,0,0.6)',
      color: '#fff',
      border: 'none',
      borderRadius: 6,
      fontSize: 12,
      fontWeight: 500,
      cursor: 'pointer',
      display: 'flex',
      alignItems: 'center',
      gap: 6,
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
    addPhotoTile: {
      aspectRatio: '1',
      borderRadius: 8,
      border: `2px dashed ${colors.gray300}`,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      cursor: 'pointer',
      gap: 4,
      fontSize: 12,
      color: colors.gray500,
      background: '#fff',
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

  // Read-only data
  const pro = {
    memberSince: '2021',
    rating: 5.0,
    reviewCount: 30,
    stats: {
      hired: 59,
      yearsInBusiness: 2,
      employees: 3,
      backgroundCheck: true,
    },
    reviews: [
      {
        id: 1,
        name: 'Christopher C.',
        initials: 'CC',
        rating: 5,
        date: 'Aug 23, 2025',
        source: 'Thumbtack',
        text: 'I had an amazing experience from the beginning to the end. Everyone was very timely. They got everything done correctly and left my flooring looking amazing. I would definitely recommend them to all that need new flooring installed in their home.',
        details: 'Luxury vinyl flooring \u2022 751 - 1,000 sq ft \u2022 Vinyl or linoleum \u2022 Home',
        photos: 1,
      },
      {
        id: 2,
        name: 'Teri S.',
        initials: 'TS',
        rating: 5,
        date: 'Jul 17, 2025',
        source: 'Thumbtack',
        text: 'MAR Flooring came out to provide an estimate on removing my old kitchen floor and hallway. They were on time, professional, and after choosing them for the install, the work was top notch. I will definitely call them again for any flooring type of work.',
        details: 'Laminate \u2022 751 - 1,000 sq ft \u2022 Home',
        photos: 0,
      },
      {
        id: 3,
        name: 'Greg S.',
        initials: 'GS',
        rating: 5,
        date: 'Apr 20, 2025',
        source: 'Thumbtack',
        text: 'Mar flooring was great to deal with. Both of the guys were on time during installation. They were professional and friendly. The flooring looks great and we are very happy we used MAR!',
        details: 'Luxury vinyl flooring \u2022 1,001 - 1,500 sq ft \u2022 Home',
        photos: 2,
      },
    ],
  };

  const reviewBreakdown = [
    { stars: 5, percent: 97 },
    { stars: 4, percent: 3 },
    { stars: 3, percent: 0 },
    { stars: 2, percent: 0 },
    { stars: 1, percent: 0 },
  ];

  const filterTags = [
    { id: 'all', label: 'All', count: 30 },
    { id: 'floor', label: 'floor', count: 11 },
    { id: 'install', label: 'install', count: 7 },
    { id: 'project', label: 'project', count: 2 },
    { id: 'vinyl', label: 'vinyl', count: 3 },
    { id: 'carpet', label: 'carpet', count: 3 },
    { id: 'kitchen', label: 'kitchen', count: 2 },
  ];

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

  const addPhoto = () => {
    const newId = portfolioPhotos.length > 0 ? Math.max(...portfolioPhotos) + 1 : 1;
    setPortfolioPhotos([...portfolioPhotos, newId]);
  };

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

  return (
     <div style={styles.wrapper}>
      {/* Back Link */}
      <Link to="/settings" style={styles.backLink}>
        <ArrowLeft size={18} /> Back to Dashboard
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
        <div style={styles.coverPhoto}>
          {isEditing && (
            <button style={styles.coverPhotoEditBtn}>
              <Camera size={14} /> Change Cover Photo
            </button>
          )}
        </div>
        <div style={styles.container}>
          <div className="flex-wrap" style={styles.heroContent}>
            <div style={styles.profilePhoto}>
              MR
              {isEditing && (
                <div style={styles.photoUploadOverlay}>
                  <Camera size={24} color="#fff" />
                </div>
              )}
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
                <span style={styles.ratingScore}>Exceptional {pro.rating.toFixed(1)}</span>
                {renderStars(pro.rating)}
                <a style={styles.reviewCount}>({pro.reviewCount} reviews)</a>
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
                  <button style={styles.shareBtn}>
                    <Share2 size={14} /> Share
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
                <div className="grid grid-cols-2 md:grid-cols-3 gap-2" style={{ ...styles.gallery, display: undefined, gridTemplateColumns: undefined, gap: undefined }}>
                  {portfolioPhotos.map((item, i) => (
                    <div key={i} style={styles.galleryItem}>
                      <Image size={32} color={colors.gray400} />
                      {isEditing && (
                        <button style={styles.galleryRemoveBtn} onClick={() => removePhoto(i)}>
                          <X size={12} />
                        </button>
                      )}
                      {!isEditing && i === 5 && portfolioPhotos.length > 6 && (
                        <div style={styles.galleryOverlay}>
                          See all ({portfolioPhotos.length})
                        </div>
                      )}
                    </div>
                  ))}
                  {isEditing && (
                    <div style={styles.addPhotoTile} onClick={addPhoto}>
                      <Plus size={20} />
                      <span>Add Photo</span>
                    </div>
                  )}
                </div>
              </div>
              {!isEditing && (
                <button style={styles.seeAllBtn}>
                  View all {portfolioPhotos.length} photos <ChevronRight size={16} />
                </button>
              )}
            </div>

            {/* Reviews */}
            <div style={styles.card}>
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

                {pro.reviews.map((review) => (
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
              {/* Consultation CTA */}
              <div style={styles.ctaCard}>
                <div style={styles.ctaTitle}>Request a Consultation</div>
                <div style={styles.ctaSubtitle}>Free, no obligation · Replies within a business day</div>

                <button
                  onClick={() => setConsultOpen(true)}
                  style={{ ...styles.btnPrimary, marginTop: 4 }}
                >Request a Consultation</button>
                {/* "Send a message" is a member-only DM flow — distinct from
                    the consultation request, which is the public/guest path.
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

              {/* ProSource Showroom */}
              <div style={styles.showroomCard}>
                <div style={styles.showroomTitle}>ProSource Showroom</div>
                <div style={styles.showroomName}>ProSource of Allen</div>

                <div style={styles.showroomContact}>
                  <MapPin size={14} style={styles.showroomContactIcon} />
                  <span style={styles.showroomContactText}>
                    25 Prestige Circle<br />
                    Allen, TX 75002
                  </span>
                </div>
                <div style={styles.showroomContact}>
                  <Phone size={14} style={styles.showroomContactIcon} />
                  <span style={styles.showroomContactText}>972-449-0356</span>
                </div>

                <div style={styles.showroomMap}>
                  Map placeholder
                </div>
              </div>

              {/* Credentials */}
              <div style={styles.credentialsCard}>
                <h3 style={{ ...styles.cardTitle, fontSize: 16, marginBottom: 12 }}>Credentials</h3>
                <div style={styles.credentialItem}>
                  <CheckCircle size={16} style={styles.credentialIcon} />
                  <span style={styles.credentialText}>Licensed Contractor</span>
                </div>
                <div style={{ ...styles.credentialItem, borderBottom: 'none' }}>
                  <CheckCircle size={16} style={styles.credentialIcon} />
                  <span style={styles.credentialText}>Insured</span>
                </div>
                <p style={{ fontSize: 11, color: colors.gray500, marginTop: 12, lineHeight: 1.5 }}>
                  All credentials are self-reported by the professional and have not been independently verified by ProSource.
                </p>
                <button style={styles.viewCredentials}>
                  View credential details
                </button>
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

      <ConsultationWizard
        isOpen={consultOpen}
        onClose={() => setConsultOpen(false)}
        pro={{
          name: `${firstName} ${lastName}`.trim(),
          initials: `${(firstName[0] || '').toUpperCase()}${(lastName[0] || '').toUpperCase()}`,
          userId: null, // placeholder — pro routing is single-profile in the demo
        }}
      />
    </div>
  );
};

export default ProSourcePublicProfile;
