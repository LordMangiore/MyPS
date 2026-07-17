/**
 * The pros you can look at from "Find a Pro".
 *
 * Demo content, and openly so: these are not accounts. Nobody signs in as them,
 * they have no userId, no blobs and no threads, and that is the whole reason
 * they are allowed to exist as a plain list in the client instead of as seeded
 * accounts. A pro here is something to LOOK AT, which is exactly what the
 * "Find a Pro" errand is.
 *
 * Why a list at all, when there used to be one hardcoded pro: the page rendered
 * the signed-in account's own name and business on top of Mae Reedy's bio,
 * address and reviews, because "your profile" and "a pro's profile" were the
 * same screen reading the same state. So a member browsing pros was shown
 * themselves, wearing a stranger's history. Splitting the two means a pro's
 * profile can come from here and yours can come from your account, and neither
 * has to borrow from the other.
 *
 * NAMES ARE LOAD-BEARING. Nobody here may share a name with a demo persona
 * (Kim Marks, Denise Okafor, Heather Yager, Bubba Beans, Sarah Chen, Ryan
 * O'Toole, Gwen Halloran, Owen Pruitt, Camille Ostrowski) or with an account
 * you can sign in as (Justin Reyes, Tessa Brandt, Alicia Navarro).
 * src/twilio-client.js matches demo contacts BY NAME, so a collision alone is
 * enough to hand one of these a persona's voice, or a persona one of these
 * faces. See netlify/functions/lib/seed.mjs.
 *
 * The reviews are filler, deliberately: they are here to show what a populated
 * profile looks like rather than to be real. What is NOT filler is the
 * arithmetic. The rating, the review count, the star breakdown and the filter
 * tags are all DERIVED from the reviews below rather than written next to them,
 * so the chips can filter to something real and the headline number cannot
 * drift from the list under it. Hand-written counts are what made the old page
 * claim thirty reviews over a list of three.
 */

/**
 * `trades` vs `specialties`, because the two are different questions and one
 * list cannot answer both.
 *
 * `specialties` is what a pro says they do, in their own words, and it is what
 * their profile prints. It is deliberately not a taxonomy: "Small-Space
 * Kitchens" is Priya describing herself.
 *
 * `trades` is the coarse handful the directory filters on, and pros SHARE them.
 * That sharing is the entire point. Filtering the directory on `specialties`
 * gave two dozen chips every one of which read "· 1", because no two people had
 * written the same phrase: a filter that can only ever narrow five pros to one
 * is a list with extra steps.
 */
const TRADES = {
  kitchenBath: 'Kitchen & Bath',
  flooring: 'Flooring',
  tileStone: 'Tile & Stone',
  cabinets: 'Cabinets & Millwork',
  countertops: 'Countertops',
  design: 'Design & Build',
};

/** One review. `tags` drive the filter chips, so they are the review's own. */
const review = (id, name, rating, date, text, details, tags, photos = 0) => ({
  id,
  name,
  initials: name.split(' ').map((w) => w[0]).join('').toUpperCase(),
  rating,
  date,
  source: 'ProSource',
  text,
  details,
  tags,
  photos,
});

