/**
 * Lookup the ProSource showroom and assigned account manager for a given zip code.
 *
 * Production: this should call into the CRM (Salesforce, NetSuite, whichever)
 *   to get the real territory mapping. For the prototype we ship a stubbed
 *   lookup table so the integration shape (POST zip → get { showroom, manager })
 *   matches what the real implementation will be.
 *
 * Replace the body of `lookupCrm()` when wiring up the real CRM API.
 *
 * Showroom shape (shared contract with demo-session.mjs and the client's
 * profile/session): { id, name, address, phone, accountManager: { ... } }.
 * The response still returns the account manager a second time as `manager`,
 * which is the field callers (prosource-login.jsx, submit-quote.mjs) already
 * read. `manager` is always identical to `showroom.accountManager`.
 */

// Stubbed showrooms keyed by zip prefix.
//
// Matching is MOST SPECIFIC FIRST: lookupCrm tries the 5, 4, 3, then 2 digit
// prefix of the zip and takes the first entry that lists that exact key. So a
// territory that needs to carve a few zips out of a neighbouring showroom's
// 3-digit block lists those zips at full 5-digit length (see Fenton below).
//
// INVARIANT: no two entries may list the same prefix. Prefixes of DIFFERENT
// lengths are fine (that is the carve-out mechanism), identical ones are not,
// because then the answer would depend on array order rather than on the
// territory map. assertUniquePrefixes below enforces it at module load.
//
// (Was a real bug: St. Louis and Fenton both listed '630', St. Louis came
// first, and Fenton could therefore never match any zip at all.)
const SHOWROOMS = [
  {
    // St. Louis metro. '630' is the general block; the specific 5-digit zips
    // listed under Fenton are carved out of it and match first.
    prefixes: ['630', '631', '633'],
    showroom: {
      id: 'st-louis',
      name: 'ProSource of St. Louis',
      address: '1801 S Brentwood Blvd, St. Louis, MO 63144',
      phone: '(314) 968-1900',
      accountManager: {
        name: 'Kim Marks',
        title: 'Account Manager',
        email: 'kim.marks@prosource.example',
        phone: '(314) 555-0142',
        initials: 'KM',
        photoColor: '#1a4eb8',
        demoIdentity: 'demo-kim-marks',
      },
    },
  },
  {
    // Fenton area. Full 5-digit zips (Fenton, Eureka, Valley Park, High Ridge,
    // Barnhart), which is what carves them out of St. Louis's '630' block.
    prefixes: ['63026', '63025', '63088', '63049', '63012'],
    showroom: {
      id: 'fenton',
      name: 'ProSource of Fenton',
      address: '650 Gravois Bluffs Blvd, Fenton, MO 63026',
      phone: '(636) 326-3900',
      accountManager: {
        name: 'Heather Yager',
        title: 'Account Manager',
        email: 'heather.yager@prosource.example',
        phone: '(636) 555-0188',
        initials: 'HY',
        photoColor: '#0b69d1',
        demoIdentity: 'demo-heather-yager',
      },
    },
  },
  {
    prefixes: ['606', '607', '608'], // Chicago metro
    showroom: {
      id: 'chicago',
      name: 'ProSource of Chicago',
      address: '2400 W Hubbard St, Chicago, IL 60612',
      phone: '(312) 555-0180',
      accountManager: {
        name: 'Denise Okafor',
        title: 'Account Manager',
        email: 'denise.okafor@prosource.example',
        phone: '(312) 555-0164',
        initials: 'DO',
        photoColor: '#0b6b53',
        demoIdentity: 'demo-denise-okafor',
      },
    },
  },
  {
    prefixes: ['390', '391', '392'], // Mississippi
    showroom: {
      id: 'jackson-ms',
      name: 'ProSource of Jackson, MS',
      address: '1230 N State St, Jackson, MS 39202',
      phone: '(601) 555-0123',
      accountManager: {
        name: 'Marcus Reed',
        title: 'Account Manager',
        email: 'marcus.reed@prosource.example',
        phone: '(601) 555-0166',
        initials: 'MR',
        photoColor: '#0b69d1',
        // No seeded demo persona for Marcus, so he is not messageable.
        demoIdentity: null,
      },
    },
  },
];

const FALLBACK = {
  showroom: {
    id: 'pending',
    name: 'Nearest ProSource showroom',
    address: "We'll match you on your first visit",
    phone: '',
    accountManager: {
      name: 'A ProSource account manager',
      title: 'Account Manager',
      email: '',
      phone: '',
      initials: 'PS',
      photoColor: '#003087',
      demoIdentity: null,
    },
  },
};

/**
 * Guard the invariant above. A duplicate prefix means one of the two entries is
 * silently unreachable, which is exactly the bug this table shipped with, so
 * fail loudly at module load rather than quietly mis-routing zips forever.
 */
const assertUniquePrefixes = () => {
  const seen = new Map();
  for (const entry of SHOWROOMS) {
    for (const prefix of entry.prefixes) {
      const owner = seen.get(prefix);
      if (owner) {
        throw new Error(
          `lookup-showroom: zip prefix '${prefix}' is claimed by both ` +
            `'${owner}' and '${entry.showroom.id}'. Prefixes must be unique: ` +
            `to carve zips out of another showroom's block, list them at full ` +
            `5-digit length instead.`
        );
      }
      seen.set(prefix, entry.showroom.id);
    }
  }
};
assertUniquePrefixes();

function lookupCrm(zip) {
  if (!zip) return { ...FALLBACK, manager: FALLBACK.showroom.accountManager };
  const z = String(zip).trim();
  // Most specific first: 5-digit carve-outs beat a 3-digit metro block.
  for (const len of [5, 4, 3, 2]) {
    const key = z.slice(0, len);
    for (const entry of SHOWROOMS) {
      if (entry.prefixes.includes(key)) {
        return {
          showroom: entry.showroom,
          // Kept for callers that read `manager`. Same object as
          // showroom.accountManager, never a divergent copy.
          manager: entry.showroom.accountManager,
          matchedOn: key,
        };
      }
    }
  }
  return { ...FALLBACK, manager: FALLBACK.showroom.accountManager };
}

export default async function handler(req) {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }
  try {
    const { zip } = await req.json();
    if (!zip || !/^\d{5}(-\d{4})?$/.test(String(zip).trim())) {
      return Response.json({ error: "Valid 5-digit US zip required" }, { status: 400 });
    }
    const result = lookupCrm(zip);
    return Response.json({ success: true, ...result });
  } catch (err) {
    console.error("lookup-showroom error:", err);
    return Response.json({ error: err.message }, { status: 500 });
  }
}
