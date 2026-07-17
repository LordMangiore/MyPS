import { getStore } from "@netlify/blobs";
import { seedNewUser, seedMarkerKeys } from "./lib/seed.mjs";

/**
 * Sign in to one of the pre-seeded demo accounts. This is the backend for the
 * landing page's demo buttons.
 *
 * POST /api/demo-session                          → the trade pro account (default)
 * POST /api/demo-session { persona: 'am' }        → the account manager's account
 * POST /api/demo-session { persona: 'homeowner' } → the homeowner's account
 * POST /api/demo-session?reset=1                  → wipe that persona's data first, then reseed
 * POST /api/demo-session?force=1                  → reseed without trusting the seed marker
 *
 * Three personas, so the same app can be shown from all three sides of a job:
 *
 *   tradepro  (default)  Justin Reyes, the contractor buying the materials
 *   am                   Tessa Brandt, an account manager at the St. Louis showroom
 *   homeowner            Alicia Navarro, a client with one job of her own
 *
 * Every persona is a person you can sign in AS, which is why none of them is one
 * of the demo's AI personas (Kim Marks, Denise Okafor, Heather Yager, Bubba
 * Beans, Sarah Chen, Ryan O'Toole). Those six are answered by the model in their
 * own voice (see ai-reply.mjs PERSONAS, DEMO_CONTACTS in src/twilio-client.js),
 * so signing in as one would put two voices on one person: the bot speaking for
 * her and you typing as her, racing each other in the same thread. The two sets
 * must not overlap, by name or by identity: personas you talk FROM here, personas
 * you talk TO there. None of the accounts below carries a `demoIdentity`, and
 * none shares a name with one that does.
 *
 * `persona` is a body field rather than a second endpoint or a query param on
 * purpose: the client contract (POST here, get a session back) does not change,
 * and an omitted/unknown persona is the trade pro account exactly as it was
 * before this endpoint knew personas existed.
 *
 * Each persona is a genuinely separate account: its own email, its own
 * deterministic userId, its own profile and its own seeded world. Nothing is
 * shared, so ?reset=1 on one persona cannot touch another's data.
 *
 * Returns the same response shape as otp-verify.mjs so the client can build a
 * session from either endpoint identically. Deliberately independent of OTP,
 * Resend, OTP_DEV_BYPASS and Firebase: the accounts are fixed and their userIds
 * are deterministic, so the demo works regardless of how email/auth is
 * configured.
 *
 * Persistence is the whole point: an account is seeded only where a blob key is
 * still empty (seedNewUser's contract), so a scenario set up on one click is
 * still there on the next. Only ?reset=1 throws data away.
 *
 * And because the accounts persist, seeding them again on every click was work
 * with nothing to show for it. seedNewUser now marks an account once it has
 * seeded it and checks that marker against reality on the way in, so the common
 * case (an account that already exists and is intact) costs two cheap requests
 * instead of reading every seeded blob. ?force=1 seeds without trusting the
 * marker; ?reset=1 wipes the data AND the marker, so the reseed after it is a
 * genuine first seed.
 *
 * Demo only. No auth check.
 */

// Same convention as otp-verify.mjs's `legacyUserId` ("ps-" + email) so every
// demo account is an ordinary account: signing in through the OTP flow as that
// email resolves to this exact userId and therefore the exact same data.
const userIdForEmail = (email) => "ps-" + email.replace(/[^a-z0-9]/g, "-");

// Every per-user key ?reset=1 clears. Mirrors ALLOWED_KEYS in user-data.mjs:
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

