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
          rooms: ["Kitchen", "Pantry"],
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
          rooms: ["Master Bathroom"],
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
          rooms: ["Outdoor/Patio"],
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

// Seeded connections — same counterparties that appear in seeded messages
// (Kim, Bubba, Ryan, Sarah, Heather) plus a couple of extra tradepros.
const buildSeedConnections = () => ({
  list: [
    {
      id: 1, name: 'Kim Marks', initials: 'KM', role: 'Account Manager',
      type: 'prosource', email: 'kim.marks@prosource.com',
      phone: '(314) 555-0142', location: 'ProSource of St. Louis', projects: null,
    },
    {
      id: 2, name: 'Heather Yager', initials: 'HY', role: 'Designer',
      type: 'prosource', email: 'heather.yager@prosource.com',
      phone: '(314) 555-0188', location: 'ProSource of St. Louis', projects: null,
    },
    {
      id: 3, name: 'Bubba Beans', initials: 'BB', role: 'Homeowner',
      type: 'client', email: 'bubba.beans@email.com',
      phone: '(314) 555-0123', location: 'St. Louis, MO', projects: 1,
    },
    {
      id: 4, name: 'Sarah Chen', initials: 'SC', role: 'Homeowner',
      type: 'client', email: 'sarah.chen@email.com',
      phone: '(314) 555-5678', location: 'Chesterfield, MO', projects: 1,
    },
    {
      id: 5, name: "Ryan O'Toole", initials: 'RO', role: 'Flooring Installer',
      type: 'tradepro', email: 'ryan@otooleinstalls.com',
      phone: '(314) 555-0789', location: 'St. Charles, MO', projects: 5,
    },
    {
      id: 6, name: 'James Anderson', initials: 'JA', role: 'General Contractor',
      type: 'tradepro', email: 'james@andersonbuilds.com',
      phone: '(314) 555-1234', location: 'Chesterfield, MO', projects: 3,
    },
    {
      id: 7, name: 'Mike Torres', initials: 'MT', role: 'Tile Installer',
      type: 'tradepro', email: 'mike@torrestile.com',
      phone: '(314) 555-9012', location: 'Kirkwood, MO', projects: 4,
    },
  ],
});

// Seeded saved carts tied to the seeded projects.
const buildSeedCarts = (now, projectIds, displayName) => {
  const fmt = (ts) => new Date(ts).toLocaleDateString('en-US');
  return {
    list: [
      {
        id: `cart-${now}-beans-lvp`,
        name: 'Beans Kitchen — LVP Samples',
        projectId: projectIds.working || null,
        updatedAt: fmt(now - days(2)),
        updatedAtTs: now - days(2),
        updatedBy: displayName,
        itemCount: 3,
        products: [
          { id: 1, name: 'Shaw Greige Oak LVP', sku: 'SH-GO-LVP', category: 'Flooring', qty: 1, price: 0 },
          { id: 2, name: 'Shaw Smoked Walnut LVP', sku: 'SH-SW-LVP', category: 'Flooring', qty: 1, price: 0 },
          { id: 3, name: 'Daltile Mission Stone 12x24 Gray', sku: 'MS-T1224-GR', category: 'Tile', qty: 1, price: 0 },
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

    let projectIds;
    if (!existingProjects) {
      const { ids, payload } = buildSeedProjects(now);
      projectIds = ids;
      await store.setJSON(projectsKey, { value: payload, updatedAt: now });
    } else {
      // Try to extract IDs from existing list so messages can still link.
      try {
        const list = existingProjects?.value?.list || [];
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
      const conns = buildSeedConnections();
      await store.setJSON(connectionsKey, { value: conns, updatedAt: now });
    }
  } catch (err) {
    console.warn("seedNewUser failed:", err.message);
  }
}
