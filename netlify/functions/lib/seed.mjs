import { getStore } from "@netlify/blobs";

/**
 * Seed a brand-new user's blob with sample data so the demo looks populated
 * the moment they finish signup. Safe to call multiple times: only writes if
 * the key is empty.
 *
 * Called on every sign-in, so from the second call onwards it usually stops
 * early: a version marker records what was already seeded, and a cheap check
 * against reality decides whether to trust it. See SEED_VERSION and
 * seededContentIsIntact.
 */

const days = (n) => 24 * 60 * 60 * 1000 * n;
const minutes = (n) => 60 * 1000 * n;

const fmtTime = (ts) =>
  new Date(ts).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });

const fmtDate = (ts) => {
  const d = new Date(ts);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const that = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const diffDays = Math.round((today - that) / (24 * 60 * 60 * 1000));
  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) {
    return d.toLocaleDateString("en-US", { weekday: "long" });
  }
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
};

const fmtRelativeTimestamp = (ts) => {
  const d = new Date(ts);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const that = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const diffDays = Math.round((today - that) / (24 * 60 * 60 * 1000));
  if (diffDays === 0) return fmtTime(ts);
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return d.toLocaleDateString("en-US", { weekday: "short" });
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
};

// Rooms are real entities: { id, name, type?, squareFootage?, notes?, createdAt }.
// The id must match `roomIdFromName` in src/project-model.js. That's the
// contract that lets the client migrate legacy string rooms onto the same ids.
const room = (name, createdAt, extra = {}) => ({
  id: `room-${name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')}`,
  name,
  createdAt,
  ...extra,
});

// Product lines on a project. Shape mirrors the shop's cart snapshot plus a
// roomId (null = Unassigned). SKUs match the storefront catalog's
// `sku-<productId>` convention, so re-adding one of these from /shop merges
// into the existing line instead of duplicating it.
const product = (fields) => ({ qty: 1, roomId: null, ...fields });

const IMG = {
  oak: 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=500&h=500&fit=crop',
  lvp: 'https://images.unsplash.com/photo-1581858726788-75bc0f6a952d?w=500&h=500&fit=crop',
  tile: 'https://images.unsplash.com/photo-1600566753190-17f0baa2a6c3?w=500&h=500&fit=crop',
  quartz: 'https://images.unsplash.com/photo-1600585152220-90363fe7e115?w=500&h=500&fit=crop',
  cabinet: 'https://images.unsplash.com/photo-1600489000022-c2086d79f9d4?w=500&h=500&fit=crop',
};

// Project seed builder. IDs are stable per call so seeded messages can
// cross-reference projects via projectId.
const buildSeedProjects = (now) => {
  const ids = {
    working: `seed-${now}-working`,
    complete: `seed-${now}-complete`,
    published: `seed-${now}-published`,
  };

  // Team members on each project. Showroom team (Kim + Heather) appears
  // everywhere; clients + contractors are project-specific.
  const teamMember = (id, name, initials, role, type) => ({
    connectionId: id, name, initials, role, type, addedAt: now - days(14),
  });
  const showroomTeam = [
    teamMember(1, 'Kim Marks', 'KM', 'Account Manager', 'prosource'),
    teamMember(2, 'Heather Yager', 'HY', 'Designer', 'prosource'),
  ];

  return {
    ids,
    payload: {
      list: [
        {
          id: ids.working,
          name: "Beans Kitchen Remodel",
          type: "Kitchen Remodel",
          // The showroom SUPPLYING the job, per src/project-model.js. Every
          // seeded project is a St. Louis job and says so three times over (its
          // address, Kim as its account manager on the team, and the
          // 'ProSource of St. Louis' stamped on its seeded orders), so that is
          // what they carry. Without this they render "No showroom assigned".
          //
          // Deliberately NOT 'chicago' on any of them: project detail resolves
          // the header's account manager FROM this id, so flipping one to
          // Chicago would print "Denise Okafor" above a team whose account
          // manager is Kim and orders that say St. Louis. Chicago earns its
          // place in the demo honestly instead: Denise is on this project's
          // team (she supplies its LVP), she is a connection with her own
          // thread, and creating a project lets you pick her showroom.
          showroomId: 'st-louis',
          team: [
            ...showroomTeam,
            // The account's second showroom (Chicago) reaches the demo through
            // this one project: Denise is on the team because the LVP for this
            // kitchen is being sourced out of Chicago, which is the whole reason
            // an account works with more than one showroom. Her seeded thread
            // (buildSeedMessages / twilio-conversations DEMO_DETAILS) is that
            // same conversation, so the connection, the project and the thread
            // all tell one story.
            teamMember(8, 'Denise Okafor', 'DO', 'Account Manager', 'prosource'),
            teamMember(3, 'Bubba Beans', 'BB', 'Homeowner', 'client'),
            teamMember(5, "Ryan O'Toole", 'RO', 'Flooring Installer', 'tradepro'),
          ],
          description:
            "Full gut renovation. Existing oak cabinets and laminate counters out; quartz, slow-close shaker boxes, and herringbone backsplash in. Goal is open sight-line from kitchen into dining.",
          address: "1234 Oak Street, St. Louis, MO 63101",
          budgetRange: "$25,000 - $50,000",
          targetStart: new Date(now + days(7)).toISOString().slice(0, 10),
          targetCompletion: new Date(now + days(75)).toISOString().slice(0, 10),
          squareFootage: "180",
          rooms: [
            room('Kitchen', now - days(14), { type: 'Kitchen', squareFootage: '180', notes: 'Sight-line to dining stays open. No upper cabinets on the south wall.' }),
            room('Pantry', now - days(12), { type: 'Pantry', squareFootage: '32' }),
          ],
          products: [
            product({
              id: 'prod-006', sku: 'sku-prod-006', name: 'KraftMaid Durham Maple Shaker Cabinet',
              brand: 'KraftMaid', category: 'Cabinets', colorName: 'Dove White',
              price: 485.0, unit: 'EA', qty: 14, image: IMG.cabinet,
              roomId: 'room-kitchen', addedAt: now - days(9),
            }),
            product({
              id: 'prod-005', sku: 'sku-prod-005', name: 'Silestone Calacatta Gold Quartz Countertop',
              brand: 'Silestone', category: 'Countertops', colorName: 'Calacatta Gold',
              price: 72.0, unit: 'SF', qty: 46, image: IMG.quartz,
              roomId: 'room-kitchen', addedAt: now - days(8),
            }),
            product({
              id: 'prod-003', sku: 'sku-prod-003', name: 'Daltile Perpetuo Porcelain Floor Tile 12x24',
              brand: 'Daltile', category: 'Tile & Stone', colorName: 'Brilliant White',
              price: 6.49, unit: 'SF', sfPerBox: 15.6, qty: 3, image: IMG.tile,
              roomId: 'room-pantry', addedAt: now - days(6),
            }),
            // Deliberately unassigned: shows the "Unassigned" group and gives
            // the demo something to drag into a room.
            product({
              id: 'prod-002', sku: 'sku-prod-002', name: 'COREtec Pro Plus Enhanced Luxury Vinyl Plank',
              brand: 'COREtec', category: 'LVP / LVT', colorName: 'Pembroke Pine',
              price: 4.99, unit: 'SF', sfPerBox: 36.64, qty: 2, image: IMG.lvp,
              roomId: null, addedAt: now - days(2),
            }),
          ],
          notes:
            "Client prefers appointments after 2pm. Dog in backyard, use side gate.",
          status: "working",
          archived: false,
          createdAt: now - days(14),
          updatedAt: now - days(2),
        },
        {
          id: ids.complete,
          name: "Wilson Master Bath",
          type: "Bathroom Remodel",
          showroomId: 'st-louis',
          team: [
            ...showroomTeam,
            teamMember(5, "Ryan O'Toole", 'RO', 'Flooring Installer', 'tradepro'),
            teamMember(7, 'Mike Torres', 'MT', 'Tile Installer', 'tradepro'),
          ],
          description:
            "Curbless walk-in shower with linear drain, double vanity in rift-cut white oak, heated floors. Punch list closed Friday.",
          address: "508 Linden Ave, St. Louis, MO 63119",
          budgetRange: "$15,000 - $25,000",
          targetStart: new Date(now - days(95)).toISOString().slice(0, 10),
          targetCompletion: new Date(now - days(20)).toISOString().slice(0, 10),
          squareFootage: "90",
          rooms: [
            room('Master Bathroom', now - days(110), { type: 'Bathroom', squareFootage: '90', notes: 'Curbless shower, floor slopes to the linear drain.' }),
          ],
          products: [
            product({
              id: 'prod-003', sku: 'sku-prod-003', name: 'Daltile Perpetuo Porcelain Floor Tile 12x24',
              brand: 'Daltile', category: 'Tile & Stone', colorName: 'Brilliant White',
              price: 6.49, unit: 'SF', sfPerBox: 15.6, qty: 7, image: IMG.tile,
              roomId: 'room-master-bathroom', addedAt: now - days(80),
            }),
            product({
              id: 'prod-005', sku: 'sku-prod-005', name: 'Silestone Calacatta Gold Quartz Countertop',
              brand: 'Silestone', category: 'Countertops', colorName: 'Calacatta Gold',
              price: 72.0, unit: 'SF', qty: 12, image: IMG.quartz,
              roomId: 'room-master-bathroom', addedAt: now - days(78),
            }),
          ],
          notes:
            "Client has been great. Watch for tile manufacturer recall on the wall mosaic (bumped to v2 lot).",
          status: "complete",
          archived: false,
          createdAt: now - days(110),
          updatedAt: now - days(20),
        },
        {
          id: ids.published,
          name: "Chen Outdoor Patio & Outdoor Kitchen",
          type: "Other",
          showroomId: 'st-louis',
          team: [
            ...showroomTeam,
            teamMember(4, 'Sarah Chen', 'SC', 'Homeowner', 'client'),
            teamMember(6, 'James Anderson', 'JA', 'General Contractor', 'tradepro'),
          ],
          description:
            "Travertine pavers, built-in grill island with granite, integrated low-voltage lighting. Showcase build for our portfolio.",
          address: "44 Whispering Pines Dr, Chesterfield, MO 63017",
          budgetRange: "$50,000 - $100,000",
          targetStart: new Date(now - days(200)).toISOString().slice(0, 10),
          targetCompletion: new Date(now - days(95)).toISOString().slice(0, 10),
          squareFootage: "640",
          rooms: [
            room('Outdoor/Patio', now - days(220), { type: 'Outdoor', squareFootage: '520' }),
            room('Grill Island', now - days(210), { type: 'Outdoor', squareFootage: '120' }),
          ],
          products: [
            product({
              id: 'prod-003', sku: 'sku-prod-003', name: 'Daltile Perpetuo Porcelain Floor Tile 12x24',
              brand: 'Daltile', category: 'Tile & Stone', colorName: 'Brilliant White',
              price: 6.49, unit: 'SF', sfPerBox: 15.6, qty: 34, image: IMG.tile,
              roomId: 'room-outdoor-patio', addedAt: now - days(180),
            }),
            product({
              id: 'prod-005', sku: 'sku-prod-005', name: 'Silestone Calacatta Gold Quartz Countertop',
              brand: 'Silestone', category: 'Countertops', colorName: 'Calacatta Gold',
              price: 72.0, unit: 'SF', qty: 18, image: IMG.quartz,
              roomId: 'room-grill-island', addedAt: now - days(175),
            }),
          ],
          notes:
            "Owner okayed photos for our public profile and ProSource case study.",
          status: "published",
          archived: false,
          createdAt: now - days(220),
          updatedAt: now - days(60),
        },
      ],
    },
  };
};

