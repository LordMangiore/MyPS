import { getStore } from "@netlify/blobs";
import { seedNewUser } from "./lib/seed.mjs";

/**
 * Sign in to the shared, pre-seeded demo account — the "Demo: Skip Signup"
 * button's backend.
 *
 * POST /api/demo-session           → ensure the account exists, return a real session
 * POST /api/demo-session?reset=1   → wipe the demo account's data first, then reseed
 *
 * Returns the same response shape as otp-verify.mjs so the client can build a
 * session from either endpoint identically. Deliberately independent of OTP,
 * Resend, OTP_DEV_BYPASS and Firebase: the account is fixed and its userId is
 * deterministic, so Skip Signup works regardless of how email/auth is configured.
 *
 * Persistence is the whole point: the account is seeded only where a blob key is
 * still empty (seedNewUser's contract), so a scenario set up on one click is
 * still there on the next. Only ?reset=1 throws data away.
 *
 * Demo only — no auth check.
 */

const DEMO_EMAIL = "demo@prosource.com";
const DEMO_FIRST_NAME = "Justin";

// Same convention as otp-verify.mjs's `legacyUserId` ("ps-" + email) so the demo
// account is an ordinary account: signing in through the OTP flow as
// demo@prosource.com resolves to this exact userId and the exact same data.
const DEMO_USER_ID = "ps-" + DEMO_EMAIL.replace(/[^a-z0-9]/g, "-");

// Every per-user key ?reset=1 clears. Mirrors ALLOWED_KEYS in user-data.mjs —
// seeded keys plus the ones the app writes as you click around.
const DEMO_DATA_KEYS = [
  "projects",
  "messages",
  "carts",
  "connections",
  "notifications",
  "orders",
  "appointments",
  "discussions",
  "consultations",
];

// The demo account's profile. Shape mirrors `buildProfilePayload` in
// src/prosource-login.jsx (what onboarding would have written) so Settings and
// the profile surfaces render real values instead of blanks. Showroom + account
// manager are copied from the St. Louis entry in lookup-showroom.mjs, which is
// the showroom the rest of the seed data (orders, appointments) already names.
const DEMO_PROFILE = {
  email: DEMO_EMAIL,
  firstName: DEMO_FIRST_NAME,
  lastName: "Reyes",
  phone: "(314) 555-0117",
  userType: "tradepro",
  showroom: {
    id: "st-louis",
    name: "ProSource of St. Louis",
    address: "1801 S Brentwood Blvd, St. Louis, MO 63144",
    phone: "(314) 968-1900",
  },
  accountManager: {
    name: "Kim Marks",
    title: "Account Manager",
    email: "kim.marks@prosource.example",
    phone: "(314) 555-0142",
    initials: "KM",
    photoColor: "#1a4eb8",
  },
  businessAddress: {
    street: "2140 Manchester Ave",
    city: "St. Louis",
    state: "MO",
    zip: "63103",
  },
  business: {
    name: "Reyes Design & Build",
    phone: "(314) 555-0180",
    tradeType: "General Contractor",
    businessType: "LLC",
    licenseNumber: "MO-GC-114872",
    website: "reyesdesignbuild.com",
    employees: "6 – 10",
    projects: "5 – 10",
    spend: "$20,000 – $50,000",
  },
  preferences: {
    showroomUsage: "accompany",
    interests: ["hardwood", "lvp", "tile", "countertops"],
    currentSuppliers: "",
    upcomingProjects: "",
    hearAbout: "Referral from another trade pro",
    helpedBy: "Kim Marks",
  },
  optInTerms: true,
  optInUpdates: true,
  optInConsent: true,
  demo: true,
};

const blobKey = (userId, key) => `${userId}::${key}`;

/** Throw away everything the demo account owns so the next seed is pristine. */
const wipeDemoAccount = async (userId) => {
  const data = getStore({ name: "ps-user-data", consistency: "strong" });
  await Promise.all(
    DEMO_DATA_KEYS.map((key) => data.delete(blobKey(userId, key)).catch(() => {}))
  );
  const users = getStore({ name: "ps-users", consistency: "strong" });
  await users.delete(userId).catch(() => {});
};

/** Write the demo profile only if there isn't one — edits made in the demo stay. */
const ensureDemoProfile = async (userId) => {
  const users = getStore({ name: "ps-users", consistency: "strong" });
  const existing = await users.get(userId, { type: "json" }).catch(() => null);
  if (existing) return existing;
  const now = Date.now();
  const profile = { ...DEMO_PROFILE, userId, createdAt: now, updatedAt: now };
  await users.setJSON(userId, profile);
  return profile;
};

export default async function handler(req) {
  if (req.method !== "POST" && req.method !== "GET") {
    return new Response("Method not allowed", { status: 405 });
  }

  try {
    const url = new URL(req.url);
    const resetParam = url.searchParams.get("reset");
    const reset = resetParam === "1" || resetParam === "true";

    // Resolve the account through the same email → user mapping the OTP path
    // uses. If it's already registered we reuse that userId verbatim.
    const userStore = getStore("ps-email-to-user");
    let mapping = null;
    try {
      mapping = await userStore.get(DEMO_EMAIL, { type: "json" });
    } catch {}

    const userId = mapping?.userId || DEMO_USER_ID;

    if (reset) await wipeDemoAccount(userId);

    if (!mapping?.userId) {
      await userStore.setJSON(DEMO_EMAIL, {
        userId,
        legacyUserId: DEMO_USER_ID,
        firebaseUid: null,
        createdAt: Date.now(),
        demo: true,
      });
    }

    // Idempotent by design: seedNewUser writes a key only when it's empty, so
    // this fills in whatever is missing (first ever click, or a half-created
    // account from a failed seed) and never touches data that's already there.
    await seedNewUser(userId);
    await ensureDemoProfile(userId);

    // No Firebase for the demo account — mint the same style of opaque session
    // token otp-verify.mjs falls back to.
    const token = btoa(
      `${userId}:${Date.now()}:${Math.random().toString(36).slice(2)}`
    );

    return Response.json({
      success: true,
      demo: true,
      reset,
      // The demo account is never "new" — it's pre-seeded, so no onboarding.
      isNewUser: false,
      user: {
        id: userId,
        email: DEMO_EMAIL,
        name: DEMO_FIRST_NAME,
        firebaseUid: null,
      },
      token,
      userType: DEMO_PROFILE.userType,
      showroom: DEMO_PROFILE.showroom,
      accountManager: DEMO_PROFILE.accountManager,
      firebase: null,
    });
  } catch (err) {
    console.error("demo-session error:", err);
    return Response.json({ error: err.message }, { status: 500 });
  }
}