export const PROS = [
  // Mae is also the filler your OWN profile borrows its reputation block from
  // (see shownPro in src/prosource-public-profile_1.jsx), which is why, alone
  // among these five, none of her reviews name her: they would be printed under
  // your name on your own page. Everyone else's reviews name them freely,
  // because nothing but their own profile ever renders them.
  {
    id: 'mae-reedy',
    trades: [TRADES.kitchenBath, TRADES.flooring, TRADES.design],
    firstName: 'Mae',
    lastName: 'R.',
    company: 'Mae Reedy Build + Design',
    headline: 'Design-led remodels, run like a build',
    location: 'Allen, TX',
    memberSince: '2021',
    phone: '972-449-0356',
    address: { street: '25 Prestige Circle', city: 'Allen', state: 'TX', zip: '75002' },
    showroom: {
      name: 'ProSource of Allen',
      address: '25 Prestige Circle\nAllen, TX 75002',
      phone: '972-449-0356',
    },
    bio: "Mae Reedy is the founder of Mae Reedy Build + Design, a Dallas-based studio known for pairing design vision with construction precision. Trained in art with roots in textiles and handmade goods, she entered interiors through hands-on collaboration and mentorship, then earned her contractor's license to serve her community when it needed qualified builders. Mae leads with process: clear roadmaps, structured meetings, and visual presentations that reduce friction and keep projects on track.",
    specialties: [
      'Kitchen & Bathroom',
      'Flooring Installation',
      'Interior Design',
      'Remodeling',
      'Room Additions',
      'Architects & Building Design',
    ],
    certifications: [
      { id: 1, name: 'Licensed Contractor', issuer: 'Texas TDLR', date: 'Jan 2021' },
      { id: 2, name: 'Insured', issuer: '', date: '' },
    ],
    stats: { hired: 59, yearsInBusiness: 5, employees: 3, backgroundCheck: true },
    photoCount: 6,
    reviews: [
      review(1, 'Christopher C.', 5, 'Aug 23, 2025',
        'I had an amazing experience from the beginning to the end. Everyone was very timely. They got everything done correctly and left my flooring looking amazing. I would definitely recommend them to all that need new flooring installed in their home.',
        'Luxury vinyl flooring • 751 - 1,000 sq ft • Home', ['floor', 'install', 'vinyl'], 1),
      review(2, 'Teri S.', 5, 'Jul 17, 2025',
        'They came out to provide an estimate on removing my old kitchen floor and hallway. They were on time, professional, and after choosing them for the install, the work was top notch. I will definitely call them again for any flooring type of work.',
        'Laminate • 751 - 1,000 sq ft • Home', ['floor', 'install', 'kitchen']),
      review(3, 'Greg S.', 5, 'Apr 20, 2025',
        'Great to deal with. Both of the guys were on time during installation. They were professional and friendly. The flooring looks great and we are very happy we used them.',
        'Luxury vinyl flooring • 1,001 - 1,500 sq ft • Home', ['floor', 'install', 'vinyl'], 2),
      review(4, 'Lorraine H.', 5, 'Mar 2, 2025',
        'We were walked through three layouts before we picked one, and the drawings matched what actually got built. That never happens. The kitchen came in on the day we were told it would.',
        'Kitchen remodel • Home', ['kitchen', 'project']),
      review(5, 'Devin O.', 4, 'Jan 14, 2025',
        'Really good work and a genuinely nice crew. Took a week longer than the schedule said because of a cabinet backorder, which was not their fault, but I would have liked to hear about it sooner.',
        'Kitchen remodel • Cabinets • Home', ['kitchen', 'project']),
      review(6, 'Annette P.', 5, 'Nov 8, 2024',
        'We had a room addition done and the permits and the inspector were handled without us having to chase anything. The carpet in the new room was matched to the hallway and you cannot see the seam.',
        'Room addition • Carpet • Home', ['carpet', 'project', 'install']),
    ],
  },

  {
    id: 'priya-raghunathan',
    trades: [TRADES.kitchenBath, TRADES.cabinets, TRADES.countertops, TRADES.design],
    firstName: 'Priya',
    lastName: 'R.',
    company: 'Raghunathan Kitchen Studio',
    headline: 'Kitchens for people who actually cook',
    location: 'Clayton, MO',
    memberSince: '2019',
    phone: '(314) 555-0193',
    address: { street: '7730 Forsyth Blvd', city: 'Clayton', state: 'MO', zip: '63105' },
    showroom: {
      name: 'ProSource of St. Louis',
      address: '1801 S Brentwood Blvd\nSt. Louis, MO 63144',
      phone: '(314) 968-1900',
    },
    bio: 'Priya Raghunathan spent eleven years cooking professionally before she ever drew a kitchen, and it shows in the ones she builds: work triangles that hold up on a Saturday night, landing space beside the ovens, and drawers where you actually reach for them. Her studio takes on six kitchens a year and no more, because she runs every one of them herself from the first measure to the last handle.',
    specialties: [
      'Kitchen Remodel',
      'Cabinet Design',
      'Countertops',
      'Lighting Plans',
      'Small-Space Kitchens',
    ],
    certifications: [
      { id: 1, name: 'Certified Kitchen Designer', issuer: 'NKBA', date: 'Mar 2019' },
      { id: 2, name: 'Licensed Contractor', issuer: 'Missouri DPR', date: 'Aug 2018' },
      { id: 3, name: 'Insured', issuer: '', date: '' },
    ],
    stats: { hired: 38, yearsInBusiness: 7, employees: 4, backgroundCheck: true },
    photoCount: 8,
    reviews: [
      review(1, 'Marguerite V.', 5, 'Jun 30, 2026',
        'She asked me how I cook before she asked me what I liked. Nobody had ever done that. The pot filler she talked me out of would have been a waste and the second prep sink she talked me into gets used every single day.',
        'Kitchen remodel • Home', ['kitchen', 'project']),
      review(2, 'Hollis B.', 5, 'May 12, 2026',
        'Priya caught that our island was going to block the fridge door at the drawing stage. Moved it four inches and the whole thing works. Attention to detail all the way through.',
        'Kitchen remodel • Cabinets • Home', ['kitchen', 'cabinets']),
      review(3, 'Renata K.', 5, 'Feb 25, 2026',
        'Quartz counters and a full cabinet replacement in a 1920s house where nothing is square. She templated twice rather than guess. Seams are invisible.',
        'Countertops • Cabinets • Home', ['countertops', 'cabinets', 'install']),
      review(4, 'Tobias E.', 4, 'Dec 3, 2025',
        'Excellent design work and the finished kitchen is beautiful. Communication went quiet for about ten days in the middle while she was on another job, which was the only frustrating part.',
        'Kitchen remodel • Home', ['kitchen', 'project']),
      review(5, 'Suzanne A.', 5, 'Sep 19, 2025',
        'Tiny galley kitchen in a condo. I expected to be told it could not be improved. Instead she found six inches nobody else had seen and the whole room breathes now.',
        'Kitchen remodel • Under 250 sq ft • Condo', ['kitchen', 'project']),
    ],
  },

  {
    id: 'desmond-whitlock',
    trades: [TRADES.flooring],
    firstName: 'Desmond',
    lastName: 'W.',
    company: 'Whitlock Hardwood Co.',
    headline: 'Hardwood, and nothing but',
    location: 'Kirkwood, MO',
    memberSince: '2016',
    phone: '(314) 555-0148',
    address: { street: '218 N Kirkwood Rd', city: 'Kirkwood', state: 'MO', zip: '63122' },
    showroom: {
      name: 'ProSource of St. Louis',
      address: '1801 S Brentwood Blvd\nSt. Louis, MO 63144',
      phone: '(314) 968-1900',
    },
    bio: 'Desmond Whitlock has been laying and refinishing hardwood in St. Louis county since 2009, and he does not do anything else. No tile, no carpet, no cabinets. His crew of six are all people he trained, and he still sands the last pass on every floor himself because, in his words, it is the part you cannot fix later.',
    specialties: [
      'Hardwood Installation',
      'Floor Refinishing',
      'Engineered Wood',
      'Stair Treads',
      'Historic Restoration',
    ],
    certifications: [
      { id: 1, name: 'Certified Wood Flooring Installer', issuer: 'NWFA', date: 'Jun 2016' },
      { id: 2, name: 'Insured', issuer: '', date: '' },
    ],
    stats: { hired: 214, yearsInBusiness: 17, employees: 6, backgroundCheck: true },
    photoCount: 12,
    reviews: [
      review(1, 'Bernadette Q.', 5, 'Jul 2, 2026',
        'Hundred year old white oak under three layers of carpet and glue. Everyone else told me to tear it out. Desmond brought it back. I cried a little, honestly.',
        'Floor refinishing • 1,001 - 1,500 sq ft • Home', ['floor', 'install', 'project'], 3),
      review(2, 'Cyrus M.', 5, 'Apr 28, 2026',
        'On time every day, dust containment was serious, and they were gone when they said they would be. The stair treads match the floor exactly.',
        'Hardwood • Stairs • Home', ['floor', 'install'], 1),
      review(3, 'Delphine T.', 5, 'Feb 9, 2026',
        'He told me the engineered plank I picked was wrong for a basement slab and steered me to something else that cost him money. That is who you want doing your floors.',
        'Engineered wood • 751 - 1,000 sq ft • Basement', ['floor', 'install']),
      review(4, 'Ignatius R.', 5, 'Nov 21, 2025',
        'Quiet, fast, and the finish is flawless. Third house I have used him on.',
        'Hardwood • 1,501 - 2,000 sq ft • Home', ['floor', 'install']),
      review(5, 'Priscilla N.', 4, 'Aug 15, 2025',
        'The floor is genuinely beautiful. Scheduling took two months to get on the calendar, so plan ahead if you want him.',
        'Hardwood • 501 - 750 sq ft • Home', ['floor', 'project']),
      review(6, 'Malachi D.', 5, 'Jun 4, 2025',
        'Matched new oak into an existing floor after we took a wall out. You cannot find the join. I have looked.',
        'Hardwood • Repair • Home', ['floor', 'install', 'project'], 2),
    ],
  },

  {
    id: 'nora-espinoza',
    trades: [TRADES.tileStone, TRADES.kitchenBath, TRADES.flooring, TRADES.countertops],
    firstName: 'Nora',
    lastName: 'E.',
    company: 'Espinoza Tile & Stone',
    headline: 'Tile, stone, and very straight lines',
    location: 'Oak Park, IL',
    memberSince: '2020',
    phone: '(312) 555-0176',
    address: { street: '1104 Lake St', city: 'Oak Park', state: 'IL', zip: '60301' },
    showroom: {
      name: 'ProSource of Chicago',
      address: '2350 N Elston Ave\nChicago, IL 60614',
      phone: '(312) 555-0100',
    },
    bio: 'Nora Espinoza runs a four-person tile and stone shop out of Oak Park. She came up setting tile with her father and took over the business in 2020. She is known for two things: layouts that centre on the room rather than the wall she started from, and telling you exactly what a slab will cost before it is cut.',
    specialties: [
      'Tile & Stone',
      'Bathroom Remodel',
      'Backsplashes',
      'Shower Systems',
      'Heated Floors',
    ],
    certifications: [
      { id: 1, name: 'Certified Tile Installer', issuer: 'CTEF', date: 'May 2020' },
      { id: 2, name: 'Licensed Contractor', issuer: 'Illinois IDFPR', date: 'Feb 2020' },
      { id: 3, name: 'Insured', issuer: '', date: '' },
    ],
    stats: { hired: 91, yearsInBusiness: 6, employees: 4, backgroundCheck: true },
    photoCount: 9,
    reviews: [
      review(1, 'Wendell F.', 5, 'Jun 18, 2026',
        'The shower niche lines up with the tile courses on both walls. I did not even know to ask for that. She just did it.',
        'Tile • Bathroom • Home', ['tile', 'bath', 'install'], 2),
      review(2, 'Clementine J.', 5, 'Apr 3, 2026',
        'Nora priced the slab, the fabrication and the waste up front and the final invoice matched to the dollar. After two other quotes that moved on me, that was worth everything.',
        'Stone • Countertops • Home', ['countertops', 'project']),
      review(3, 'Ambrose L.', 5, 'Jan 30, 2026',
        'Heated floor under porcelain in a bathroom that used to be freezing. Works perfectly and the thermostat is where I can reach it.',
        'Tile • Bathroom • Heated floor • Home', ['tile', 'bath', 'floor', 'install']),
      review(4, 'Rosalind V.', 4, 'Oct 22, 2025',
        'Beautiful backsplash and a fair price. There was a mix-up on the grout colour that took a week to sort out, though she fixed it at her own cost.',
        'Tile • Backsplash • Kitchen', ['tile', 'kitchen']),
      review(5, 'Fitzgerald B.', 5, 'Jul 11, 2025',
        'Small job, a powder room floor. Treated it like it mattered. Showed up when she said, cleaned up after herself, done in a day.',
        'Tile • Under 250 sq ft • Home', ['tile', 'floor', 'install']),
    ],
  },

  {
    id: 'aaron-delacroix',
    trades: [TRADES.cabinets, TRADES.design],
    firstName: 'Aaron',
    lastName: 'D.',
    company: 'Delacroix Carpentry',
    headline: 'Built-ins, cabinets, and honest scope',
    location: 'Webster Groves, MO',
    memberSince: '2022',
    phone: '(314) 555-0221',
    address: { street: '45 W Lockwood Ave', city: 'Webster Groves', state: 'MO', zip: '63119' },
    showroom: {
      name: 'ProSource of St. Louis',
      address: '1801 S Brentwood Blvd\nSt. Louis, MO 63144',
      phone: '(314) 968-1900',
    },
    bio: 'Aaron Delacroix builds cabinets and built-ins out of a shop in Webster Groves, mostly for houses old enough to have opinions. He works alone by choice, takes one job at a time, and will tell you when what you want is not worth what it costs. Expect a wait and a very small punch list.',
    specialties: [
      'Custom Cabinets',
      'Built-Ins',
      'Trim & Millwork',
      'Cabinet Refacing',
      'Bookcases',
    ],
    certifications: [
      { id: 1, name: 'Licensed Contractor', issuer: 'Missouri DPR', date: 'Apr 2022' },
      { id: 2, name: 'Insured', issuer: '', date: '' },
    ],
    stats: { hired: 27, yearsInBusiness: 4, employees: 1, backgroundCheck: true },
    photoCount: 5,
    reviews: [
      review(1, 'Winifred S.', 5, 'May 27, 2026',
        'Talked me out of a full cabinet replacement and refaced them instead for a third of the price. They look new. He left money on the table to do the right thing.',
        'Cabinets • Refacing • Kitchen', ['cabinets', 'kitchen', 'project']),
      review(2, 'Barnaby H.', 5, 'Mar 8, 2026',
        'Built-in bookcases either side of a chimney breast that is not square to anything. They look like they were always there. Scribed to the plaster perfectly.',
        'Built-ins • Home', ['cabinets', 'install'], 2),
      review(3, 'Odessa W.', 5, 'Dec 15, 2025',
        'One man, one job at a time, and you feel it. He was here every day until it was done and the punch list was two items, both fixed the same afternoon.',
        'Custom cabinets • Kitchen', ['cabinets', 'kitchen']),
      review(4, 'Leopold G.', 4, 'Sep 2, 2025',
        'The work is genuinely first class. You do wait, though. I was on his list four months before he started, which he told me honestly up front.',
        'Trim & millwork • Home', ['project']),
    ],
  },
];