// Message seed builder. Each thread references one of the seeded projects.
const buildSeedMessages = (now, projectIds) => {
  const kimMsg2 = now - minutes(28);
  const kimMsg1 = now - minutes(75);

  const bubbaMsg2 = now - days(1) - minutes(30);
  const bubbaMsg1 = now - days(1) - minutes(120);

  const ryanMsg2 = now - days(3);
  const ryanMsg1 = now - days(3) - minutes(90);

  const sarahMsg2 = now - days(8);
  const sarahMsg1 = now - days(8) - minutes(20);

  const heatherMsg = now - days(14);

  const deniseMsg2 = now - days(2);
  const deniseMsg1 = now - days(2) - minutes(45);

  return {
    threads: [
      {
        id: 1,
        projectId: projectIds.working,
        name: "Kim Marks",
        initials: "KM",
        type: "prosource",
        role: "Account Manager",
        lastMessage:
          "I also have the tile samples for the Beans kitchen ready for pickup at the showroom.",
        timestamp: fmtRelativeTimestamp(kimMsg2),
        unread: true,
        updatedAt: kimMsg2,
        messages: [
          {
            id: 1,
            sender: "Kim Marks",
            isMe: false,
            text:
              "Hi! Just wanted to let you know the Shaw LVP samples for the Beans kitchen came in.",
            time: fmtTime(kimMsg1),
            date: fmtDate(kimMsg1),
            timestamp: kimMsg1,
          },
          {
            id: 2,
            sender: "Me",
            isMe: true,
            text:
              "Great! Can you hold a few in the Greige Oak and the Smoked Walnut?",
            time: fmtTime(kimMsg1 + minutes(30)),
            date: fmtDate(kimMsg1 + minutes(30)),
            timestamp: kimMsg1 + minutes(30),
          },
          {
            id: 3,
            sender: "Kim Marks",
            isMe: false,
            text:
              "Absolutely! I also have the tile samples for the Beans kitchen ready for pickup at the showroom.",
            time: fmtTime(kimMsg2),
            date: fmtDate(kimMsg2),
            timestamp: kimMsg2,
          },
        ],
      },
      {
        id: 2,
        projectId: projectIds.working,
        name: "Bubba Beans",
        initials: "BB",
        type: "client",
        role: "Homeowner: Beans Kitchen Remodel",
        lastMessage:
          "Sounds good, I'll be at the showroom Saturday morning to look at the LVP.",
        timestamp: fmtRelativeTimestamp(bubbaMsg2),
        unread: false,
        updatedAt: bubbaMsg2,
        messages: [
          {
            id: 1,
            sender: "Me",
            isMe: true,
            text:
              "Hey Bubba, Kim has a couple of LVP samples set aside for the kitchen. Want to come look this weekend?",
            time: fmtTime(bubbaMsg1),
            date: fmtDate(bubbaMsg1),
            timestamp: bubbaMsg1,
          },
          {
            id: 2,
            sender: "Bubba Beans",
            isMe: false,
            text:
              "Sounds good, I'll be at the showroom Saturday morning to look at the LVP.",
            time: fmtTime(bubbaMsg2),
            date: fmtDate(bubbaMsg2),
            timestamp: bubbaMsg2,
          },
        ],
      },
      {
        id: 3,
        projectId: projectIds.complete,
        name: "Ryan O'Toole",
        initials: "RO",
        type: "tradepro",
        role: "Flooring Installer",
        lastMessage:
          "All wrapped on the Wilson bath. Ready for the next one whenever you are.",
        timestamp: fmtRelativeTimestamp(ryanMsg2),
        unread: true,
        updatedAt: ryanMsg2,
        messages: [
          {
            id: 1,
            sender: "Me",
            isMe: true,
            text:
              "Thanks again for hustling on the Wilson bath install. Clients are thrilled.",
            time: fmtTime(ryanMsg1),
            date: fmtDate(ryanMsg1),
            timestamp: ryanMsg1,
          },
          {
            id: 2,
            sender: "Ryan O'Toole",
            isMe: false,
            text:
              "All wrapped on the Wilson bath. Ready for the next one whenever you are.",
            time: fmtTime(ryanMsg2),
            date: fmtDate(ryanMsg2),
            timestamp: ryanMsg2,
          },
        ],
      },
      {
        id: 4,
        projectId: projectIds.published,
        name: "Sarah Chen",
        initials: "SC",
        type: "client",
        role: "Homeowner: Chen Outdoor Patio",
        lastMessage:
          "We finally got the family photos done on the patio and it looks incredible. Thanks again!",
        timestamp: fmtRelativeTimestamp(sarahMsg2),
        unread: false,
        updatedAt: sarahMsg2,
        messages: [
          {
            id: 1,
            sender: "Me",
            isMe: true,
            text:
              "Hi Sarah, wanted to check in. Anything we should adjust before we put the patio in our portfolio?",
            time: fmtTime(sarahMsg1),
            date: fmtDate(sarahMsg1),
            timestamp: sarahMsg1,
          },
          {
            id: 2,
            sender: "Sarah Chen",
            isMe: false,
            text:
              "We finally got the family photos done on the patio and it looks incredible. Thanks again!",
            time: fmtTime(sarahMsg2),
            date: fmtDate(sarahMsg2),
            timestamp: sarahMsg2,
          },
        ],
      },
      {
        id: 5,
        projectId: projectIds.published,
        name: "Heather Yager",
        initials: "HY",
        type: "prosource",
        role: "Designer",
        lastMessage:
          "Uploaded the Chen patio render variants. Let me know which lighting layout you want me to spec out.",
        timestamp: fmtRelativeTimestamp(heatherMsg),
        unread: false,
        updatedAt: heatherMsg,
        messages: [
          {
            id: 1,
            sender: "Heather Yager",
            isMe: false,
            text:
              "Uploaded the Chen patio render variants. Let me know which lighting layout you want me to spec out.",
            time: fmtTime(heatherMsg),
            date: fmtDate(heatherMsg),
            timestamp: heatherMsg,
          },
        ],
      },
      // The Chicago showroom's account manager. Same conversation as her Twilio
      // history in twilio-conversations.mjs, so the thread reads identically
      // whether Messages is running against Twilio or against this blob.
      {
        id: 6,
        projectId: projectIds.working,
        name: "Denise Okafor",
        initials: "DO",
        type: "prosource",
        role: "Account Manager",
        lastMessage:
          "Our truck runs to St. Louis on Thursdays. Get me the square footage today and it goes on this week's run.",
        timestamp: fmtRelativeTimestamp(deniseMsg2),
        unread: true,
        updatedAt: deniseMsg2,
        messages: [
          {
            id: 1,
            sender: "Denise Okafor",
            isMe: false,
            text:
              "Denise at ProSource Chicago. Kim looped me in on the Beans kitchen: the Pembroke Pine LVP is back-ordered out of St. Louis and I have it on the floor here.",
            time: fmtTime(deniseMsg1),
            date: fmtDate(deniseMsg1),
            timestamp: deniseMsg1,
          },
          {
            id: 2,
            sender: "Me",
            isMe: true,
            text: "Good to know. What would it take to get it down to us?",
            time: fmtTime(deniseMsg1 + minutes(20)),
            date: fmtDate(deniseMsg1 + minutes(20)),
            timestamp: deniseMsg1 + minutes(20),
          },
          {
            id: 3,
            sender: "Denise Okafor",
            isMe: false,
            text:
              "Our truck runs to St. Louis on Thursdays. Get me the square footage today and it goes on this week's run.",
            time: fmtTime(deniseMsg2),
            date: fmtDate(deniseMsg2),
            timestamp: deniseMsg2,
          },
        ],
      },
    ],
  };
};

// Seeded orders + estimates, tied to the seeded projects so /orders isn't empty
// and each project's "Estimates & Orders" tab has something to show.
//
// Contract with src/order-model.js (`ORDERS_SCHEMA_VERSION`):
//   docType: 'estimate' → a quote awaiting the customer's decision
//   docType: 'order'    → an estimate they approved
// The client migrates schemaVersion-less blobs on read, so bumping the version
// here is only about letting seedNewUser replace a stale seed.
const ORDERS_SCHEMA_VERSION = 2;

const round2 = (n) => Math.round(n * 100) / 100;

// Rough blended MO rate. One constant so every seeded document taxes the same.
const TAX_RATE = 0.08;

// A line on a document. `subtotal` is always qty x unitPrice, never hand-typed,
// so a document's totals can't drift from the lines that make it up.
const orderLine = ({ category, product, color, brand, qty, unit, unitPrice, status }) => ({
  category,
  product,
  color,
  brand,
  qty,
  unit,
  quantity: `${qty} ${unit}`,
  unitPrice,
  subtotal: round2(qty * unitPrice),
  status,
});

const usDate = (ts) => new Date(ts).toLocaleDateString('en-US');

// One document. Every money figure is derived: material from the lines, tax from
// material, total from both, balance from what's been paid. Nothing to keep in
// sync by hand.
//
// `soldTo` and `showroom` are the account's, so they're bound once per persona
// by the caller below rather than repeated on every document.
const buildDoc = (soldTo, showroom) => ({
  id,
  docType,
  projectId,
  jobName,
  client,
  date,
  expectedDelivery = null,
  status,
  statusText,
  paidRatio = 0,
  service = 0,
  referralBonus = null,
  lines,
}) => {
  const material = round2(lines.reduce((sum, l) => sum + l.subtotal, 0));
  const salesTax = round2(material * TAX_RATE);
  const invoiceTotal = round2(material + salesTax + service);
  const totalPaid = round2(invoiceTotal * paidRatio);
  return {
    id,
    docType,
    projectId: projectId || null,
    jobName,
    client,
    orderDate: usDate(date),
    orderDateTs: date,
    expectedDelivery,
    status,
    statusText,
    soldTo,
    showroom,
    material,
    salesTax,
    service,
    invoiceTotal,
    totalPaid,
    balanceDue: round2(invoiceTotal - totalPaid),
    referralBonus,
    lineItems: lines,
  };
};

/**
 * A quote the member has sent in that nobody has priced yet.
 *
 * Deliberately NOT built with `buildDoc`: that derives every money field from
 * the lines, and the defining property of a requested quote is that it has no
 * money on it at all. null means "not priced yet" (0 would mean "free"), which
 * is precisely the state the account manager's work queue exists to resolve.
 * The lines are still here, because that is what the member asked for and what
 * the account manager needs to see in order to price it.
 *
 * Seeding one of these is what gives the AM console something to do on a fresh
 * demo. Without it the queue opens empty, which is a truthful but useless
 * first impression of a screen whose whole point is pricing work.
 */
const buildRequestedQuote = (now, displayName, showroom) => ({
  id: 'Q10024417',
  docType: 'estimate',
  projectId: null,
  jobName: 'Cart quote, 3 items',
  client: '',
  orderDate: usDate(now - days(1)),
  orderDateTs: now - days(1),
  submittedAt: now - days(1),
  expectedDelivery: null,
  status: 'requested',
  statusText: 'Quote Requested',
  soldTo: (displayName || 'You').toUpperCase(),
  showroom,
  material: null,
  salesTax: null,
  service: null,
  invoiceTotal: null,
  totalPaid: null,
  balanceDue: null,
  referralBonus: null,
  notes: 'Client wants to see pricing before we commit to the hardwood.',
  lineItems: [
    orderLine({
      category: 'HARDWOOD', product: 'Factory Direct Pier Engineered Oak',
      color: 'Strawthorne Oak', brand: 'Factory Direct',
      qty: 320, unit: 'sq ft', unitPrice: 7.6, status: 'pending',
    }),
    orderLine({
      category: 'COUNTERTOPS', product: 'Silestone Calacatta Gold Quartz',
      color: 'Calacatta Gold', brand: 'Silestone',
      qty: 48, unit: 'sq ft', unitPrice: 72.0, status: 'pending',
    }),
    orderLine({
      category: 'CABINET HARDWARE', product: 'Top Knobs Garrison Knob',
      color: 'Polished Nickel', brand: 'Top Knobs',
      qty: 24, unit: 'ea', unitPrice: 11.25, status: 'pending',
    }),
  ],
});

// The showroom whose queue the seeded quote lands on. One constant because two
// things now depend on the same answer: the enqueue below, and the check that
// decides whether a marked-as-seeded account can skip it.
const SEED_QUEUE_SHOWROOM = "st-louis";

/**
 * Read the showroom's work queue, or null if it cannot be read.
 *
 * Null is deliberately distinct from an empty queue: empty means "no work is
 * outstanding", null means "we do not know", and only one of those is safe to
 * treat as a reason to skip seeding.
 */
const readSeedQueue = async () => {
  try {
    const { readQueueFor } = await import("../am-queue.mjs");
    return await readQueueFor(SEED_QUEUE_SHOWROOM);
  } catch (err) {
    console.warn("readSeedQueue failed:", err.message);
    return null;
  }
};

/**
 * Put any seeded unpriced quote on the showroom's work queue.
 *
 * The queue lives in its own store (`ps-am-queue`, one blob per showroom),
 * separate from per-user data, because an account manager works across members.
 * So seeding a member's quote is only half the job: without a queue item the
 * document exists but no account manager can find it, and the console opens
 * empty on a fresh demo.
 *
 * Idempotent by `docId`: seedNewUser can re-run (it replaces legacy order blobs),
 * and a duplicate row for the same quote would be a bug the AM would see.
 * Best-effort: a queue failure must never take seeding down, because the member's
 * own data is the more important half.
 *
 * Returns the doc ids that are confirmed on the queue afterwards, or null if the
 * queue could not be reached. The caller records the ids on the seed marker and
 * writes no marker at all on null, so a queue this failed to populate is retried
 * on the next sign-in rather than skipped forever. An empty array is a real
 * answer: nothing was pending, which is what an account looks like once the
 * account manager has priced the quote.
 */
const enqueueSeededQuotes = async (userId, orders, now, memberName) => {
  const pending = (orders?.list || []).filter((d) => d?.status === "requested");
  if (!pending.length) return [];

  try {
    const { enqueueItem } = await import("../am-queue.mjs");
    const existing = await readSeedQueue();
    if (!existing) return null;
    const already = new Set(existing.map((i) => i?.docId).filter(Boolean));

    const confirmed = [];
    for (const doc of pending) {
      if (already.has(doc.id)) {
        confirmed.push(doc.id);
        continue;
      }
      await enqueueItem({
        type: "quote",
        showroomId: SEED_QUEUE_SHOWROOM,
        memberUserId: userId,
        // The account manager needs a person's name here. The document's own
        // `soldTo` is written from the member's point of view ("YOU"), which is
        // right on their own orders page and useless on somebody else's queue.
        memberName: memberName || "Member",
        memberEmail: "",
        docId: doc.id,
        projectId: doc.projectId || null,
        summary: doc.jobName || "Cart quote",
        itemCount: (doc.lineItems || []).length || null,
        submittedAt: doc.submittedAt || doc.orderDateTs || now,
      });
      confirmed.push(doc.id);
    }
    return confirmed;
  } catch (err) {
    console.warn("enqueueSeededQuotes failed:", err.message);
    return null;
  }
};

/**
 * Make sure an already-seeded account has the demo's unpriced quote.
 *
 * The orders blob is only written when it is absent or pre-v2, and once a v2
 * blob exists it is never touched again, because the member's own approvals and
 * payments live in it. That is the right rule, but it means an account seeded
 * before this quote existed would never get it, and the account manager's queue
 * would open empty on every demo that has been clicked even once. Resetting
 * would fix it and throw away whatever scenario the account has been set up
 * with, which is the opposite of the persistence the demo accounts promise.
 *
 * So: insert, never replace. Idempotent on the document id rather than its
 * status, so a quote that has since been priced or approved is not resurrected
 * as a fresh request every time somebody signs in.
 */
const ensureRequestedQuote = async (store, ordersKey, blob, now, displayName) => {
  if (!blob || !Array.isArray(blob.list)) return blob;
  const quote = buildRequestedQuote(now, displayName, 'ProSource of St. Louis');
  if (blob.list.some((d) => d?.id === quote.id)) return blob;
  const next = { ...blob, list: [quote, ...blob.list] };
  await store.setJSON(ordersKey, { value: next, updatedAt: now });
  return next;
};