// The showrooms the demo accounts work with. Copied from the matching entries
// in lookup-showroom.mjs, which is where the territory map lives; St. Louis is
// the showroom the rest of the seed data (orders, appointments) already names,
// so it is every persona's primary.
//
// An account can work with more than one showroom, each with its own account
// manager. The trade pro gets two so the multi-showroom flows (picking a
// showroom when creating a project, messaging either AM) have something to
// exercise.
const ST_LOUIS = {
  id: "st-louis",
  name: "ProSource of St. Louis",
  address: "1801 S Brentwood Blvd, St. Louis, MO 63144",
  phone: "(314) 968-1900",
  accountManager: {
    name: "Kim Marks",
    title: "Account Manager",
    email: "kim.marks@prosource.example",
    phone: "(314) 555-0142",
    initials: "KM",
    photoColor: "#1a4eb8",
    demoIdentity: "demo-kim-marks",
  },
};

const CHICAGO = {
  id: "chicago",
  name: "ProSource of Chicago",
  address: "2400 W Hubbard St, Chicago, IL 60612",
  phone: "(312) 555-0180",
  accountManager: {
    name: "Denise Okafor",
    title: "Account Manager",
    email: "denise.okafor@prosource.example",
    phone: "(312) 555-0164",
    initials: "DO",
    photoColor: "#0b6b53",
    demoIdentity: "demo-denise-okafor",
  },
};

// Index 0 is the primary. `showroom` and `accountManager` on a profile are
// always the primary's, so every existing reader of the singular fields keeps
// seeing exactly what it saw before an account grew a second showroom.
const TRADEPRO_SHOWROOMS = [ST_LOUIS, CHICAGO];

// Tessa staffs St. Louis and Alicia is a St. Louis customer: neither has any
// business with Chicago, so neither is given it. A persona's showroom list is
// the list its `withShowrooms` backfill can repair against, which is why this
// is per persona rather than one shared constant.
const ST_LOUIS_ONLY = [ST_LOUIS];

const TRADEPRO_EMAIL = "demo@prosource.com";
const AM_EMAIL = "tessa.brandt@prosource.com";
const HOMEOWNER_EMAIL = "alicia.navarro@email.com";

