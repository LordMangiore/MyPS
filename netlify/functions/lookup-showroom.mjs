/**
 * Lookup the ProSource showroom and assigned account manager for a given zip code.
 *
 * Production: this should call into the CRM (Salesforce, NetSuite, whichever)
 *   to get the real territory mapping. For the prototype we ship a stubbed
 *   lookup table so the integration shape (POST zip → get { showroom, manager })
 *   matches what the real implementation will be.
 *
 * Replace the body of `lookupCrm()` when wiring up the real CRM API.
 */

// Stubbed showrooms keyed by zip prefix. Order matters: first match wins.
const SHOWROOMS = [
  {
    prefixes: ['630', '631', '633'], // St. Louis metro
    showroom: {
      id: 'st-louis',
      name: 'ProSource of St. Louis',
      address: '1801 S Brentwood Blvd, St. Louis, MO 63144',
      phone: '(314) 968-1900',
    },
    manager: {
      name: 'Kim Marks',
      title: 'Account Manager',
      email: 'kim.marks@prosource.example',
      phone: '(314) 555-0142',
      initials: 'KM',
      photoColor: '#1a4eb8',
    },
  },
  {
    prefixes: ['630'], // Fenton area (also overlaps STL, kept as fallback)
    showroom: {
      id: 'fenton',
      name: 'ProSource of Fenton',
      address: '650 Gravois Bluffs Blvd, Fenton, MO 63026',
      phone: '(636) 326-3900',
    },
    manager: {
      name: 'Heather Yager',
      title: 'Account Manager',
      email: 'heather.yager@prosource.example',
      phone: '(636) 555-0188',
      initials: 'HY',
      photoColor: '#0b69d1',
    },
  },
  {
    prefixes: ['390', '391', '392'], // Mississippi
    showroom: {
      id: 'jackson-ms',
      name: 'ProSource of Jackson, MS',
      address: '1230 N State St, Jackson, MS 39202',
      phone: '(601) 555-0123',
    },
    manager: {
      name: 'Marcus Reed',
      title: 'Account Manager',
      email: 'marcus.reed@prosource.example',
      phone: '(601) 555-0166',
      initials: 'MR',
      photoColor: '#0b69d1',
    },
  },
];

const FALLBACK = {
  showroom: {
    id: 'pending',
    name: 'Nearest ProSource showroom',
    address: "We'll match you on your first visit",
    phone: '',
  },
  manager: {
    name: 'A ProSource account manager',
    title: 'Account Manager',
    email: '',
    phone: '',
    initials: 'PS',
    photoColor: '#003087',
  },
};

function lookupCrm(zip) {
  if (!zip) return FALLBACK;
  const z = String(zip).trim();
  // Try 5-digit, then 3-digit prefix, then 2.
  for (const len of [5, 4, 3, 2]) {
    const key = z.slice(0, len);
    for (const entry of SHOWROOMS) {
      if (entry.prefixes.includes(key)) {
        return { showroom: entry.showroom, manager: entry.manager, matchedOn: key };
      }
    }
  }
  return FALLBACK;
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