const buildSeedOrders = (now, projectIds, displayName) => {
  const soldTo = (displayName || 'You').toUpperCase();
  const doc = buildDoc(soldTo, 'ProSource of St. Louis');

  return {
    schemaVersion: ORDERS_SCHEMA_VERSION,
    list: [
      // One quote waiting on the showroom, so the account manager's queue has
      // real work in it the first time anyone opens it.
      buildRequestedQuote(now, displayName, 'ProSource of St. Louis'),
      // --- Estimates: quotes awaiting a decision ---
      doc({
        id: 'ES-2041',
        docType: 'estimate',
        projectId: projectIds.working,
        jobName: 'Beans Kitchen Remodel',
        client: 'Bubba Beans',
        date: now - days(2),
        status: 'ready',
        statusText: 'Quote Ready for Approval',
        lines: [
          orderLine({
            category: 'TILE / BACKSPLASH', product: 'Daltile Chord Mosaic',
            color: 'Forte White', brand: 'Daltile',
            qty: 62, unit: 'sq ft', unitPrice: 12.99, status: 'pending',
          }),
          orderLine({
            category: 'K&B HARDWARE', product: 'Moen Adler Kitchen Faucet',
            color: 'Spot Resist Stainless', brand: 'Moen',
            qty: 1, unit: 'unit', unitPrice: 189.0, status: 'pending',
          }),
          orderLine({
            category: 'CABINETS / ACCESSORIES', product: 'Rev-A-Shelf Pull-Out Waste Container',
            color: 'Silver/White', brand: 'Rev-A-Shelf',
            qty: 1, unit: 'unit', unitPrice: 165.99, status: 'pending',
          }),
        ],
      }),
      {
        ...doc({
          id: 'ES-2035',
          docType: 'estimate',
          projectId: projectIds.complete,
          jobName: 'Wilson Master Bath',
          client: 'Martha Wilson',
          date: now - days(120),
          status: 'declined',
          statusText: 'Quote Declined',
          lines: [
            orderLine({
              category: 'CABINETS / VANITY', product: 'KraftMaid Durham Vanity 48"',
              color: 'Dove White', brand: 'KraftMaid',
              qty: 1, unit: 'unit', unitPrice: 341.49, status: 'declined',
            }),
            orderLine({
              category: 'K&B HARDWARE', product: 'Moen Align Towel Bar 24"',
              color: 'Brushed Nickel', brand: 'Moen',
              qty: 2, unit: 'units', unitPrice: 74.99, status: 'declined',
            }),
          ],
        }),
        declinedAt: now - days(118),
      },

      // --- Orders ---
      doc({
        id: 'EC099016',
        docType: 'order',
        projectId: projectIds.working,
        jobName: 'Beans Kitchen Remodel',
        client: 'Bubba Beans',
        date: now - days(3),
        expectedDelivery: usDate(now + days(18)),
        status: 'processing',
        statusText: 'Order Being Processed',
        paidRatio: 0.5,
        lines: [
          orderLine({
            category: 'FLOORING / LVP', product: 'COREtec Pro Plus Enhanced Luxury Vinyl Plank',
            color: 'Pembroke Pine', brand: 'COREtec',
            qty: 320, unit: 'sq ft', unitPrice: 4.99, status: 'on-order',
          }),
          orderLine({
            category: 'FLOORING / ACCESSORIES', product: 'COREtec Premium Underlayment',
            color: 'Standard', brand: 'COREtec',
            qty: 5, unit: 'rolls', unitPrice: 34.99, status: 'on-order',
          }),
          orderLine({
            category: 'FLOORING / ACCESSORIES', product: 'T-Molding Transition Strip',
            color: 'Pembroke Pine Match', brand: 'COREtec',
            qty: 3, unit: 'pieces', unitPrice: 23.04, status: 'processing',
          }),
        ],
      }),
      doc({
        id: 'EC097430',
        docType: 'order',
        projectId: projectIds.working,
        jobName: 'Beans Kitchen Remodel',
        client: 'Bubba Beans',
        date: now - days(8),
        status: 'payment',
        statusText: 'Order Down Payment Due',
        lines: [
          orderLine({
            category: 'CABINETS / BASE CABINET', product: 'KraftMaid Durham Maple Shaker Base Cabinet 24"',
            color: 'Dove White', brand: 'KraftMaid',
            qty: 6, unit: 'units', unitPrice: 485.0, status: 'pending',
          }),
          orderLine({
            category: 'CABINETS / WALL CABINET', product: 'KraftMaid Durham Maple Shaker Wall Cabinet 36"',
            color: 'Dove White', brand: 'KraftMaid',
            qty: 4, unit: 'units', unitPrice: 465.0, status: 'pending',
          }),
          orderLine({
            category: 'COUNTERTOPS / QUARTZ', product: 'Silestone Calacatta Gold Quartz Countertop',
            color: 'Calacatta Gold', brand: 'Silestone',
            qty: 46, unit: 'sq ft', unitPrice: 72.0, status: 'pending',
          }),
        ],
      }),
      {
        // 'items' is an internal RFMS state the customer sees as "Order Confirmed".
        ...doc({
          id: 'EC098220',
          docType: 'order',
          projectId: projectIds.working,
          jobName: 'Beans Kitchen Remodel',
          client: 'Bubba Beans',
          date: now - days(15),
          expectedDelivery: usDate(now + days(5)),
          status: 'items',
          statusText: 'Items Arriving',
          paidRatio: 1,
          lines: [
            orderLine({
              category: 'TILE / FLOOR TILE', product: 'Daltile Perpetuo Porcelain Floor Tile 12x24',
              color: 'Brilliant White', brand: 'Daltile',
              qty: 47, unit: 'sq ft', unitPrice: 6.49, status: 'received',
            }),
            orderLine({
              category: 'TILE / ACCESSORIES', product: 'Custom Building Products Grout',
              color: 'Bright White', brand: 'Custom',
              qty: 2, unit: 'bags', unitPrice: 31.59, status: 'received',
            }),
          ],
        }),
      },
      doc({
        id: 'EC095512',
        docType: 'order',
        projectId: projectIds.working,
        jobName: 'Beans Kitchen Remodel',
        client: 'Bubba Beans',
        date: now - days(20),
        expectedDelivery: 'Ready now',
        status: 'pickup',
        statusText: 'Ready for Pickup',
        paidRatio: 1,
        lines: [
          orderLine({
            category: 'K&B HARDWARE', product: 'Top Knobs Garrison Pull 4"',
            color: 'Polished Nickel', brand: 'Top Knobs',
            qty: 18, unit: 'units', unitPrice: 12.49, status: 'ready-for-pickup',
          }),
          orderLine({
            category: 'K&B HARDWARE', product: 'Top Knobs Garrison Knob 1 1/4"',
            color: 'Polished Nickel', brand: 'Top Knobs',
            qty: 32, unit: 'units', unitPrice: 8.99, status: 'ready-for-pickup',
          }),
        ],
      }),
      doc({
        id: 'EC094964',
        docType: 'order',
        projectId: projectIds.complete,
        jobName: 'Wilson Master Bath',
        client: 'Martha Wilson',
        date: now - days(95),
        expectedDelivery: usDate(now - days(72)),
        status: 'complete',
        statusText: 'Order Complete',
        paidRatio: 1,
        referralBonus: 87.84,
        lines: [
          orderLine({
            category: 'TILE / FLOOR TILE', product: 'Daltile Perpetuo Porcelain Floor Tile 12x24',
            color: 'Brilliant White', brand: 'Daltile',
            qty: 109, unit: 'sq ft', unitPrice: 6.49, status: 'delivered',
          }),
          orderLine({
            category: 'COUNTERTOPS / QUARTZ', product: 'Silestone Calacatta Gold Quartz Countertop',
            color: 'Calacatta Gold', brand: 'Silestone',
            qty: 12, unit: 'sq ft', unitPrice: 72.0, status: 'delivered',
          }),
          orderLine({
            category: 'K&B HARDWARE', product: 'Moen Align Shower Faucet',
            color: 'Brushed Nickel', brand: 'Moen',
            qty: 1, unit: 'unit', unitPrice: 489.0, status: 'delivered',
          }),
          orderLine({
            category: 'CABINETS / VANITY', product: 'KraftMaid Durham Vanity 60"',
            color: 'Dove White', brand: 'KraftMaid',
            qty: 1, unit: 'unit', unitPrice: 1341.49, status: 'delivered',
          }),
        ],
      }),
      doc({
        id: 'EC090657',
        docType: 'order',
        projectId: projectIds.published,
        jobName: 'Chen Outdoor Patio & Outdoor Kitchen',
        client: 'Sarah Chen',
        // Ordered at the Chen project's start. Deliberately >6 months back, so
        // each of the three time-range options returns a different list.
        date: now - days(195),
        expectedDelivery: usDate(now - days(172)),
        status: 'complete',
        statusText: 'Order Complete',
        paidRatio: 1,
        referralBonus: 87.84,
        lines: [
          orderLine({
            category: 'TILE / PAVERS', product: 'Daltile Perpetuo Porcelain Floor Tile 12x24',
            color: 'Brilliant White', brand: 'Daltile',
            qty: 530, unit: 'sq ft', unitPrice: 6.49, status: 'delivered',
          }),
          orderLine({
            category: 'COUNTERTOPS / QUARTZ', product: 'Silestone Calacatta Gold Quartz Countertop',
            color: 'Calacatta Gold', brand: 'Silestone',
            qty: 18, unit: 'sq ft', unitPrice: 72.0, status: 'delivered',
          }),
        ],
      }),
      {
        // Predates the projects: RFMS history, no projectId. Also the only
        // document older than a year, so the time-range filter has something to
        // actually cut.
        ...doc({
          id: 'EC088410',
          docType: 'order',
          projectId: null,
          jobName: 'Torres Kitchen Refresh',
          client: 'Marco Torres',
          date: now - days(760),
          expectedDelivery: usDate(now - days(742)),
          status: 'complete',
          statusText: 'Order Complete',
          paidRatio: 1,
          lines: [
            orderLine({
              category: 'CABINETS / WALL CABINET', product: 'KraftMaid Lyndale Wall Cabinet 36"',
              color: 'Praline', brand: 'KraftMaid',
              qty: 4, unit: 'units', unitPrice: 339.99, status: 'delivered',
            }),
            orderLine({
              category: 'COUNTERTOPS / QUARTZ', product: 'MSI Carrara Mist Quartz',
              color: 'Carrara Mist', brand: 'MSI',
              qty: 38, unit: 'sq ft', unitPrice: 27.49, status: 'delivered',
            }),
            orderLine({
              category: 'K&B HARDWARE', product: 'Moen Adler Kitchen Faucet',
              color: 'Spot Resist Stainless', brand: 'Moen',
              qty: 1, unit: 'unit', unitPrice: 189.0, status: 'delivered',
            }),
          ],
        }),
      },
    ],
  };
};

// Seeded upcoming appointment so new accounts see the dashboard card filled.
const buildSeedAppointments = (now) => {
  // Pick the next weekday roughly a few days out.
  const target = new Date(now + days(3));
  const day = target.toLocaleDateString('en-US', { weekday: 'short' });
  const date = target.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  return {
    list: [
      {
        id: `appt-seed-${now}`,
        person: 'Kim Marks',
        personRole: 'Account Manager',
        showroom: 'ProSource of St. Louis',
        day,
        date,
        time: '10:30 AM',
        bookedAt: now - days(1),
        status: 'confirmed',
      },
    ],
  };
};

// Twilio identity for each seeded counterparty. These MUST match the
// DEMO_PARTICIPANTS identities in netlify/functions/twilio-conversations.mjs.
// That's how a connection card lines up with the conversation seeded for the
// same person. Contract for the messaging layer:
//   demoIdentity → a seeded demo contact; message them at this Twilio identity
//   userId       → a real signed-up user; message them at their userId
//   neither      → invited only, no messaging identity yet
// James Anderson and Mike Torres are deliberately absent: twilio-conversations
// seeds no conversation for them, so claiming an identity would be a lie.
const DEMO_IDENTITY_BY_NAME = {
  'Kim Marks': 'demo-kim-marks',
  'Bubba Beans': 'demo-bubba-beans',
  "Ryan O'Toole": 'demo-ryan-otoole',
  'Sarah Chen': 'demo-sarah-chen',
  'Heather Yager': 'demo-heather-yager',
  'Denise Okafor': 'demo-denise-okafor',
};

// Seeded connections: same counterparties that appear in seeded messages
// (Kim, Bubba, Ryan, Sarah, Heather) plus a couple of extra tradepros.
//
// `projects` is the count of SEEDED PROJECTS THIS PERSON IS ON, derived from the
// project `team` arrays rather than hand-written, so the card's "N shared
// projects" is always true. It is never null: null means "unknown", and the
// showroom team's ProSource-ness is carried by `type: 'prosource'`, not by an
// absent project count.
const buildSeedConnections = (projectList = []) => {
  const sharedProjects = (connectionId) =>
    projectList.filter((p) =>
      (p.team || []).some((m) => m.connectionId === connectionId)
    ).length;

  const connection = (fields) => ({
    ...fields,
    projects: sharedProjects(fields.id),
    demoIdentity: DEMO_IDENTITY_BY_NAME[fields.name] || null,
    status: 'connected',
  });

  return {
    list: [
      connection({
        id: 1, name: 'Kim Marks', initials: 'KM', role: 'Account Manager',
        type: 'prosource', email: 'kim.marks@prosource.com',
        phone: '(314) 555-0142', location: 'ProSource of St. Louis',
      }),
      connection({
        id: 2, name: 'Heather Yager', initials: 'HY', role: 'Designer',
        type: 'prosource', email: 'heather.yager@prosource.com',
        phone: '(314) 555-0188', location: 'ProSource of St. Louis',
      }),
      // Account manager at the account's second showroom. Her email and phone
      // are the values the showroom record itself carries (see CHICAGO in
      // demo-session.mjs and the 'chicago' entry in lookup-showroom.mjs), so the
      // connection card and the showroom card cannot disagree about how to
      // reach her.
      connection({
        id: 8, name: 'Denise Okafor', initials: 'DO', role: 'Account Manager',
        type: 'prosource', email: 'denise.okafor@prosource.example',
        phone: '(312) 555-0164', location: 'ProSource of Chicago',
      }),
      connection({
        id: 3, name: 'Bubba Beans', initials: 'BB', role: 'Homeowner',
        type: 'client', email: 'bubba.beans@email.com',
        phone: '(314) 555-0123', location: 'St. Louis, MO',
      }),
      connection({
        id: 4, name: 'Sarah Chen', initials: 'SC', role: 'Homeowner',
        type: 'client', email: 'sarah.chen@email.com',
        phone: '(314) 555-5678', location: 'Chesterfield, MO',
      }),
      connection({
        id: 5, name: "Ryan O'Toole", initials: 'RO', role: 'Flooring Installer',
        type: 'tradepro', email: 'ryan@otooleinstalls.com',
        phone: '(314) 555-0789', location: 'St. Charles, MO',
      }),
      connection({
        id: 6, name: 'James Anderson', initials: 'JA', role: 'General Contractor',
        type: 'tradepro', email: 'james@andersonbuilds.com',
        phone: '(314) 555-1234', location: 'Chesterfield, MO',
      }),
      connection({
        id: 7, name: 'Mike Torres', initials: 'MT', role: 'Tile Installer',
        type: 'tradepro', email: 'mike@torrestile.com',
        phone: '(314) 555-9012', location: 'Kirkwood, MO',
      }),
    ],
  };
};