// The trade pro's profile. Shape mirrors `buildProfilePayload` in
// src/prosource-login.jsx (what onboarding would have written) so Settings and
// the profile surfaces render real values instead of blanks.
const TRADEPRO_PROFILE = {
  email: TRADEPRO_EMAIL,
  firstName: "Justin",
  lastName: "Reyes",
  phone: "(314) 555-0117",
  userType: "tradepro",
  showrooms: TRADEPRO_SHOWROOMS,
  showroom: TRADEPRO_SHOWROOMS[0],
  accountManager: TRADEPRO_SHOWROOMS[0].accountManager,
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
    employees: "6-10",
    projects: "5-10",
    spend: "$20,000-$50,000",
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

// An account manager's own account, seen from her side of the glass.
//
// Deliberately NOT Kim Marks, even though Kim is the account manager the rest of
// the demo already knows: Kim is an AI persona (`demo-kim-marks`), so she is
// someone the demo talks TO. Tessa is a fresh, human-only colleague who staffs
// the same showroom. A showroom having more than one account manager is
// ordinary, so this takes nothing away from Kim being the trade pro's assigned
// rep. Tessa has no `demoIdentity` and appears in no AI persona map, on purpose:
// nobody may ever speak for her but the person signed in as her.
//
// St. Louis specifically, because that is the trade pro account's primary
// showroom, so the quote requests that account sends land in Tessa's queue. An
// AM console over an empty territory would show nothing worth looking at.
//
// `userType: 'accountmanager'` is a pinned contract with the AM console, which
// keys its whole existence off that exact string. It is deliberately a third
// value rather than a flag on 'tradepro': the two existing values only steer
// which onboarding branch runs, and Tessa never onboards.
//
// Her `showroom` is the St. Louis record verbatim, so her `accountManager` is
// Kim, as the invariant below requires (accountManager is always
// showroom.accountManager). For a member of staff that field is a customer
// concept that does not really apply, and it renders as a colleague on the
// customer chrome. That is the same "the app is identical after sign-in"
// cosmetic the two existing userTypes already live with, and not worth
// contorting the showroom record to dodge.
const AM_PROFILE = {
  email: AM_EMAIL,
  firstName: "Tessa",
  lastName: "Brandt",
  phone: "(314) 555-0198",
  userType: "accountmanager",
  showrooms: ST_LOUIS_ONLY,
  showroom: ST_LOUIS_ONLY[0],
  accountManager: ST_LOUIS_ONLY[0].accountManager,
  // Staff, not a business: her "business" is the showroom she works out of, and
  // her address is its address. Filled in rather than left blank so Settings
  // renders a coherent record instead of a half-empty form.
  businessAddress: {
    street: "1801 S Brentwood Blvd",
    city: "St. Louis",
    state: "MO",
    zip: "63144",
  },
  business: {
    name: "ProSource of St. Louis",
    phone: "(314) 968-1900",
    tradeType: "ProSource Showroom",
    businessType: "Showroom",
    licenseNumber: "",
    website: "prosourcefloors.com",
    employees: "6-10",
    projects: "",
    spend: "",
  },
  preferences: {
    showroomUsage: "",
    interests: [],
    currentSuppliers: "",
    upcomingProjects: "",
    hearAbout: "",
    helpedBy: "",
  },
  title: "Account Manager",
  initials: "TB",
  optInTerms: true,
  optInUpdates: true,
  optInConsent: true,
  demo: true,
};

// A fresh homeowner, deliberately nobody who already appears in the demo.
// Bubba Beans and Sarah Chen are the obvious candidates and both are wrong: they
// are AI personas (`demo-bubba-beans`, `demo-sarah-chen`) who answer in their own
// voice, and they are Justin's clients, so signing in as one would be signing in
// as someone the trade pro account is already talking to. Alicia is a St. Louis
// customer in her own right, with one job of her own, no AI persona, no
// `demoIdentity`, and no connection to Justin's jobs at all.
//
// Shape follows `buildProfilePayload`'s homeowner branch (`address`, `project`,
// `workingWith`, `hearAbout`), not the trade pro branch, so it is exactly what
// homeowner onboarding would have written. Every value below is one of the
// options that onboarding actually offers.
const HOMEOWNER_PROFILE = {
  email: HOMEOWNER_EMAIL,
  firstName: "Alicia",
  lastName: "Navarro",
  phone: "(314) 555-0264",
  userType: "homeowner",
  showrooms: ST_LOUIS_ONLY,
  showroom: ST_LOUIS_ONLY[0],
  accountManager: ST_LOUIS_ONLY[0].accountManager,
  address: {
    street: "7319 Delmar Blvd",
    city: "University City",
    state: "MO",
    zip: "63130",
  },
  project: {
    type: "Bathroom remodel",
    rooms: ["bath"],
    budget: "$10k-$25k",
    timeline: "1-3 months",
  },
  workingWith: ["designer"],
  hearAbout: "Drove past a showroom",
  optInMarketing: true,
  optInTerms: true,
  demo: true,
};

/**
 * The three demo accounts. `seed` is the persona key lib/seed.mjs builds a world
 * for; it is passed through rather than inferred from `userType` because the
 * seed and the session are separate contracts and should be free to diverge.
 */
const PERSONAS = {
  tradepro: {
    email: TRADEPRO_EMAIL,
    firstName: TRADEPRO_PROFILE.firstName,
    showrooms: TRADEPRO_SHOWROOMS,
    profile: TRADEPRO_PROFILE,
    seed: "tradepro",
  },
  am: {
    email: AM_EMAIL,
    firstName: AM_PROFILE.firstName,
    showrooms: ST_LOUIS_ONLY,
    profile: AM_PROFILE,
    seed: "am",
    // An account manager is only meaningful next to the members she serves: her
    // whole screen is their outstanding work. Seeding her alone leaves the work
    // queue empty, because the queue is filled when a MEMBER's account is
    // seeded, and nothing says the trade pro was ever signed into first. So
    // seeding her seeds her members too. All of it is idempotent, so this
    // costs a couple of no-op reads when they already exist.
    alsoSeed: ["tradepro", "homeowner"],
  },
  homeowner: {
    email: HOMEOWNER_EMAIL,
    firstName: HOMEOWNER_PROFILE.firstName,
    showrooms: ST_LOUIS_ONLY,
    profile: HOMEOWNER_PROFILE,
    seed: "homeowner",
  },
};

const DEFAULT_PERSONA = "tradepro";

/** Unknown or missing persona is the trade pro, so the original call still works. */
const resolvePersona = (key) => PERSONAS[key] || PERSONAS[DEFAULT_PERSONA];

const blobKey = (userId, key) => `${userId}::${key}`;

/**
 * Throw away everything one demo account owns so the next seed is pristine.
 *
 * The seed markers go with the data they describe. They are listed separately
 * from DEMO_DATA_KEYS on purpose: that list mirrors user-data.mjs's ALLOWED_KEYS
 * and is the data the app itself reads and writes, whereas the markers are the
 * seed's own bookkeeping and no client can touch them. Miss them here and a
 * reset would hand back a wiped account with a marker still swearing it was
 * seeded, which is the one state this whole design is built to prevent.
 */
const wipeDemoAccount = async (userId) => {
  const data = getStore({ name: "ps-user-data", consistency: "strong" });
  await Promise.all([
    ...DEMO_DATA_KEYS.map((key) => data.delete(blobKey(userId, key)).catch(() => {})),
    ...seedMarkerKeys(userId).map((key) => data.delete(key).catch(() => {})),
  ]);
  const users = getStore({ name: "ps-users", consistency: "strong" });
  await users.delete(userId).catch(() => {});
};

/**
 * Bring a profile written before accounts could have more than one showroom up
 * to the current shape. Repair rather than reset: demo accounts already exist in
 * the wild and their profile is only written when absent, so without this a
 * plain sign-in would keep handing back a profile with no `showrooms` until
 * someone thought to pass ?reset=1. A plain load fixes it instead.
 *
 * Purely additive by construction: the primary is whatever the stored profile
 * already called its showroom, so `showroom` and `accountManager` keep their
 * current values and only gain the new list alongside them.
 *
 * `showrooms` is the persona's own list, so a repair can only ever add showrooms
 * that persona genuinely works with.
 */
const withShowrooms = (profile, showrooms) => {
  if (Array.isArray(profile?.showrooms) && profile.showrooms.length) return profile;

  const byId = Object.fromEntries(showrooms.map((s) => [s.id, s]));
  const storedId = profile?.showroom?.id;
  const primary =
    byId[storedId] ||
    // Not one of ours (hand-edited, or a zip that matched another territory):
    // keep it verbatim and just give it the nested shape the contract expects.
    (profile?.showroom
      ? { ...profile.showroom, accountManager: profile.accountManager || null }
      : showrooms[0]);

  const rest = showrooms.filter((s) => s.id !== primary.id);

  return {
    ...profile,
    showrooms: [primary, ...rest],
    showroom: primary,
    accountManager: primary.accountManager,
  };
};

/**
 * Write the persona's profile only if there isn't one, so edits made in the
 * demo stay. An existing profile is still backfilled to the current shape.
 */
const ensureDemoProfile = async (userId, persona) => {
  const users = getStore({ name: "ps-users", consistency: "strong" });
  const existing = await users.get(userId, { type: "json" }).catch(() => null);

  if (existing) {
    const repaired = withShowrooms(existing, persona.showrooms);
    // Only pay for a write when something actually changed.
    if (repaired !== existing) {
      await users.setJSON(userId, { ...repaired, updatedAt: Date.now() });
    }
    return repaired;
  }

  const now = Date.now();
  const profile = { ...persona.profile, userId, createdAt: now, updatedAt: now };
  await users.setJSON(userId, profile);
  return profile;
};

export default async function handler(req) {
  if (req.method !== "POST" && req.method !== "GET") {
    return new Response("Method not allowed", { status: 405 });
  }

  try {
    const url = new URL(req.url);
    const flag = (name) => {
      const raw = url.searchParams.get(name);
      return raw === "1" || raw === "true";
    };
    const reset = flag("reset");
    // "Do not trust the seed marker, go and look." The way back if a marker ever
    // disagrees with reality in a way the seed's own check does not catch. Reset
    // implies it: the wipe takes the marker with it, so the seed that follows has
    // nothing to trust anyway.
    const force = flag("force");

    // GET has no body, and a body-less POST is the original call: both land on
    // the default persona.
    const body =
      req.method === "POST" ? await req.json().catch(() => ({})) : {};
    const personaKey =
      typeof body?.persona === "string" ? body.persona : DEFAULT_PERSONA;
    const persona = resolvePersona(personaKey);

    const email = persona.email;
    const legacyUserId = userIdForEmail(email);

    // Resolve the account through the same email → user mapping the OTP path
    // uses. If it's already registered we reuse that userId verbatim.
    const userStore = getStore("ps-email-to-user");
    let mapping = null;
    try {
      mapping = await userStore.get(email, { type: "json" });
    } catch {}

    const userId = mapping?.userId || legacyUserId;

    if (reset) await wipeDemoAccount(userId);

    if (!mapping?.userId) {
      await userStore.setJSON(email, {
        userId,
        legacyUserId,
        firebaseUid: null,
        createdAt: Date.now(),
        demo: true,
      });
    }

    // Idempotent by design: seedNewUser writes a key only when it's empty, so
    // this fills in whatever is missing (first ever click, or a half-created
    // account from a failed seed) and never touches data that's already there.
    // On an account that already exists it stops at its marker, so the cost of
    // asking is two cheap requests rather than a re-read of the whole world.
    await seedNewUser(userId, persona.seed, { force });

    // Seed the personas this one is meaningless without (see `alsoSeed`).
    // Best effort: this persona's own sign-in must not fail because a related
    // demo account could not be set up.
    //
    // Still one at a time, now that each one is cheap. They look independent,
    // but a world carrying an unpriced quote enqueues onto ONE shared blob
    // (`queue/st-louis`) with a read-modify-write, and only the trade pro
    // carries one today. Running them together would buy a few tens of
    // milliseconds and leave a race for whoever adds a second such world.
    for (const other of persona.alsoSeed || []) {
      const spec = PERSONAS[other];
      if (!spec) continue;
      try {
        await seedNewUser(userIdForEmail(spec.email), spec.seed, { force });
      } catch (err) {
        console.warn(`alsoSeed ${other} failed:`, err.message);
      }
    }

    const profile = await ensureDemoProfile(userId, persona);

    // No Firebase for the demo accounts, so mint the same style of opaque
    // session token otp-verify.mjs falls back to.
    const token = btoa(
      `${userId}:${Date.now()}:${Math.random().toString(36).slice(2)}`
    );

    return Response.json({
      success: true,
      demo: true,
      reset,
      force,
      // Echoed back so the caller can tell which account it actually got when
      // it asked for a persona this endpoint does not know.
      persona: personaKey in PERSONAS ? personaKey : DEFAULT_PERSONA,
      // A demo account is never "new": it's pre-seeded, so no onboarding.
      isNewUser: false,
      user: {
        id: userId,
        email,
        name: persona.firstName,
        firebaseUid: null,
      },
      token,
      userType: profile.userType || persona.profile.userType,
      // Answered from the stored profile, not the constant, so a demo account
      // whose profile was edited signs back in as itself. All three fields come
      // off the same object, so `showroom` is always `showrooms[0]` and
      // `accountManager` is always `showroom.accountManager`.
      showrooms: profile.showrooms || persona.showrooms,
      showroom: profile.showroom || persona.showrooms[0],
      accountManager: profile.accountManager || persona.showrooms[0].accountManager,
      firebase: null,
    });
  } catch (err) {
    console.error("demo-session error:", err);
    return Response.json({ error: err.message }, { status: 500 });
  }
}
