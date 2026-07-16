import { getStore } from "@netlify/blobs";

/**
 * Incoming connection requests: real, persistent, blob-backed.
 *
 * GET  /api/connection-requests?userId=X
 *      → { requests: [...], list: [...] }
 *      Seeds a demo set of incoming requests the first time a user asks, so the
 *      demo has something to accept. The seed marker means declining them all
 *      sticks; they do not come back on reload.
 *
 * POST /api/connection-requests { userId, requestId, action: 'accept'|'decline' }
 *      → { requests: [...], list: [...], connection? }
 *      'accept' removes the request AND appends a real connection to the same
 *      list the connections page reads. 'decline' just removes it. Both persist.
 *
 * State lives inside the SAME blob the connections page already reads
 * (`${userId}::connections` in the ps-user-data store), under a `requests` key,
 * so the frontend gets connections + requests from one loadUserData call and
 * the user-data key whitelist doesn't need a new entry.
 *
 * Demo only: no auth check (consistent with user-data.mjs).
 */

const blobKey = (userId) => `${userId}::connections`;

// Seeded incoming requests. `demoIdentity` is what makes an accepted request
// messageable. See the identity contract:
//   demoIdentity → seeded demo contact · userId → real user · neither → pending.
const buildSeedRequests = (now) => [
  {
    id: "req-mike-johnson",
    name: "Mike Johnson",
    initials: "MJ",
    role: "General Contractor",
    type: "tradepro",
    email: "mike.johnson@builds.com",
    phone: "(314) 555-0311",
    location: "Maryland Heights, MO",
    demoIdentity: "demo-mike-johnson",
    message:
      "Hi! I worked with Ryan O'Toole on a project and he recommended connecting.",
    receivedAt: now - 1000 * 60 * 60 * 26,
  },
  {
    id: "req-lisa-park",
    name: "Lisa Park",
    initials: "LP",
    role: "Homeowner",
    type: "client",
    email: "lisa.park@email.com",
    phone: "(314) 555-0477",
    location: "Webster Groves, MO",
    demoIdentity: "demo-lisa-park",
    message: "Looking for a designer for my kitchen remodel project.",
    receivedAt: now - 1000 * 60 * 60 * 5,
  },
];

const readValue = async (store, userId) => {
  const raw = await store.get(blobKey(userId), { type: "json" }).catch(() => null);
  // user-data.mjs and seed.mjs both wrap as { value, updatedAt }.
  const value = raw && typeof raw === "object" && "value" in raw ? raw.value : raw;
  return value && typeof value === "object" ? value : {};
};

const writeValue = async (store, userId, value) => {
  await store.setJSON(blobKey(userId), { value, updatedAt: Date.now() });
};

export default async function handler(req) {
  try {
    const store = getStore({ name: "ps-user-data", consistency: "strong" });
    const now = Date.now();

    if (req.method === "GET") {
      const userId = new URL(req.url).searchParams.get("userId");
      if (!userId) {
        return Response.json({ error: "userId required" }, { status: 400 });
      }

      const value = await readValue(store, userId);
      const list = Array.isArray(value.list) ? value.list : [];

      if (!value.requestsSeeded) {
        const requests = buildSeedRequests(now);
        await writeValue(store, userId, {
          ...value,
          list,
          requests,
          requestsSeeded: true,
        });
        return Response.json({ requests, list });
      }

      return Response.json({
        requests: Array.isArray(value.requests) ? value.requests : [],
        list,
      });
    }

    if (req.method === "POST") {
      const body = await req.json().catch(() => ({}));
      const { userId, requestId, action } = body || {};
      if (!userId || !requestId || !["accept", "decline"].includes(action)) {
        return Response.json(
          { error: "userId, requestId and action ('accept'|'decline') required" },
          { status: 400 }
        );
      }

      const value = await readValue(store, userId);
      const requests = Array.isArray(value.requests) ? value.requests : [];
      const list = Array.isArray(value.list) ? value.list : [];

      const request = requests.find((r) => String(r.id) === String(requestId));
      if (!request) {
        return Response.json({ error: "Request not found" }, { status: 404 });
      }

      const nextRequests = requests.filter((r) => String(r.id) !== String(requestId));
      let nextList = list;
      let connection = null;

      if (action === "accept") {
        // De-dupe by email so accepting someone already in the list is a no-op
        // rather than a duplicate card.
        const deduped = request.email
          ? list.filter(
              (c) => (c.email || "").toLowerCase() !== request.email.toLowerCase()
            )
          : list;

        connection = {
          id: `conn-${requestId}`,
          name: request.name,
          initials: request.initials,
          role: request.role,
          type: request.type,
          email: request.email || "",
          phone: request.phone || "",
          location: request.location || "",
          // Carry the identity through. This is what makes them messageable.
          ...(request.demoIdentity ? { demoIdentity: request.demoIdentity } : {}),
          ...(request.userId ? { userId: request.userId } : {}),
          status: "connected",
          projects: 0,
          // Their request message becomes the opening line of the conversation.
          ...(request.message
            ? { introMessage: request.message, introMessageFrom: "them" }
            : {}),
          addedAt: now,
          source: "request-accepted",
        };
        nextList = [...deduped, connection];
      }

      await writeValue(store, userId, {
        ...value,
        list: nextList,
        requests: nextRequests,
        requestsSeeded: true,
      });

      return Response.json({ requests: nextRequests, list: nextList, connection });
    }

    return new Response("Method not allowed", { status: 405 });
  } catch (err) {
    console.error("connection-requests error:", err);
    return Response.json({ error: err.message }, { status: 500 });
  }
}