// Seeded saved carts tied to the seeded projects.
const buildSeedCarts = (now, projectIds, displayName) => {
  const fmt = (ts) => new Date(ts).toLocaleDateString('en-US');
  return {
    list: [
      {
        id: `cart-${now}-beans-lvp`,
        name: 'Beans Kitchen: Flooring Options',
        projectId: projectIds.working || null,
        updatedAt: fmt(now - days(2)),
        updatedAtTs: now - days(2),
        updatedBy: displayName,
        itemCount: 3,
        // Catalog-aligned: loading this cart and saving it to a project drops
        // real, room-assignable product cards on the project's Products tab.
        products: [
          {
            id: 'prod-002', sku: 'sku-prod-002', name: 'COREtec Pro Plus Enhanced Luxury Vinyl Plank',
            brand: 'COREtec', category: 'LVP / LVT', colorName: 'Pembroke Pine',
            qty: 1, price: 4.99, unit: 'SF', sfPerBox: 36.64, image: IMG.lvp, isSample: true,
          },
          {
            id: 'prod-001', sku: 'sku-prod-001', name: 'Factory Direct Pier Engineered 6-3/8" Oak Hardwood Flooring',
            brand: 'Factory Direct', category: 'Hardwood', colorName: 'Strawthorne Oak',
            qty: 1, price: 7.6, unit: 'SF', sfPerBox: 32.81, image: IMG.oak, isSample: true,
          },
          {
            id: 'prod-003', sku: 'sku-prod-003', name: 'Daltile Perpetuo Porcelain Floor Tile 12x24',
            brand: 'Daltile', category: 'Tile & Stone', colorName: 'Brilliant White',
            qty: 1, price: 6.49, unit: 'SF', sfPerBox: 15.6, image: IMG.tile, isSample: true,
          },
        ],
      },
      {
        id: `cart-${now}-beans-hardware`,
        name: 'Beans Kitchen: Cabinet Hardware',
        projectId: projectIds.working || null,
        updatedAt: fmt(now - days(5)),
        updatedAtTs: now - days(5),
        updatedBy: displayName,
        itemCount: 2,
        products: [
          { id: 1, name: 'Top Knobs Garrison Knob 1 1/4" Polished Nickel', sku: 'TK-GK125-PN', category: 'Cabinet Hardware', qty: 32, price: 8.99 },
          { id: 2, name: 'Top Knobs Garrison Pull 4" Polished Nickel', sku: 'TK-GP4-PN', category: 'Cabinet Hardware', qty: 18, price: 12.49 },
        ],
      },
      {
        id: `cart-${now}-wilson-final`,
        name: 'Wilson Bath: Final Pickups',
        projectId: projectIds.complete || null,
        updatedAt: fmt(now - days(28)),
        updatedAtTs: now - days(28),
        updatedBy: displayName,
        itemCount: 2,
        products: [
          { id: 1, name: 'Linear Drain 36" Brushed Nickel', sku: 'LD-36-BN', category: 'Plumbing', qty: 1, price: 189.0 },
          { id: 2, name: 'Heated Floor Mat 30sqft', sku: 'HF-30', category: 'Installation Materials', qty: 3, price: 124.0 },
        ],
      },
    ],
  };
};

// ===========================================================================
// Homeowner persona: Alicia Navarro
// ===========================================================================
//
// A client of the St. Louis showroom with exactly one job of her own. Nothing
// here overlaps Justin's world: different job, different address, different
// money, different conversations. The only thing the two accounts share is the
// showroom and its people, which is the point: Kim really does work with both.
//
// The counterparties she talks to (Kim, Heather, Ryan) are the demo's AI
// personas, which is the sanctioned direction: Alicia is a person you sign in
// AS, they are people she talks TO. She has no `demoIdentity` herself.

const HOMEOWNER_ADDRESS = '7319 Delmar Blvd, University City, MO 63130';

const buildHomeownerProjects = (now) => {
  const ids = {
    working: `seed-ho-${now}-working`,
    complete: null,
    published: null,
  };

  const teamMember = (id, name, initials, role, type) => ({
    connectionId: id, name, initials, role, type, addedAt: now - days(21),
  });

  return {
    ids,
    payload: {
      list: [
        {
          id: ids.working,
          name: 'Navarro Guest Bath Refresh',
          type: 'Bathroom Remodel',
          // Same convention as the trade pro's projects: the showroom SUPPLYING
          // the job. Alicia is a St. Louis customer and buys from nowhere else.
          showroomId: 'st-louis',
          // Her ProSource team, and only her ProSource team. A homeowner working
          // through the showroom has no contractor of her own on the job, which
          // is exactly why she is working through the showroom.
          team: [
            teamMember(1, 'Kim Marks', 'KM', 'Account Manager', 'prosource'),
            teamMember(2, 'Heather Yager', 'HY', 'Designer', 'prosource'),
            teamMember(5, "Ryan O'Toole", 'RO', 'Flooring Installer', 'tradepro'),
          ],
          description:
            'Guest bath off the hallway. Keeping the tub, replacing the floor, the vanity top and the hallway runner of hardwood outside the door. Want it done before family visit in the spring.',
          address: HOMEOWNER_ADDRESS,
          budgetRange: '$10,000 - $25,000',
          targetStart: new Date(now + days(12)).toISOString().slice(0, 10),
          targetCompletion: new Date(now + days(46)).toISOString().slice(0, 10),
          squareFootage: '58',
          rooms: [
            room('Guest Bathroom', now - days(21), { type: 'Bathroom', squareFootage: '42', notes: 'Tub stays. Floor and vanity top only.' }),
            room('Hallway', now - days(19), { type: 'Hallway', squareFootage: '16', notes: 'Runs from the guest bath door to the stairs.' }),
          ],
          products: [
            product({
              id: 'prod-003', sku: 'sku-prod-003', name: 'Daltile Perpetuo Porcelain Floor Tile 12x24',
              brand: 'Daltile', category: 'Tile & Stone', colorName: 'Brilliant White',
              price: 6.49, unit: 'SF', sfPerBox: 15.6, qty: 4, image: IMG.tile,
              roomId: 'room-guest-bathroom', addedAt: now - days(16),
            }),
            product({
              id: 'prod-005', sku: 'sku-prod-005', name: 'Silestone Calacatta Gold Quartz Countertop',
              brand: 'Silestone', category: 'Countertops', colorName: 'Calacatta Gold',
              price: 72.0, unit: 'SF', qty: 14, image: IMG.quartz,
              roomId: 'room-guest-bathroom', addedAt: now - days(15),
            }),
            // Deliberately unassigned, same reason as the trade pro's LVP: it
            // shows the "Unassigned" group and gives the demo something to drag
            // into a room. Alicia is still deciding whether the hallway is in.
            product({
              id: 'prod-001', sku: 'sku-prod-001', name: 'Factory Direct Pier Engineered 6-3/8" Oak Hardwood Flooring',
              brand: 'Factory Direct', category: 'Hardwood', colorName: 'Strawthorne Oak',
              price: 7.6, unit: 'SF', sfPerBox: 32.81, qty: 1, image: IMG.oak,
              roomId: null, addedAt: now - days(4),
            }),
          ],
          notes:
            'Heather is drawing up two vanity layouts. Decide on the hallway hardwood before the tile goes on order.',
          status: 'working',
          archived: false,
          createdAt: now - days(21),
          updatedAt: now - days(4),
        },
      ],
    },
  };
};

/**
 * A homeowner's messages: the three people a homeowner working through a
 * showroom actually has, in her own voice.
 *
 * Exported for the same reason AM_THREAD_SCRIPT is: twilio-conversations.mjs
 * seeds these same threads into Twilio, so one script feeds both transports and
 * Messages reads the same whether Twilio is up or the blob is the fallback.
 * Before this existed the Twilio side had no homeowner case at all and handed
 * Alicia the trade pro's six threads verbatim, so she was reading Justin's mail:
 * Kim telling her about the Beans kitchen samples, Bubba asking to meet at the
 * showroom, Sarah thanking her for a patio.
 *
 * Who is here and why:
 *   Kim -> her account manager. Every homeowner has one.
 *   Heather -> her designer, who is drawing the vanity layouts the job is
 *     waiting on.
 *   Ryan -> her installer. He is Justin's installer too, which is ordinary: an
 *     installer works for whoever books him.
 *
 * All three are AI personas, which is the sanctioned direction: Alicia is a
 * person you sign in AS, they are people she talks TO. Bubba and Sarah are
 * deliberately absent. They are homeowners like her, with no more reason to be
 * in her inbox than two strangers picked off the street.
 *
 * `projectKey` names which of her projects the thread is about. All three point
 * at the same job because she has exactly one.
 *
 * `agoMs` only drives the blob transport, which builds its own timestamps.
 * Twilio stamps messages as they are posted. Oldest first.
 */
export const HOMEOWNER_THREAD_SCRIPT = [
  {
    identity: 'demo-kim-marks',
    name: 'Kim Marks',
    initials: 'KM',
    role: 'Account Manager',
    type: 'prosource',
    projectKey: 'working',
    unread: true,
    history: [
      {
        from: 'them',
        agoMs: days(1) + minutes(10),
        body: 'Hi Alicia! The Perpetuo tile is in stock, so once you sign off on the estimate we can have it here in about two weeks.',
      },
      {
        from: 'user',
        agoMs: days(1) - minutes(35),
        body: "That works. Can we hold off on the hallway hardwood until I've seen Heather's layouts?",
      },
      {
        from: 'them',
        agoMs: minutes(50),
        body: "Ryan has you penciled in for the week of the 12th. I'll confirm once the tile lands.",
      },
    ],
  },
  {
    identity: 'demo-heather-yager',
    name: 'Heather Yager',
    initials: 'HY',
    role: 'Designer',
    type: 'prosource',
    projectKey: 'working',
    unread: false,
    history: [
      {
        from: 'user',
        agoMs: days(2) + minutes(35),
        body: 'Hi Heather, is there any way to get a wider vanity in there without losing the linen closet?',
      },
      {
        from: 'them',
        agoMs: days(2),
        body: 'Two vanity layouts coming your way. One keeps the linen closet, one trades it for a wider top.',
      },
    ],
  },
  {
    identity: 'demo-ryan-otoole',
    name: "Ryan O'Toole",
    initials: 'RO',
    role: 'Flooring Installer',
    type: 'tradepro',
    projectKey: 'working',
    unread: false,
    history: [
      {
        from: 'user',
        agoMs: days(3) + minutes(20),
        body: "Hi Ryan, Kim says you'll be doing the install. The hallway outside the bath has a bit of a dip in it. Is that going to be a problem?",
      },
      {
        from: 'them',
        agoMs: days(3),
        body: "Not a problem, I'll flat patch it before anything goes down. I do want to look at it once the vanity is out though.",
      },
    ],
  },
];

const buildHomeownerMessages = (now, projectIds) => ({
  threads: HOMEOWNER_THREAD_SCRIPT.map((script, i) => {
    const messages = script.history.map((h, j) => {
      const ts = now - h.agoMs;
      const isMe = h.from === 'user';
      return {
        id: j + 1,
        sender: isMe ? 'Me' : script.name,
        isMe,
        text: h.body,
        time: fmtTime(ts),
        date: fmtDate(ts),
        timestamp: ts,
      };
    });
    const last = messages[messages.length - 1];
    return {
      id: i + 1,
      projectId: projectIds[script.projectKey] || null,
      name: script.name,
      initials: script.initials,
      type: script.type,
      role: script.role,
      lastMessage: last.text,
      timestamp: fmtRelativeTimestamp(last.timestamp),
      unread: !!script.unread,
      updatedAt: last.timestamp,
      messages,
    };
  }),
});

const buildHomeownerConnections = (projectList = []) => {
  const sharedProjects = (connectionId) =>
    projectList.filter((p) =>
      (p.team || []).some((m) => m.connectionId === connectionId)
    ).length;

  // Same derivation and the same ids as the trade pro's list, so Kim is
  // connection 1 to everyone who knows her. Nobody here is an account Alicia
  // could sign in as, so `demoIdentity` is the right messaging identity for all
  // three.
  const connection = (fields) => ({
    ...fields,
    projects: sharedProjects(fields.id),
    demoIdentity: DEMO_IDENTITY_BY_NAME[fields.name] || null,
    status: 'connected',
  });

  return {
    list: [
      connection({
        id: 1, name: 'Kim Marks', initials: 'KM', role: 'Account Manager',
        type: 'prosource', email: 'kim.marks@prosource.com',
        phone: '(314) 555-0142', location: 'ProSource of St. Louis',
      }),
      connection({
        id: 2, name: 'Heather Yager', initials: 'HY', role: 'Designer',
        type: 'prosource', email: 'heather.yager@prosource.com',
        phone: '(314) 555-0188', location: 'ProSource of St. Louis',
      }),
      connection({
        id: 5, name: "Ryan O'Toole", initials: 'RO', role: 'Flooring Installer',
        type: 'tradepro', email: 'ryan@otooleinstalls.com',
        phone: '(314) 555-0789', location: 'St. Charles, MO',
      }),
    ],
  };
};

