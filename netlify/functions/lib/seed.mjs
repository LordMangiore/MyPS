import { getStore } from "@netlify/blobs";

/**
 * Seed a brand-new user's blob with sample data so the demo looks populated
 * the moment they finish signup. Safe to call multiple times — only writes if
 * the key is empty.
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
// The id must match `roomIdFromName` in src/project-model.js — that's the
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
          team: [
            ...showroomTeam,
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
            room('Kitchen', now - days(14), { type: 'Kitchen', squareFootage: '180', notes: 'Sight-line to dining stays open — no upper cabinets on the south wall.' }),
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
            // Deliberately unassigned — shows the "Unassigned" group and gives
            // the demo something to drag into a room.
            product({
              id: 'prod-002', sku: 'sku-prod-002', name: 'COREtec Pro Plus Enhanced Luxury Vinyl Plank',
              brand: 'COREtec', category: 'LVP / LVT', colorName: 'Pembroke Pine',
              price: 4.99, unit: 'SF', sfPerBox: 36.64, qty: 2, image: IMG.lvp,
              roomId: null, addedAt: now - days(2),
            }),
          ],
          notes:
            "Client prefers appointments after 2pm. Dog in backyard — use side gate.",
          status: "working",
          archived: false,
          createdAt: now - days(14),
          updatedAt: now - days(2),
        },
        {
          id: ids.complete,
          name: "Wilson Master Bath",
          type: "Bathroom Remodel",
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
            room('Master Bathroom', now - days(110), { type: 'Bathroom', squareFootage: '90', notes: 'Curbless shower — floor slopes to the linear drain.' }),
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
            "Client has been great. Watch for tile manufacturer recall on the wall mosaic — bumped to v2 lot.",
          status: "complete",
          archived: false,
          createdAt: now - days(110),
          updatedAt: now - days(20),
        },
        {
          id: ids.published,
          name: "Chen Outdoor Patio & Outdoor Kitchen",
          type: "Other",
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

// Message seed builder — each thread references one of the seeded projects.
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
        role: "Homeowner — Beans Kitchen Remodel",
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
              "Hey Bubba — Kim has a couple of LVP samples set aside for the kitchen. Want to come look this weekend?",
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
              "Thanks again for hustling on the Wilson bath install — clients are thrilled.",
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
        role: "Homeowner — Chen Outdoor Patio",
        lastMessage:
          "We finally got the family photos done on the patio — it looks incredible. Thanks again!",
        timestamp: fmtRelativeTimestamp(sarahMsg2),
        unread: false,
        updatedAt: sarahMsg2,
        messages: [
          {
            id: 1,
            sender: "Me",
            isMe: true,
            text:
              "Hi Sarah — wanted to check in. Anything we should adjust before we put the patio in our portfolio?",
            time: fmtTime(sarahMsg1),
            date: fmtDate(sarahMsg1),
            timestamp: sarahMsg1,
          },
          {
            id: 2,
            sender: "Sarah Chen",
            isMe: false,
            text:
              "We finally got the family photos done on the patio — it looks incredible. Thanks again!",
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
          "Uploaded the Chen patio render variants — let me know which lighting layout you want me to spec out.",
        timestamp: fmtRelativeTimestamp(heatherMsg),
        unread: false,
        updatedAt: heatherMsg,
        messages: [
          {
            id: 1,
            sender: "Heather Yager",
            isMe: false,
            text:
              "Uploaded the Chen patio render variants — let me know which lighting layout you want me to spec out.",
            time: fmtTime(heatherMsg),
            date: fmtDate(heatherMsg),
            timestamp: heatherMsg,
          },
        ],
      },
    ],
  };
};

// Seeded orders tied to the seeded projects so /orders isn't empty.
const buildSeedOrders = (now, projectIds, displayName) => {
  const soldTo = (displayName || 'You').toUpperCase();
  const showroom = 'ProSource of St. Louis';
  const orderDate = (ts) => new Date(ts).toLocaleDateString('en-US');
  return {
    list: [
      {
        id: 'EC099016',
        projectId: projectIds.working || null,
        jobName: 'Beans Kitchen Remodel',
        orderDate: orderDate(now - days(3)),
        status: 'processing',
        statusText: 'Order Being Processed',
        soldTo,
        showroom,
        invoiceTotal: 1758.42,
        material: 1631.28,
        salesTax: 127.14,
        service: 0,
        totalPaid: 879.21,
        balanceDue: 879.21,
      },
      {
        id: 'EC096890',
        projectId: projectIds.working || null,
        jobName: 'Beans Kitchen Remodel',
        orderDate: orderDate(now - days(10)),
        status: 'ready',
        statusText: 'Order Ready for Approval',
        soldTo,
        showroom,
        invoiceTotal: 4713.89,
        material: 4364.71,
        salesTax: 349.18,
        service: 0,
        totalPaid: 0,
        balanceDue: 4713.89,
      },
      {
        id: 'EC094964',
        projectId: projectIds.complete || null,
        jobName: 'Wilson Master Bath',
        orderDate: orderDate(now - days(35)),
        status: 'complete',
        statusText: 'Order Complete',
        soldTo,
        showroom,
        invoiceTotal: 3241.56,
        material: 2986.50,
        salesTax: 255.06,
        service: 0,
        totalPaid: 3241.56,
        balanceDue: 0,
      },
      {
        id: 'EC090657',
        projectId: projectIds.published || null,
        jobName: 'Chen Outdoor Patio & Outdoor Kitchen',
        orderDate: orderDate(now - days(140)),
        status: 'complete',
        statusText: 'Order Complete',
        soldTo,
        showroom,
        invoiceTotal: 5318.76,
        material: 4924.78,
        salesTax: 393.98,
        service: 0,
        totalPaid: 5318.76,
        balanceDue: 0,
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
// DEMO_PARTICIPANTS identities in netlify/functions/twilio-conversations.mjs —
// that's how a connection card lines up with the conversation seeded for the
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
};

// Seeded connections — same counterparties that appear in seeded messages
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
        name: 'Beans Kitchen — Flooring Options',
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
        name: 'Beans Kitchen — Cabinet Hardware',
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
        name: 'Wilson Bath — Final Pickups',
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

const blobKey = (userId, key) => `${userId}::${key}`;

/**
 * Seed a new user. Writes projects + messages only if their key is currently
 * empty so re-running doesn't clobber edits.
 */