/** A pro by id, or null. Null is a real answer: a bad URL is not a pro. */
export const findPro = (id) => PROS.find((p) => p.id === id) || null;

export const proFullName = (pro) => `${pro.firstName} ${pro.lastName}`;

export const proInitials = (pro) =>
  `${pro.firstName[0]}${(pro.lastName[0] || '').replace('.', '')}`.toUpperCase();

/**
 * Everything the profile page used to state as a literal, computed from the
 * reviews instead. The numbers and the list they describe cannot disagree,
 * which is the only reason the filter chips below are safe to make real.
 */
export const ratingOf = (pro) =>
  pro.reviews.length
    ? pro.reviews.reduce((sum, r) => sum + r.rating, 0) / pro.reviews.length
    : 0;

export const reviewCountOf = (pro) => pro.reviews.length;

/** Star distribution, highest first, as whole percents of the review list. */
export const reviewBreakdownOf = (pro) => {
  const total = pro.reviews.length || 1;
  return [5, 4, 3, 2, 1].map((stars) => ({
    stars,
    percent: Math.round(
      (pro.reviews.filter((r) => Math.round(r.rating) === stars).length / total) * 100
    ),
  }));
};

/**
 * The filter chips, in descending order of how much there is to see. "All"
 * leads and every other chip counts the reviews it will actually show, because
 * a chip that promises eleven and shows one is worse than no chip at all.
 */
export const reviewTagsOf = (pro) => {
  const counts = new Map();
  pro.reviews.forEach((r) => (r.tags || []).forEach((t) => counts.set(t, (counts.get(t) || 0) + 1)));
  return [
    { id: 'all', label: 'All', count: pro.reviews.length },
    ...[...counts.entries()]
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .map(([id, count]) => ({ id, label: id, count })),
  ];
};

export const reviewsForTag = (pro, tag) =>
  tag === 'all' ? pro.reviews : pro.reviews.filter((r) => (r.tags || []).includes(tag));