const buildHomeownerCarts = (now, projectIds, displayName) => ({
  list: [
    {
      id: `cart-ho-${now}-bath-floor`,
      name: 'Guest Bath: Floor Samples',
      projectId: projectIds.working || null,
      updatedAt: new Date(now - days(6)).toLocaleDateString('en-US'),
      updatedAtTs: now - days(6),
      updatedBy: displayName,
      itemCount: 2,
      products: [
        {
          id: 'prod-003', sku: 'sku-prod-003', name: 'Daltile Perpetuo Porcelain Floor Tile 12x24',
          brand: 'Daltile', category: 'Tile & Stone', colorName: 'Brilliant White',
          qty: 1, price: 6.49, unit: 'SF', sfPerBox: 15.6, image: IMG.tile, isSample: true,
        },
        {
          id: 'prod-001', sku: 'sku-prod-001', name: 'Factory Direct Pier Engineered 6-3/8" Oak Hardwood Flooring',
          brand: 'Factory Direct', category: 'Hardwood', colorName: 'Strawthorne Oak',
          qty: 1, price: 7.6, unit: 'SF', sfPerBox: 32.81, image: IMG.oak, isSample: true,
        },
      ],
    },
  ],
});

const buildHomeownerOrders = (now, projectIds, displayName) => {
  const doc = buildDoc((displayName || 'You').toUpperCase(), 'ProSource of St. Louis');

  return {
    schemaVersion: ORDERS_SCHEMA_VERSION,
    list: [
      // The estimate she is being asked to approve: the live decision in her
      // account, and the thing Kim's unread message is about.
      doc({
        id: 'ES-2088',
        docType: 'estimate',
        projectId: projectIds.working,
        jobName: 'Navarro Guest Bath Refresh',
        client: 'Alicia Navarro',
        date: now - days(3),
        status: 'ready',
        statusText: 'Quote Ready for Approval',
        lines: [
          orderLine({
            category: 'TILE / FLOOR TILE', product: 'Daltile Perpetuo Porcelain Floor Tile 12x24',
            color: 'Brilliant White', brand: 'Daltile',
            qty: 58, unit: 'sq ft', unitPrice: 6.49, status: 'pending',
          }),
          orderLine({
            category: 'COUNTERTOPS / QUARTZ', product: 'Silestone Calacatta Gold Quartz Countertop',
            color: 'Calacatta Gold', brand: 'Silestone',
            qty: 14, unit: 'sq ft', unitPrice: 72.0, status: 'pending',
          }),
        ],
      }),
      // Already bought and sitting at the showroom, so /orders has history as
      // well as a decision, and the dashboard's pickup card has something real.
      doc({
        id: 'EC099204',
        docType: 'order',
        projectId: projectIds.working,
        jobName: 'Navarro Guest Bath Refresh',
        client: 'Alicia Navarro',
        date: now - days(11),
        expectedDelivery: 'Ready now',
        status: 'pickup',
        statusText: 'Ready for Pickup',
        paidRatio: 1,
        lines: [
          orderLine({
            category: 'K&B HARDWARE', product: 'Moen Align Towel Bar 24"',
            color: 'Brushed Nickel', brand: 'Moen',
            qty: 2, unit: 'units', unitPrice: 74.99, status: 'ready-for-pickup',
          }),
          orderLine({
            category: 'K&B HARDWARE', product: 'Moen Align Bath Faucet',
            color: 'Brushed Nickel', brand: 'Moen',
            qty: 1, unit: 'unit', unitPrice: 219.0, status: 'ready-for-pickup',
          }),
        ],
      }),
    ],
  };
};

// Her design consult, not a trade counter appointment: a different person, a
// different time of day and a different week from the trade pro's, so the two
// dashboards can't be mistaken for each other.
const buildHomeownerAppointments = (now) => {
  const target = new Date(now + days(5));
  return {
    list: [
      {
        id: `appt-ho-seed-${now}`,
        person: 'Heather Yager',
        personRole: 'Designer',
        showroom: 'ProSource of St. Louis',
        day: target.toLocaleDateString('en-US', { weekday: 'short' }),
        date: target.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        time: '4:15 PM',
        bookedAt: now - days(2),
        status: 'confirmed',
      },
    ],
  };
};

// ===========================================================================
// Tessa's AI members: Gwen Halloran, Owen Pruitt, Camille Ostrowski
// ===========================================================================
//
// An AI member is two things at once, and it has to be both:
//
//   a `demoIdentity`, so the model answers as them and Tessa's threads move
//     when she types into them. Without this she is talking to a wall: her only
//     other members are Justin and Alicia, who are real accounts, so nothing
//     replies unless a second browser is signed in as one of them.
//   a real seeded `userId` with its own blobs, so they have projects. Without
//     this she has an inbox and nothing else: `membersFromConnections` in
//     src/member-access.js keys her Projects screen off a connection's userId,
//     and an AI persona with no account behind it is not a member, it is a
//     colleague.
//
// Both at once is safe here and nowhere else, because of who these people are
// NOT: nobody signs in as them. The rule that must not break is that anything
// with a sign-in button (Justin, Tessa, Alicia) is never an AI persona, or the
// model answers in your voice while you sit logged in as yourself, racing you
// in your own thread. These three have no sign-in button, no landing page tile
// and no PERSONAS entry in demo-session.mjs. Their accounts exist to be READ
// (by Tessa, over her connections list), not to be entered.
//
// Fresh names on purpose. src/twilio-client.js matches demo contacts by name as
// a compat shim, so a name that collides with a sign-in account is enough to
// hand that account an AI voice. Nobody here shares a name with anyone.
//
// Their voices are in netlify/functions/ai-reply.mjs. Their threads to Tessa are
// in AM_THREAD_SCRIPT below.

// "ps-" + the email with every character outside [a-z0-9] replaced by a dash.
// The same convention as `userIdForEmail` in demo-session.mjs and `legacyUserId`
// in otp-verify.mjs, so an AI member's account is an ordinary account that
// happens to have nobody signing into it. Derived rather than written out so a
// typo cannot silently mint a second, empty account under a userId nothing else
// agrees with.
const userIdForEmail = (email) => 'ps-' + email.replace(/[^a-z0-9]/g, '-');

/**
 * The account manager as a name on a project team.
 *
 * `connectionId` is null and that is the honest value, not a gap. Every other
 * team entry's id points into the project OWNER's connections list, which is
 * how the page resolves a teammate back to a person. Nobody's connections list
 * has Tessa on it: she is not someone her members added, she is the account
 * manager their account came with. So the pointer has nothing to point at.
 *
 * `userId` is what replaces it, and it is the field this whole change turns on.
 * It says this teammate is a real account rather than a name, which is what
 * lets the discussion answer "is the person reading this on this team, as
 * themselves?" without asking anyone's role. It is also the field the repair
 * pass below recognises her by, chosen for the same reason
 * ensureAmMemberConnections keys on `demoIdentity`: no UI writes it, so a team
 * someone has edited still reports her presence truthfully.
 *
 * Note what she deliberately still is NOT: an entry in DEMO_IDENTITY_BY_NAME.
 * A team entry that resolves to a demo identity gets AI-generated words put in
 * its mouth (see teamPersonas in src/prosource-project-detail.jsx), and Tessa is
 * an account you sign in as. Putting her on a team must not make the model
 * answer as her while she is sitting in the thread typing.
 *
 * Reads AM_SELF, which is defined further down with the rest of her world. That
 * holds only because nothing calls this until seed time: keep it that way, and
 * do not hoist a call to it up to module scope.
 */
const amTeamMember = (addedAt) => ({
  connectionId: null,
  userId: AM_SELF.identity,
  name: AM_SELF.name,
  initials: AM_SELF.initials,
  role: AM_SELF.role,
  type: AM_SELF.type,
  addedAt,
});

const castProjectTeam = (now) => [
  // Tessa rather than Kim, and this is the only seeded world where that is
  // true. These three are TESSA's members: they message her, her Projects
  // screen lists their work, and she is the one who answers when they ask for a
  // number. Kim here was never a decision, it was every project seed doing what
  // project seeds have always done, and it left the account manager on the
  // project as someone other than the account manager working it.
  //
  // Justin's and Alicia's teams keep Kim on purpose. Kim is their assigned AM
  // and she is an AI persona, so their project discussions get replies. Tessa is
  // a human account you sign in as. Both of those have to stay true, so the two
  // worlds are deliberately not reconciled. See buildSeedProjects.
  //
  // Heather stays: a designer on the job is a designer on the job, and she is a
  // colleague of Tessa's rather than a stand-in for her.
  amTeamMember(now - days(30)),
  { connectionId: 2, name: 'Heather Yager', initials: 'HY', role: 'Designer', type: 'prosource', addedAt: now - days(30) },
];

// Gwen runs two bathrooms and a kitchen at a time and is always one quote
// behind. Her working job is the one she is chasing Tessa about.
const buildGwenProjects = (now) => {
  const ids = {
    working: `seed-gh-${now}-working`,
    complete: `seed-gh-${now}-complete`,
    published: null,
  };

  return {
    ids,
    payload: {
      list: [
        {
          id: ids.working,
          name: 'Ferndale Ave Kitchen',
          type: 'Kitchen Remodel',
          showroomId: 'st-louis',
          team: [
            ...castProjectTeam(now),
            { connectionId: 5, name: "Ryan O'Toole", initials: 'RO', role: 'Flooring Installer', type: 'tradepro', addedAt: now - days(20) },
          ],
          description:
            'Galley kitchen opened into the dining room. Wall comes out, cabinets go back on the north run only. Client signs Friday or the whole thing slides to spring.',
          address: '3812 Ferndale Ave, Webster Groves, MO 63119',
          budgetRange: '$25,000 - $50,000',
          targetStart: new Date(now + days(9)).toISOString().slice(0, 10),
          targetCompletion: new Date(now + days(64)).toISOString().slice(0, 10),
          squareFootage: '215',
          rooms: [
            room('Kitchen', now - days(30), { type: 'Kitchen', squareFootage: '165', notes: 'North run only. Load bearing wall coming out, engineer signed off.' }),
            room('Dining Room', now - days(30), { type: 'Dining Room', squareFootage: '50', notes: 'Floor has to run through from the kitchen with no transition strip.' }),
          ],
          products: [
            product({
              id: 'prod-006', sku: 'sku-prod-006', name: 'KraftMaid Durham Maple Shaker Cabinet',
              brand: 'KraftMaid', category: 'Cabinets', colorName: 'Dove White',
              price: 485.0, unit: 'EA', qty: 11, image: IMG.cabinet,
              roomId: 'room-kitchen', addedAt: now - days(6),
            }),
            product({
              id: 'prod-001', sku: 'sku-prod-001', name: 'Factory Direct Pier Engineered 6-3/8" Oak Hardwood Flooring',
              brand: 'Factory Direct', category: 'Hardwood', colorName: 'Strawthorne Oak',
              price: 7.6, unit: 'SF', sfPerBox: 32.81, qty: 215, image: IMG.oak,
              roomId: 'room-kitchen', addedAt: now - days(5),
            }),
          ],
          notes: 'Cabinet quote outstanding with Tessa. Framing crew is off this job Thursday either way.',
          status: 'working',
          archived: false,
          createdAt: now - days(30),
          updatedAt: now - days(5),
        },
        {
          id: ids.complete,
          name: 'Kingsbury Powder Room',
          type: 'Bathroom Remodel',
          showroomId: 'st-louis',
          team: castProjectTeam(now),
          description:
            'Small powder room off the entry. Pedestal sink out, floating vanity in, floor tile run on the diagonal. Signed off last month.',
          address: '6120 Kingsbury Ave, St. Louis, MO 63112',
          budgetRange: '$5,000 - $10,000',
          targetStart: new Date(now - days(70)).toISOString().slice(0, 10),
          targetCompletion: new Date(now - days(32)).toISOString().slice(0, 10),
          squareFootage: '28',
          rooms: [
            room('Powder Room', now - days(80), { type: 'Bathroom', squareFootage: '28' }),
          ],
          products: [
            product({
              id: 'prod-003', sku: 'sku-prod-003', name: 'Daltile Perpetuo Porcelain Floor Tile 12x24',
              brand: 'Daltile', category: 'Tile & Stone', colorName: 'Brilliant White',
              price: 6.49, unit: 'SF', sfPerBox: 15.6, qty: 34, image: IMG.tile,
              roomId: 'room-powder-room', addedAt: now - days(60),
            }),
          ],
          notes: 'Client wants the same vanity in the upstairs bath next year.',
          status: 'complete',
          archived: false,
          createdAt: now - days(80),
          updatedAt: now - days(32),
        },
      ],
    },
  };
};