export async function seedNewUser(userId) {
  if (!userId) return;
  try {
    const store = getStore({ name: "ps-user-data", consistency: "strong" });
    const now = Date.now();

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

    // Built up front (pure — nothing is written unless the key is empty) because
    // the connections seed derives its shared-project counts from the team
    // arrays on these projects.
    const seedProjects = buildSeedProjects(now);
    let projectList = seedProjects.payload.list;

    let projectIds;
    if (!existingProjects) {
      projectIds = seedProjects.ids;
      await store.setJSON(projectsKey, { value: seedProjects.payload, updatedAt: now });
    } else {
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

    if (!existingMessages) {
      const messages = buildSeedMessages(now, projectIds);
      await store.setJSON(messagesKey, { value: messages, updatedAt: now });
    }

    if (!existingCarts) {
      // We don't know the user's display name here yet — save-profile is called
      // after onboarding and the cart "updatedBy" is purely cosmetic. Use a
      // generic "You" and the frontend overrides for new entries.
      const carts = buildSeedCarts(now, projectIds, "You");
      await store.setJSON(cartsKey, { value: carts, updatedAt: now });
    }

    if (!existingAppts) {
      const appts = buildSeedAppointments(now);
      await store.setJSON(appointmentsKey, { value: appts, updatedAt: now });
    }

    if (!existingOrders) {
      const orders = buildSeedOrders(now, projectIds, "You");
      await store.setJSON(ordersKey, { value: orders, updatedAt: now });
    }

    if (!existingConns) {
      const conns = buildSeedConnections(projectList);
      await store.setJSON(connectionsKey, { value: conns, updatedAt: now });
    }
  } catch (err) {
    console.warn("seedNewUser failed:", err.message);
  }
}