// Owen owns one house and is doing one thing to it, slowly, while reading
// everything he can find about it first.
const buildOwenProjects = (now) => {
  const ids = {
    working: `seed-op-${now}-working`,
    complete: null,
    published: null,
  };

  return {
    ids,
    payload: {
      list: [
        {
          id: ids.working,
          name: 'Pruitt Basement Finish',
          type: 'Other',
          showroomId: 'st-louis',
          team: [
            ...castProjectTeam(now),
            { connectionId: 5, name: "Ryan O'Toole", initials: 'RO', role: 'Flooring Installer', type: 'tradepro', addedAt: now - days(11) },
          ],
          description:
            'Finishing the basement into a family room and a small office. Slab is dry but the previous owner had a sump pump put in, so everything down there has to be able to take a wet day.',
          address: '1147 Sappington Barracks Rd, Crestwood, MO 63126',
          budgetRange: '$10,000 - $25,000',
          targetStart: new Date(now + days(24)).toISOString().slice(0, 10),
          targetCompletion: new Date(now + days(80)).toISOString().slice(0, 10),
          squareFootage: '640',
          rooms: [
            room('Family Room', now - days(18), { type: 'Living Room', squareFootage: '480', notes: 'Sump pit is in the far corner. Nothing permanent over it.' }),
            room('Office', now - days(18), { type: 'Office', squareFootage: '160' }),
          ],
          products: [
            product({
              id: 'prod-002', sku: 'sku-prod-002', name: 'COREtec Pro Plus Enhanced Luxury Vinyl Plank',
              brand: 'COREtec', category: 'LVP / LVT', colorName: 'Pembroke Pine',
              price: 4.99, unit: 'SF', sfPerBox: 36.64, qty: 640, image: IMG.lvp,
              roomId: 'room-family-room', addedAt: now - days(9),
            }),
            // Unassigned on purpose: he has not decided whether the office gets
            // the same floor or something warmer, and has asked three times.
            product({
              id: 'prod-001', sku: 'sku-prod-001', name: 'Factory Direct Pier Engineered 6-3/8" Oak Hardwood Flooring',
              brand: 'Factory Direct', category: 'Hardwood', colorName: 'Strawthorne Oak',
              price: 7.6, unit: 'SF', sfPerBox: 32.81, qty: 1, image: IMG.oak,
              roomId: null, addedAt: now - days(3),
            }),
          ],
          notes: 'Wants a moisture reading on the slab before anything is ordered.',
          status: 'working',
          archived: false,
          createdAt: now - days(18),
          updatedAt: now - days(3),
        },
      ],
    },
  };
};

// Camille buys for houses she does not live in. Two at a time, always.
const buildCamilleProjects = (now) => {
  const ids = {
    working: `seed-co-${now}-working`,
    complete: null,
    published: `seed-co-${now}-published`,
  };

  return {
    ids,
    payload: {
      list: [
        {
          id: ids.working,
          name: 'Ivanhoe Flip: Whole Floor',
          type: 'Other',
          showroomId: 'st-louis',
          team: castProjectTeam(now),
          description:
            'Three bed ranch, closing Friday, on the market in nine weeks. One floor through the whole house, no transitions, nothing that needs acclimating for a fortnight.',
          address: '1900 Ivanhoe Ave, St. Louis, MO 63139',
          budgetRange: '$5,000 - $10,000',
          targetStart: new Date(now + days(6)).toISOString().slice(0, 10),
          targetCompletion: new Date(now + days(58)).toISOString().slice(0, 10),
          squareFootage: '1100',
          rooms: [
            room('Whole House', now - days(12), { type: 'Other', squareFootage: '1100', notes: 'One floor throughout. Photographs matter more than wear layer.' }),
          ],
          products: [
            product({
              id: 'prod-002', sku: 'sku-prod-002', name: 'COREtec Pro Plus Enhanced Luxury Vinyl Plank',
              brand: 'COREtec', category: 'LVP / LVT', colorName: 'Pembroke Pine',
              price: 4.99, unit: 'SF', sfPerBox: 36.64, qty: 1100, image: IMG.lvp,
              roomId: 'room-whole-house', addedAt: now - days(2),
            }),
          ],
          notes: 'Wants the Delmar flip priced off the same run if the number holds.',
          status: 'working',
          archived: false,
          createdAt: now - days(12),
          updatedAt: now - days(2),
        },
        {
          id: ids.published,
          name: 'Shenandoah Flip: Kitchen & Bath',
          type: 'Kitchen Remodel',
          showroomId: 'st-louis',
          team: castProjectTeam(now),
          description:
            'Quartz, shaker boxes, tile floor. Sold over asking in four days, so this is the recipe until it stops working.',
          address: '3355 Shenandoah Ave, St. Louis, MO 63104',
          budgetRange: '$15,000 - $25,000',
          targetStart: new Date(now - days(160)).toISOString().slice(0, 10),
          targetCompletion: new Date(now - days(105)).toISOString().slice(0, 10),
          squareFootage: '260',
          rooms: [
            room('Kitchen', now - days(170), { type: 'Kitchen', squareFootage: '190' }),
            room('Hall Bathroom', now - days(170), { type: 'Bathroom', squareFootage: '70' }),
          ],
          products: [
            product({
              id: 'prod-005', sku: 'sku-prod-005', name: 'Silestone Calacatta Gold Quartz Countertop',
              brand: 'Silestone', category: 'Countertops', colorName: 'Calacatta Gold',
              price: 72.0, unit: 'SF', qty: 32, image: IMG.quartz,
              roomId: 'room-kitchen', addedAt: now - days(150),
            }),
            product({
              id: 'prod-003', sku: 'sku-prod-003', name: 'Daltile Perpetuo Porcelain Floor Tile 12x24',
              brand: 'Daltile', category: 'Tile & Stone', colorName: 'Brilliant White',
              price: 6.49, unit: 'SF', sfPerBox: 15.6, qty: 70, image: IMG.tile,
              roomId: 'room-hall-bathroom', addedAt: now - days(148),
            }),
          ],
          notes: 'Listing photos are on the public profile. Client okayed them.',
          status: 'published',
          archived: false,
          createdAt: now - days(170),
          updatedAt: now - days(100),
        },
      ],
    },
  };
};

// Whose projects are whose. Kept next to the builders and keyed by the cast's
// own `key` so WORLD_BY_PERSONA can be built from the cast itself rather than
// listing all three people a second time and getting one of them wrong.
const PROJECTS_BY_CAST_MEMBER = {
  gwen: buildGwenProjects,
  owen: buildOwenProjects,
  camille: buildCamilleProjects,
};

/**
 * The AI members, in one place, because every part of them has to agree.
 *
 * `identity` and `userId` are the two halves of the design and are read from
 * here by four different files: ai-reply.mjs speaks as the identity,
 * twilio-conversations.mjs seeds a thread with it, demo-session.mjs seeds the
 * account behind the userId, and buildAmConnections below hands Tessa a
 * connection carrying both. Written out once so they cannot drift into four
 * slightly different people.
 *
 * `history` is their thread with Tessa: written TO an account manager, because
 * that is the only person any of them talks to. Oldest first, `agoMs` as in
 * AM_THREAD_SCRIPT.
 */
export const AM_MEMBER_CAST = [
  {
    key: 'gwen',
    identity: 'demo-gwen-halloran',
    email: 'gwen@halloranbuilds.com',
    userId: userIdForEmail('gwen@halloranbuilds.com'),
    seedPersona: 'member-gwen-halloran',
    name: 'Gwen Halloran',
    initials: 'GH',
    role: 'Kitchen & Bath Remodeler',
    type: 'tradepro',
    phone: '(314) 555-0311',
    location: 'Webster Groves, MO',
    unread: true,
    history: [
      {
        from: 'them',
        agoMs: days(1) + minutes(30),
        body: 'Tessa, Ferndale kitchen. Need the KraftMaid number today. Client signs Friday or she walks.',
      },
      {
        from: 'user',
        agoMs: days(1),
        body: "On it. I'll have the cabinet pricing back to you this afternoon.",
      },
      {
        from: 'them',
        agoMs: minutes(35),
        body: "Any word? Framing crew is off this job Thursday and I've got nothing to hand them.",
      },
    ],
  },
  {
    key: 'owen',
    identity: 'demo-owen-pruitt',
    email: 'owen.pruitt@email.com',
    userId: userIdForEmail('owen.pruitt@email.com'),
    seedPersona: 'member-owen-pruitt',
    name: 'Owen Pruitt',
    initials: 'OP',
    role: 'Homeowner',
    type: 'client',
    phone: '(314) 555-0426',
    location: 'Crestwood, MO',
    unread: true,
    history: [
      {
        from: 'them',
        agoMs: days(2) + minutes(15),
        body: "Hi Tessa, sorry to come back to this again. I know you said the rigid core plank is fine on a basement slab, but I read a long thread last night about moisture and now I'm second guessing the whole floor.",
      },
      {
        from: 'user',
        agoMs: days(2),
        body: 'No need to apologise. Rigid core is exactly what a basement wants, and we can put a meter on the slab before anything is ordered.',
      },
      {
        from: 'them',
        agoMs: minutes(150),
        body: 'Okay, that helps. Does the meter reading cost anything? And sorry, one more: is the underlayment in the number you sent me or is that separate?',
      },
    ],
  },
  {
    key: 'camille',
    identity: 'demo-camille-ostrowski',
    email: 'camille@ostrowskiproperties.com',
    userId: userIdForEmail('camille@ostrowskiproperties.com'),
    seedPersona: 'member-camille-ostrowski',
    name: 'Camille Ostrowski',
    initials: 'CO',
    role: 'Property Renovator',
    type: 'tradepro',
    phone: '(314) 555-0733',
    location: 'St. Louis, MO',
    unread: false,
    history: [
      {
        from: 'them',
        agoMs: days(3),
        body: 'Tessa, Camille. 1900 Ivanhoe closes Friday. I need eleven hundred feet of something that photographs like white oak and prices like carpet.',
      },
      {
        from: 'user',
        agoMs: days(3) - minutes(45),
        body: 'The COREtec Pembroke Pine is your best value at that footage, and I can hold enough for the whole floor.',
      },
      {
        from: 'them',
        agoMs: days(2),
        body: "Hold it. If it lands under five a foot I'll take the Delmar house off the same run. Send me the number, not the brochure.",
      },
    ],
  },
];

// ===========================================================================
// Account manager persona: Tessa Brandt
// ===========================================================================
//
// Staff at the St. Louis showroom, so her account is shaped nothing like a
// customer's: the jobs, the carts and the orders belong to the people she sells
// to, not to her. What she owns is a book of business and the conversations in
// it, which is what this seeds. Her queue lives in the AM console, which keys
// off `userType: 'accountmanager'` and sources its own data.
//
// Deliberately no projects/carts/orders key: an empty Projects tab is a real,
// honest state for a member of staff, and inventing copies of her customers'
// jobs would put the same job in two accounts under two owners.

// The other demo accounts, addressed by the userId they really sign in with.
// Must match `userIdForEmail` in demo-session.mjs, which is otp-verify.mjs's
// `legacyUserId` convention: "ps-" + the email with every character outside
// [a-z0-9] replaced by a dash.
//
// This is what makes Tessa's customer connections messageable: per
// `identityForConnection` in src/twilio-client.js, a connection carrying a
// `userId` is a real signed-up user and is messaged at that userId. So a thread
// Tessa opens with Justin here is the same thread Justin sees when he signs in.
//
// Exported because netlify/functions/twilio-conversations.mjs resolves which
// world to seed from the userId it is handed, and these are the accounts it has
// to recognise. One list, so the two files cannot drift.
export const DEMO_ACCOUNT_USER_ID = {
  tradepro: 'ps-demo-prosource-com',
  homeowner: 'ps-alicia-navarro-email-com',
  am: 'ps-tessa-brandt-prosource-com',
};

const buildAmConnections = () => {
  // No `projects` derivation to do: Tessa owns no projects, so she shares none.
  // 0 is the honest count, and the field is never null (null would mean
  // "unknown").
  //
  // What a connection carries says what kind of person it is, and there are now
  // three kinds:
  //   demoIdentity only -> a colleague. An AI persona with no account behind
  //     her (Kim, Heather, Denise): someone Tessa talks to, not someone she
  //     sells to. Nothing to open.
  //   userId only -> a real demo account (Justin, Alicia). Their projects load,
  //     and their threads only move when somebody is signed in as them.
  //   both -> an AI member (see AM_MEMBER_CAST). The demoIdentity is who answers
  //     her; the userId is whose projects she opens. This is the combination
  //     that makes her book of business real rather than a list of names, and it
  //     is safe precisely because nobody signs in as them.
  // Tessa carries neither, and must not: she is the person you sign in AS.
  const connection = (fields) => ({
    projects: 0,
    demoIdentity: DEMO_IDENTITY_BY_NAME[fields.name] || null,
    userId: null,
    status: 'connected',
    ...fields,
  });

  return {
    list: [
      // --- Her customers ---
      connection({
        id: 9, name: 'Justin Reyes', initials: 'JR', role: 'General Contractor',
        type: 'tradepro', email: 'demo@prosource.com',
        phone: '(314) 555-0117', location: 'St. Louis, MO',
        userId: DEMO_ACCOUNT_USER_ID.tradepro,
      }),
      connection({
        id: 10, name: 'Alicia Navarro', initials: 'AN', role: 'Homeowner',
        type: 'client', email: 'alicia.navarro@email.com',
        phone: '(314) 555-0264', location: 'University City, MO',
        userId: DEMO_ACCOUNT_USER_ID.homeowner,
      }),
      // Her AI members, ids 11+. Both fields, on purpose: see above.
      ...AM_MEMBER_CAST.map((m, i) =>
        connection({
          id: 11 + i, name: m.name, initials: m.initials, role: m.role,
          type: m.type, email: m.email, phone: m.phone, location: m.location,
          userId: m.userId,
          demoIdentity: m.identity,
        })
      ),
      // --- Her colleagues ---
      connection({
        id: 1, name: 'Kim Marks', initials: 'KM', role: 'Account Manager',
        type: 'prosource', email: 'kim.marks@prosource.com',
        phone: '(314) 555-0142', location: 'ProSource of St. Louis',
      }),
      connection({
        id: 2, name: 'Heather Yager', initials: 'HY', role: 'Designer',
        type: 'prosource', email: 'heather.yager@prosource.com',
        phone: '(314) 555-0188', location: 'ProSource of St. Louis',
      }),
      connection({
        id: 8, name: 'Denise Okafor', initials: 'DO', role: 'Account Manager',
        type: 'prosource', email: 'denise.okafor@prosource.example',
        phone: '(312) 555-0164', location: 'ProSource of Chicago',
      }),
    ],
  };
};

/**
 * Who Tessa is to the people she is talking to.
 *
 * Needed because her threads are the demo's only genuinely two-sided ones: both
 * she and her members are real accounts, so a thread has to describe BOTH ends
 * (see `parties` in twilio-conversations.mjs). Everywhere else one end is a
 * scripted persona nobody signs in as, so one end was all anyone ever needed.
 */
export const AM_SELF = {
  identity: DEMO_ACCOUNT_USER_ID.am,
  name: 'Tessa Brandt',
  initials: 'TB',
  role: 'Account Manager',
  type: 'prosource',
};

/**
 * An account manager's messages: her MEMBERS, in her own voice.
 *
 * Exported because twilio-conversations.mjs seeds these same threads into
 * Twilio. One script, two transports, so Messages reads the same people saying
 * the same things whether Twilio is up or the blob is the fallback. These were
 * written out twice and had drifted badly: the Twilio side had no idea who the
 * signed-in user was and gave every account, Tessa included, the six
 * member-facing demo-persona threads.
 *
 * Who is here and why:
 *   Justin, Alicia -> her customers, and REAL demo accounts, so their identity
 *     is their userId. No AI persona speaks for them: the thread only moves when
 *     someone is actually signed in as them, which makes it the one thread you
 *     can demo live from both sides in two browsers.
 *   Gwen, Owen, Camille -> her AI members (AM_MEMBER_CAST). Their identity is a
 *     `demo-` identity, so they answer on their own, and their account is real,
 *     so the job each one is talking about is a job she can open. They are why
 *     this screen is worth showing to somebody: before them, every thread Tessa
 *     had was either silent or Kim.
 *   Kim -> a showroom colleague and an AI persona, so hers is a `demo-`
 *     identity and she answers on her own.
 *
 * Bubba and Sarah are deliberately absent: they are Justin's clients, not
 * Tessa's, and an account manager reading her customers' customers' mail is the
 * bug this script exists to fix. Ryan is absent for the same reason, one step
 * further out: he is her customers' subcontractor.
 *
 * Threads carry no projectId: the jobs they're about live in her customers'
 * accounts, not hers, so there is no project of Tessa's to link to. Null is the
 * same value the trade pro's threads take when their project can't be resolved,
 * so the client already handles it.
 *
 * `agoMs` only drives the blob transport, which builds its own timestamps.
 * Twilio stamps messages as they are posted, so there the script's ordering
 * survives and its spacing does not. Oldest first.
 */
export const AM_THREAD_SCRIPT = [
  {
    identity: DEMO_ACCOUNT_USER_ID.tradepro,
    name: 'Justin Reyes',
    initials: 'JR',
    role: 'General Contractor',
    type: 'tradepro',
    unread: true,
    history: [
      {
        from: 'them',
        agoMs: minutes(95),
        body: 'Morning Tessa, any movement on the Beans kitchen cabinet quote? Client is asking.',
      },
      {
        from: 'user',
        agoMs: minutes(18),
        body: "Quote's with me now. I'll have the cabinet numbers back to you before close today.",
      },
    ],
  },
  {
    identity: DEMO_ACCOUNT_USER_ID.homeowner,
    name: 'Alicia Navarro',
    initials: 'AN',
    role: 'Homeowner',
    type: 'client',
    unread: false,
    history: [
      {
        from: 'them',
        agoMs: days(1) + minutes(40),
        body: "Sorry, I know Kim sent the estimate over. I'm still deciding on the hallway before I sign anything.",
      },
      {
        from: 'user',
        agoMs: days(1),
        body: "No rush at all. Take the weekend with Heather's layouts and we'll pick it up Monday.",
      },
    ],
  },
  // Her AI members, spliced in from the one place they are described. Their
  // script entry IS their cast entry: same identity, same card, same thread, so
  // the person who answers her is the person whose projects she opens.
  ...AM_MEMBER_CAST.map((m) => ({
    identity: m.identity,
    name: m.name,
    initials: m.initials,
    role: m.role,
    type: m.type,
    unread: m.unread,
    history: m.history,
  })),
  {
    identity: DEMO_IDENTITY_BY_NAME['Kim Marks'],
    name: 'Kim Marks',
    initials: 'KM',
    role: 'Account Manager',
    type: 'prosource',
    unread: false,
    history: [
      {
        from: 'them',
        agoMs: days(4),
        body: "Covering your accounts Thursday while you're at the Daltile thing. Anything I should watch?",
      },
    ],
  },
];

/**
 * Put an account manager's AI members on her list when the list is already there.
 *
 * The seed's oldest rule is "write a key only when it is empty", because
 * everything the demo has been clicked into lives in those same keys. Tessa's
 * connections key has been populated in the live demo since long before her AI
 * members existed, so bumping SEED_VERSION does not put them on it: a bump
 * re-runs the seed, and the seed looks at a full key and leaves. She would sign
 * in to threads from three people who do not appear anywhere else in her
 * account, and a Projects screen that has never heard of them.
 *
 * So this is the same shape as ensureRequestedQuote: a repair pass that runs
 * against a key that already has data in it, and adds only what is missing.
 * Idempotent by `demoIdentity`, which is the one field on these records that
 * cannot be edited from the UI, so a member she has renamed or re-roled is
 * still recognised as present and is not duplicated.
 *
 * Ids are assigned from the end of her existing list rather than taken from the
 * cast, because they have to be unique WITHIN this list and this list may have
 * grown since. On an unedited demo account the two agree anyway (her seed stops
 * at 10, the cast starts at 11).
 *
 * Deliberately additive only. Anything else on her list is hers, including
 * whatever she has added by hand, and a repair that removed rows would be a
 * reset wearing a repair's clothes.
 */
const ensureAmMemberConnections = async (store, connectionsKey, blob, now) => {
  const list = Array.isArray(blob?.value?.list) ? blob.value.list : null;
  // Not a shape we recognise: leave it alone rather than overwrite it.
  if (!list) return;

  const present = new Set(list.map((c) => c?.demoIdentity).filter(Boolean));
  const missing = buildAmConnections().list.filter(
    (c) => c.userId && c.demoIdentity && !present.has(c.demoIdentity)
  );
  if (!missing.length) return;

  const nextId = Math.max(0, ...list.map((c) => Number(c?.id) || 0)) + 1;
  await store.setJSON(connectionsKey, {
    value: {
      ...blob.value,
      list: [...list, ...missing.map((c, i) => ({ ...c, id: nextId + i }))],
    },
    updatedAt: now,
  });
};

/**
 * Put the account manager on her members' project teams when the teams are
 * already seeded.
 *
 * Same problem as ensureAmMemberConnections and the same shape of answer. These
 * three accounts were seeded at SEED_VERSION 2 with Kim on every team, the live
 * demo has been handing them out since that shipped, and "write a key only when
 * it is empty" means a version bump reads a full `projects` key and leaves. The
 * fresh-seed fix in castProjectTeam only ever reaches an account nobody has
 * clicked yet.
 *
 * Runs against the MEMBER's own projects key, from the member's own seed run
 * (see amOnTeam on their worlds). Tessa's sign-in is what triggers those runs
 * via alsoSeedAccounts, but the write lands in their account, not hers.
 *
 * Why this is surgical instead of just rewriting the blob: a cast member's
 * projects are pure seed output today, since nobody signs in as them and a guest
 * cannot edit, so replacing the whole key the way the legacy orders repair does
 * would be safe RIGHT NOW and unsafe the moment this ships. Project ids are
 * minted from the seed's clock (`seed-gh-${now}-working`), the discussions blob
 * is keyed by project id, and Tessa can now post into it. Regenerate the ids and
 * every comment she has left is still in the blob, attached to a project that no
 * longer exists. So: keep the ids, touch only the team.
 *
 * Idempotent by `userId`, which no UI writes. Additive except for the one record
 * it is here to correct: Kim as the account manager, which the seed itself put
 * there and which is the bug. Anything else on the team is left exactly as it
 * is, including Ryan and Heather, and including whatever a future edit adds.
 */
const ensureAmOnProjectTeams = async (store, projectsKey, blob, now) => {
  const list = Array.isArray(blob?.value?.list) ? blob.value.list : null;
  // Not a shape we recognise: leave it alone rather than overwrite it.
  if (!list) return null;

  const isSeededKim = (m) =>
    m?.name === 'Kim Marks' && m?.role === 'Account Manager' && !m?.userId;

  let changed = false;
  const next = list.map((p) => {
    const team = Array.isArray(p?.team) ? p.team : null;
    if (!team) return p;

    const hasAm = team.some((m) => m?.userId === AM_SELF.identity);
    const kim = team.find(isSeededKim);
    if (hasAm && !kim) return p;

    changed = true;
    const rest = team.filter((m) => !isSeededKim(m));
    if (hasAm) return { ...p, team: rest };
    // Inherit Kim's timestamp rather than stamping `now`. She is not joining the
    // job today, she is the account manager it has had all along, and the
    // activity feed reads these timestamps: a fresh `now` would render "Added
    // Tessa Brandt as account manager" as the newest thing to happen on a
    // project that has been running for a month.
    const addedAt = kim?.addedAt || p?.createdAt || now;
    return { ...p, team: [amTeamMember(addedAt), ...rest] };
  });
  if (!changed) return list;

  await store.setJSON(projectsKey, {
    value: { ...blob.value, list: next },
    updatedAt: now,
  });
  return next;
};

const buildAmMessages = (now) => ({
  threads: AM_THREAD_SCRIPT.map((script, i) => {
    const messages = script.history.map((h, j) => {
      const ts = now - h.agoMs;
      const isMe = h.from === 'user';
      return {
        id: j + 1,
        sender: isMe ? 'Me' : script.name,
        isMe,
        text: h.body,
        time: fmtTime(ts),
        date: fmtDate(ts),
        timestamp: ts,
      };
    });
    const last = messages[messages.length - 1];
    return {
      id: i + 1,
      projectId: null,
      name: script.name,
      initials: script.initials,
      type: script.type,
      role: script.role,
      lastMessage: last.text,
      timestamp: fmtRelativeTimestamp(last.timestamp),
      unread: !!script.unread,
      updatedAt: last.timestamp,
      messages,
    };
  }),
});

// A counter appointment with a customer, which is what an AM's day is made of.
// Different person, time and week again from the other two personas'.
const buildAmAppointments = (now) => {
  const target = new Date(now + days(2));
  return {
    list: [
      {
        id: `appt-am-seed-${now}`,
        person: 'Justin Reyes',
        personRole: 'General Contractor',
        showroom: 'ProSource of St. Louis',
        day: target.toLocaleDateString('en-US', { weekday: 'short' }),
        date: target.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        time: '9:00 AM',
        bookedAt: now - days(3),
        status: 'confirmed',
      },
    ],
  };
};

// ===========================================================================

/**
 * What each persona's account is seeded with. A null builder means "this
 * persona owns nothing under this key": the key is left untouched, not written
 * empty, so the app's own empty state does the talking.
 *
 * The builders keep the signatures they already had, so `tradepro` is the exact
 * same seed it was before this map existed.
 */
const WORLD_BY_PERSONA = {
  tradepro: {
    // `displayName` is who this account is to OTHER people. Orders are written
    // from the member's own point of view ("SOLD TO: YOU"), which is right on
    // their page and meaningless on an account manager's queue.
    displayName: 'Justin Reyes',
    // Carries an unpriced quote, so the account manager's queue has real work
    // in it on a fresh demo. See ensureRequestedQuote.
    requestedQuote: true,
    projects: buildSeedProjects,
    messages: buildSeedMessages,
    carts: buildSeedCarts,
    appointments: buildSeedAppointments,
    orders: buildSeedOrders,
    connections: buildSeedConnections,
  },
  homeowner: {
    displayName: 'Alicia Navarro',
    requestedQuote: false,
    projects: buildHomeownerProjects,
    messages: buildHomeownerMessages,
    carts: buildHomeownerCarts,
    appointments: buildHomeownerAppointments,
    orders: buildHomeownerOrders,
    connections: buildHomeownerConnections,
  },
  am: {
    // Showroom staff, so no projects, carts or orders of her own: those belong
    // to her members.
    displayName: 'Tessa Brandt',
    requestedQuote: false,
    projects: null,
    messages: buildAmMessages,
    carts: null,
    appointments: buildAmAppointments,
    orders: null,
    connections: buildAmConnections,
    // Her connections key is the one seeded key that has to be repaired rather
    // than only filled, because her AI members arrived after she did. Same idea
    // as `requestedQuote` on the trade pro: a flag on the world, so the repair
    // is something a world asks for rather than something seedNewUser knows
    // about one persona by name.
    ensureMembers: true,
  },

  // --- Tessa's AI members ----------------------------------------------------
  //
  // A world per AI member, because they are accounts and this is what an account
  // is made of. `projects` and nothing else, deliberately:
  //
  //   projects, because that is the whole reason they have an account at all.
  //   Tessa's Projects screen reads each member's `projects` blob by userId
  //   (loadMemberProjects in src/member-access.js), so without this key she has
  //   a roster of members with nothing under any of their names.
  //
  //   nothing else, because nobody signs in as them and every other key is only
  //   ever read from inside the account that owns it. Their messages live in
  //   Twilio (seeded against Tessa's account, since it is her thread), their
  //   connections list would be a screen no one opens, and inventing orders for
  //   them would put unpriced quotes in the work queue that no demo click can
  //   ever resolve. A null builder leaves the key untouched rather than writing
  //   it empty, which is the same contract the `am` world above relies on.
  //
  // These keys are still theirs and still real: sign in through the OTP flow as
  // gwen@halloranbuilds.com and you would land on this exact data, because the
  // userId is derived from the email the same way every other account's is.
  ...Object.fromEntries(
    AM_MEMBER_CAST.map((m) => [
      m.seedPersona,
      {
        displayName: m.name,
        requestedQuote: false,
        projects: PROJECTS_BY_CAST_MEMBER[m.key],
        messages: null,
        carts: null,
        appointments: null,
        orders: null,
        connections: null,
        // Their projects key is the one seeded key that has to be repaired
        // rather than only filled, because they were seeded with Kim on the
        // team before Tessa was put on it. Same idea as `ensureMembers` on her
        // own world: a flag the world asks for, so seedNewUser is not made to
        // know these three accounts by name. See ensureAmOnProjectTeams.
        amOnTeam: true,
      },
    ])
  ),
};

const DEFAULT_PERSONA = 'tradepro';

const blobKey = (userId, key) => `${userId}::${key}`;

// ===========================================================================
// Seed markers: how a re-seed knows it has nothing left to do
// ===========================================================================

/**
 * The version of the content THIS FILE seeds into per-user blobs.
 *
 * BUMP THIS whenever the seeded data changes in a way an already-seeded account
 * should pick up: a new key, a new document in a persona's orders, a new seeded
 * thread, a new persona world. The marker records the version that produced an
 * account's data, so a bump makes the next sign-in run the seed again instead of
 * believing the marker.
 *
 * What a bump does NOT do: rewrite a key that already has data in it. The seed's
 * rule has always been "write a key only when it is empty", because everything
 * the demo has been clicked into lives in those same keys, and that rule is
 * older than this marker and unchanged by it. A bump re-runs the repair passes
 * (fill any key that is missing, replace a legacy orders blob,
 * ensureRequestedQuote, the work queue) and fills keys that did not exist
 * before. Rewording copy inside a key that is already populated is still only
 * reachable by ?reset=1, exactly as it was before the marker existed.
 *
 * 2: Tessa's AI members (AM_MEMBER_CAST). Three new persona worlds, so three
 *    accounts to seed from nothing, plus her three new connections. Her
 *    connections key is already populated in the live demo and the rule above
 *    means a bump will not rewrite it, so those three arrive through a repair
 *    pass (ensureAmMemberConnections) rather than through the seed proper.
 * 3: Tessa on her own members' project teams instead of Kim (castProjectTeam),
 *    so the account manager on the project is the account manager working it,
 *    and so the discussion can tell she belongs there. Their projects keys are
 *    already populated in the live demo from v2, so the same rule applies and
 *    the same answer follows: a repair pass, ensureAmOnProjectTeams.
 */
export const SEED_VERSION = 3;

/**
 * The version of the demo conversations seeded into TWILIO.
 *
 * Separate from SEED_VERSION because it versions a different store with a
 * different repair story, and it is load-bearing in a way SEED_VERSION is not.
 * twilio-conversations.mjs skips its seed when this marker is current, and that
 * seed is the only thing that runs `ensureConversation` ->
 * `refreshConversationCopy`, which is the one path in this codebase that can
 * update the friendlyName and attributes of a conversation already live in
 * Twilio.
 *
 * So: BUMP THIS whenever the conversation copy changes. That means DEMO_DETAILS
 * in twilio-conversations.mjs, AM_THREAD_SCRIPT or HOMEOWNER_THREAD_SCRIPT in
 * this file, or any of the names, roles, or attributes any of them writes. Skip
 * the bump and the refresh never runs for accounts that already exist, the
 * rewritten copy never reaches the live demo, and we are back in exactly the
 * trap refreshConversationCopy was added to escape.
 *
 * 2: Tessa's three AI members join AM_THREAD_SCRIPT, and the homeowner stops
 *    being handed the trade pro's six threads and gets HOMEOWNER_THREAD_SCRIPT
 *    instead. The homeowner half of that is the half that needs this bump most:
 *    without it Alicia keeps the threads she already has, which are Justin's.
 */
export const TWILIO_SEED_VERSION = 2;

/**
 * Where the markers live: the same per-user store and the same `${userId}::`
 * convention as the data they describe, so one `list` of that prefix sees both
 * the marker and the keys it vouches for.
 *
 * Deliberately not in user-data.mjs's ALLOWED_KEYS: these are the server's own
 * bookkeeping, and a client that could write them could tell the seed to skip.
 */
export const seedMarkerKey = (userId) => blobKey(userId, "seed-marker");
export const twilioSeedMarkerKey = (userId) => blobKey(userId, "twilio-seed-marker");

/**
 * Both markers, for ?reset=1 to clear. A reset that left a marker behind would
 * leave it swearing an account is seeded that has just been wiped, which is the
 * exact drift this whole design exists to avoid.
 */
export const seedMarkerKeys = (userId) => [
  seedMarkerKey(userId),
  twilioSeedMarkerKey(userId),
];

// Every key a world can seed. The marker records which of these an account was
// actually given (a persona with a null builder owns nothing under that key), so
// a missing one can be spotted without reading any of them.
const SEEDED_KEYS = [
  "projects",
  "messages",
  "carts",
  "appointments",
  "orders",
  "connections",
];

const keysForWorld = (world) => SEEDED_KEYS.filter((key) => !!world[key]);

/**
 * Is this account already seeded with the current content, and is that content
 * still actually there?
 *
 * The marker alone is not enough to answer that. A marker that says "done" while
 * the data has been wiped pins the demo to an empty app forever, and no amount
 * of signing in repairs it. Re-seeding every time was slow precisely because it
 * was self-healing, and that property is worth keeping. So the marker is checked
 * against reality, cheaply:
 *
 *   • one `list` of the user's own key prefix. It returns key names and etags,
 *     never payloads, so it costs one request instead of six reads of the
 *     largest JSON documents in the account.
 *   • the account manager's work queue lives in a different store and cannot be
 *     seen from that list, so it is read directly, and only when the marker says
 *     this account put something on it. An empty work queue was a real reported
 *     bug and is not something to leave to a flag.
 *
 * Anything that cannot be proved is treated as not seeded. The cost of a
 * needless seed is a slow sign-in; the cost of a wrong skip is a broken demo.
 */
const seededContentIsIntact = async (store, userId, personaKey, expectedKeys) => {
  const [marker, listing] = await Promise.all([
    store.get(seedMarkerKey(userId), { type: "json" }).catch(() => null),
    store.list({ prefix: `${userId}::` }).catch(() => null),
  ]);

  if (!marker) return false;
  if (marker.version !== SEED_VERSION) return false;
  // A marker written by a different world describes different keys, so it cannot
  // vouch for this one.
  if (marker.persona !== personaKey) return false;
  // Could not see reality: do not guess, seed.
  if (!listing) return false;

  const present = new Set((listing.blobs || []).map((b) => b.key));
  if (!expectedKeys.every((key) => present.has(blobKey(userId, key)))) return false;

  const queuedDocIds = Array.isArray(marker.queuedDocIds) ? marker.queuedDocIds : [];
  if (queuedDocIds.length) {
    const queue = await readSeedQueue();
    if (!queue) return false;
    // By document id and not by status, matching enqueueSeededQuotes: a quote the
    // account manager has since priced is still on the queue as handled, and is
    // not work that went missing.
    const onQueue = new Set(queue.map((item) => item?.docId).filter(Boolean));
    if (!queuedDocIds.every((id) => onQueue.has(id))) return false;
  }

  return true;
};

/**
 * Seed a new user. Writes each key only if it is currently empty so re-running
 * doesn't clobber edits.
 *
 * `persona` picks which world to seed. It defaults to 'tradepro', which is the
 * only world that existed before and is what otp-verify.mjs still asks for by
 * calling this with one argument.
 *
 * `force` skips the marker and goes and looks. It means "do not trust the
 * bookkeeping", not "rebuild": the write-only-if-empty rule still holds, so a
 * forced seed fills what is missing and leaves what is there. Throwing data away
 * is ?reset=1's job and only ?reset=1's job.
 *
 * Returns { seeded, skipped } so a caller can tell a real seed from a marker
 * hit. Never throws: a demo sign-in must not fail because seeding did.
 */
export async function seedNewUser(userId, persona = DEFAULT_PERSONA, { force = false } = {}) {
  if (!userId) return { seeded: false, skipped: false };
  try {
    const personaKey = WORLD_BY_PERSONA[persona] ? persona : DEFAULT_PERSONA;
    const world = WORLD_BY_PERSONA[personaKey];
    const store = getStore({ name: "ps-user-data", consistency: "strong" });
    const now = Date.now();
    const expectedKeys = keysForWorld(world);

    // The whole point of the marker: on an account that has signed in before,
    // this is two cheap requests and we are done, instead of six reads of every
    // seeded blob plus a queue round trip.
    if (!force && (await seededContentIsIntact(store, userId, personaKey, expectedKeys))) {
      return { seeded: false, skipped: true, version: SEED_VERSION };
    }

    const projectsKey = blobKey(userId, "projects");
    const messagesKey = blobKey(userId, "messages");
    const cartsKey = blobKey(userId, "carts");
    const appointmentsKey = blobKey(userId, "appointments");
    const ordersKey = blobKey(userId, "orders");
    const connectionsKey = blobKey(userId, "connections");

    const [
      existingProjects,
      existingMessages,
      existingCarts,
      existingAppts,
      existingOrders,
      existingConns,
    ] = await Promise.all([
      store.get(projectsKey, { type: "json" }).catch(() => null),
      store.get(messagesKey, { type: "json" }).catch(() => null),
      store.get(cartsKey, { type: "json" }).catch(() => null),
      store.get(appointmentsKey, { type: "json" }).catch(() => null),
      store.get(ordersKey, { type: "json" }).catch(() => null),
      store.get(connectionsKey, { type: "json" }).catch(() => null),
    ]);

    // Built up front (pure, since nothing is written unless the key is empty) because
    // the connections seed derives its shared-project counts from the team
    // arrays on these projects.
    const seedProjects = world.projects ? world.projects(now) : null;
    let projectList = seedProjects ? seedProjects.payload.list : [];

    let projectIds;
    if (!existingProjects) {
      // A persona with no projects of its own still needs the shape: the keys
      // are all null, which is what a thread with nothing to link to already
      // gets when an existing list has no project in that state.
      projectIds = seedProjects
        ? seedProjects.ids
        : { working: null, complete: null, published: null };
      if (seedProjects) {
        await store.setJSON(projectsKey, { value: seedProjects.payload, updatedAt: now });
      }
    } else {
      // Already seeded, so the write above will not run: make sure the account
      // manager is on the teams of the list that is already there. Before the id
      // extraction below, so `projectList` carries the repaired teams.
      // See ensureAmOnProjectTeams.
      if (world.amOnTeam) {
        const repaired = await ensureAmOnProjectTeams(
          store, projectsKey, existingProjects, now
        );
        if (repaired) existingProjects.value = { ...existingProjects.value, list: repaired };
      }
      // Try to extract IDs from existing list so messages can still link.
      try {
        const list = existingProjects?.value?.list || [];
        projectList = list;
        projectIds = {
          working: list.find((p) => p.status === "working")?.id || null,
          complete: list.find((p) => p.status === "complete")?.id || null,
          published: list.find((p) => p.status === "published")?.id || null,
        };
      } catch {
        projectIds = { working: null, complete: null, published: null };
      }
    }

    if (!existingMessages && world.messages) {
      const messages = world.messages(now, projectIds);
      await store.setJSON(messagesKey, { value: messages, updatedAt: now });
    }

    if (!existingCarts && world.carts) {
      // We don't know the user's display name here yet: save-profile is called
      // after onboarding and the cart "updatedBy" is purely cosmetic. Use a
      // generic "You" and the frontend overrides for new entries.
      const carts = world.carts(now, projectIds, "You");
      await store.setJSON(cartsKey, { value: carts, updatedAt: now });
    }

    if (!existingAppts && world.appointments) {
      const appts = world.appointments(now);
      await store.setJSON(appointmentsKey, { value: appts, updatedAt: now });
    }

    // Orders are the one seeded key we'll also REPLACE, not just fill in.
    // A pre-v2 blob is always pure seed data: before v2 the client never wrote
    // this key (Approve/Pay flipped a status in localStorage, not here), so
    // there is nothing of the user's to lose, and leaving it means every order
    // renders with no line items and no estimates tab. Once a v2 blob exists,
    // the user's approvals and payments live in it and we never touch it again.
    const ordersAreLegacy =
      existingOrders && existingOrders?.value?.schemaVersion !== ORDERS_SCHEMA_VERSION;
    // What the marker will claim this account has put on the work queue, and
    // whether the queue could be reached at all. Recorded so a later sign-in can
    // check the queue is genuinely still populated before skipping the enqueue.
    let queuedDocIds = [];
    let queueReached = true;
    if (world.orders) {
      let orders;
      if (!existingOrders || ordersAreLegacy) {
        orders = world.orders(now, projectIds, "You");
        await store.setJSON(ordersKey, { value: orders, updatedAt: now });
      } else if (world.requestedQuote) {
        // Already seeded and current: leave it alone apart from making sure the
        // demo's unpriced quote is present. See ensureRequestedQuote.
        orders = await ensureRequestedQuote(
          store, ordersKey, existingOrders.value, now, world.displayName
        );
      } else {
        orders = existingOrders.value;
      }
      // Outside the seeding branch on purpose: the queue lives in its own store,
      // so an account seeded before the queue existed still needs its pending
      // work put in front of an account manager. Idempotent by document id.
      const confirmed = await enqueueSeededQuotes(userId, orders, now, world.displayName);
      if (confirmed === null) queueReached = false;
      else queuedDocIds = confirmed;
    }

    if (!existingConns && world.connections) {
      const conns = world.connections(projectList);
      await store.setJSON(connectionsKey, { value: conns, updatedAt: now });
    } else if (existingConns && world.ensureMembers) {
      // Already seeded, so the write above will not run: make sure her AI
      // members are on the list she already has. See ensureAmMemberConnections.
      await ensureAmMemberConnections(store, connectionsKey, existingConns, now);
    }

    // Last, and only once everything above has actually landed. Anything that
    // threw on the way here skips this, so the account stays unmarked and the
    // next sign-in seeds it again: a half-seeded account with no marker is
    // repairable, a half-seeded account with one is not.
    if (queueReached) {
      await store.setJSON(seedMarkerKey(userId), {
        version: SEED_VERSION,
        persona: personaKey,
        // Not the key list: the version already pins which world wrote this, so
        // the reader recomputes the expected keys from that world rather than
        // trusting a list the marker carries about itself.
        queuedDocIds,
        seededAt: now,
      });
    }

    return { seeded: true, skipped: false, version: SEED_VERSION };
  } catch (err) {
    console.warn("seedNewUser failed:", err.message);
    return { seeded: false, skipped: false, error: err.message };
  }
}
