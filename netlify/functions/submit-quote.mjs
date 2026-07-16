import { getStore } from "@netlify/blobs";
import { Resend } from "resend";

const FROM_ADDRESS = process.env.RESEND_FROM || "ProSource <onboarding@resend.dev>";
const DEV_BYPASS = process.env.OTP_DEV_BYPASS === "true" || !process.env.RESEND_API_KEY;
const getResend = () => new Resend(process.env.RESEND_API_KEY);

const escapeHtml = (s) =>
  String(s || "").replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  }[c]));

const days = (n) => 24 * 60 * 60 * 1000 * n;

const TIMING_TO_TARGET = {
  asap: { startOffset: 7, completionOffset: 60 },
  '1-3': { startOffset: 21, completionOffset: 90 },
  '3-6': { startOffset: 90, completionOffset: 180 },
  exploring: { startOffset: null, completionOffset: null },
};

/**
 * Convert a guest cart submission into a real project + lead.
 *
 * Caller must have already verified the requester's email via otp-verify so we
 * trust `userId` and `email` on the body. The wizard wires these from the
 * verify response.
 *
 * POST body:
 *   { userId, email, firstName, lastName, phone, projectType, zip, timing,
 *     notes, cartItems[{ name, sku, category, qty, price }] }
 *
 * Side effects:
 *   1. Look up showroom + AM by zip (lookupCrm)
 *   2. Persist/refresh the user's profile with name, phone, showroom, AM
 *   3. Create a project in ps-user-data/projects with the cart items as products
 *      and the AM + Designer auto-added to the team
 *   4. Save a copy into ps-consultation-requests so the AM can find leads later
 *   5. Email the AM (the in-app "AM notification") with the lead summary
 *   6. Email the requester confirming the quote
 *
 * Returns { projectId, userId, showroom, accountManager }.
 */
export default async function handler(req) {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  try {
    const body = await req.json();
    const {
      userId,
      email,
      firstName = "",
      lastName = "",
      phone = "",
      audience = "",
      projectType,
      zip,
      budget = "",
      timing = "exploring",
      notes = "",
      cartItems = [],
      // 'quote' (default) → notify the AM of a hot quote request.
      // 'save'            → create project + account, but no quote signal.
      //                     AM still sees the lead, just not as "wants pricing".
      intent = "quote",
    } = body || {};
    const isSave = intent === "save";

    if (!userId || !email) {
      return Response.json({ error: "userId + email required (verify OTP first)" }, { status: 400 });
    }
    if (!projectType || !zip) {
      return Response.json({ error: "projectType + zip required" }, { status: 400 });
    }

    // 1) Showroom + AM lookup (mirrors lookupCrm in /api/lookup-showroom).
    let showroom = null;
    let accountManager = null;
    try {
      const baseUrl =
        process.env.URL ||
        `${req.headers.get("x-forwarded-proto") || "http"}://${req.headers.get("host")}`;
      const lookupRes = await fetch(`${baseUrl}/api/lookup-showroom`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ zip }),
      });
      const lookupData = await lookupRes.json();
      showroom = lookupData?.showroom || null;
      accountManager = lookupData?.manager || null;
    } catch (err) {
      console.warn("showroom lookup failed:", err.message);
    }

    const now = Date.now();
    const normalizedEmail = String(email).toLowerCase().trim();

    // 2) Persist / refresh user profile.
    try {
      const users = getStore({ name: "ps-users", consistency: "strong" });
      const existing = (await users.get(userId, { type: "json" }).catch(() => null)) || {};
      const merged = {
        ...existing,
        userId,
        email: normalizedEmail,
        firstName: firstName || existing.firstName || "",
        lastName: lastName || existing.lastName || "",
        phone: phone || existing.phone || "",
        userType: existing.userType || "homeowner",
        showroom: showroom || existing.showroom || null,
        accountManager: accountManager || existing.accountManager || null,
        updatedAt: now,
        createdAt: existing.createdAt || now,
      };
      await users.setJSON(userId, merged);

      const emailStore = getStore("ps-email-to-user");
      const mapping = (await emailStore.get(normalizedEmail, { type: "json" })) || {};
      await emailStore.setJSON(normalizedEmail, {
        ...mapping,
        userId,
        name: [firstName, lastName].filter(Boolean).join(" ") || mapping.name,
        updatedAt: now,
      });
    } catch (err) {
      console.warn("profile persist failed:", err.message);
    }

    // 3) Create the project with the cart contents.
    const target = TIMING_TO_TARGET[timing] || TIMING_TO_TARGET.exploring;
    const projectId = `proj-${now}-${Math.random().toString(36).slice(2, 7)}`;
    const projectName = `${(lastName || firstName || normalizedEmail.split("@")[0])} ${projectType}`.trim();

    // Showroom team (Kim + Heather equivalent) auto-added based on lookup.
    const showroomTeam = [];
    if (accountManager?.name) {
      showroomTeam.push({
        connectionId: `am-${normalizedEmail}`,
        name: accountManager.name,
        initials:
          accountManager.initials ||
          accountManager.name.split(/\s+/).map((s) => s[0]).join("").slice(0, 2),
        role: accountManager.title || "Account Manager",
        type: "prosource",
        addedAt: now,
      });
    }

    const projectRecord = {
      id: projectId,
      name: projectName,
      type: projectType,
      description: notes,
      address: zip,
      budgetRange: budget || "Not Sure Yet",
      audience,
      targetStart: target.startOffset ? new Date(now + days(target.startOffset)).toISOString().slice(0, 10) : "",
      targetCompletion: target.completionOffset ? new Date(now + days(target.completionOffset)).toISOString().slice(0, 10) : "",
      squareFootage: "",
      rooms: [],
      notes,
      status: "working",
      archived: false,
      team: showroomTeam,
      products: cartItems.map((item, idx) => ({
        id: item.id || idx + 1,
        name: item.name || "Product",
        sku: item.sku || `SKU-${idx + 1}`,
        category: item.category || "Other",
        qty: item.qty || 1,
        price: item.price || 0,
      })),
      origin: isSave ? "project-save" : "quote-submission",
      quoteRequested: !isSave,
      createdAt: now,
      updatedAt: now,
    };

    try {
      const userData = getStore({ name: "ps-user-data", consistency: "strong" });
      const existingProjects = await userData
        .get(`${userId}::projects`, { type: "json" })
        .catch(() => null);
      const list = Array.isArray(existingProjects?.value?.list)
        ? existingProjects.value.list
        : [];
      await userData.setJSON(`${userId}::projects`, {
        value: { list: [projectRecord, ...list] },
        updatedAt: now,
      });
    } catch (err) {
      console.warn("project persist failed:", err.message);
      return Response.json({ error: "Failed to create project: " + err.message }, { status: 500 });
    }

    // 4) Record the lead for the AM (separate bucket so they can manage leads).
    try {
      const leadStore = getStore({ name: "ps-consultation-requests", consistency: "strong" });
      const bucketKey = accountManager?.email || showroom?.id || "unassigned";
      const existing = await leadStore.get(bucketKey, { type: "json" }).catch(() => null);
      const list = Array.isArray(existing?.list) ? existing.list : [];
      await leadStore.setJSON(bucketKey, {
        list: [
          ...list,
          {
            id: `lead-${now}-${Math.random().toString(36).slice(2, 7)}`,
            kind: isSave ? "project-save" : "quote",
            projectId,
            fromName: [firstName, lastName].filter(Boolean).join(" ") || normalizedEmail,
            fromEmail: normalizedEmail,
            fromPhone: phone,
            fromUserId: userId,
            audience,
            projectType,
            zip,
            budget,
            timing,
            notes,
            cartItemCount: cartItems.length,
            cartSubtotal: cartItems.reduce((s, i) => s + (i.price || 0) * (i.qty || 1), 0),
            showroomId: showroom?.id,
            accountManagerEmail: accountManager?.email,
            createdAt: now,
          },
        ],
        updatedAt: now,
      });
    } catch (err) {
      console.warn("lead persist failed:", err.message);
    }

    // 5) Email the AM. Skip in dev bypass.
    if (!DEV_BYPASS && accountManager?.email) {
      try {
        const itemLines = cartItems
          .slice(0, 8)
          .map((i) => `<li>${escapeHtml(i.name)} <span style="color:#6b7280;">(qty ${i.qty || 1}${i.price ? " · $" + i.price : ""})</span></li>`)
          .join("");
        const subtotal = cartItems.reduce((s, i) => s + (i.price || 0) * (i.qty || 1), 0);
        await getResend().emails.send({
          from: FROM_ADDRESS,
          to: accountManager.email,
          subject: isSave
            ? `New project (no quote yet): ${[firstName, lastName].filter(Boolean).join(" ") || normalizedEmail} — ${projectType}`
            : `New lead: ${[firstName, lastName].filter(Boolean).join(" ") || normalizedEmail} — ${projectType}`,
          html: `
            <div style="font-family: 'Open Sans', -apple-system, sans-serif; max-width: 560px; padding: 32px 24px; color: #171717;">
              <div style="margin-bottom: 22px;">
                <span style="font-size: 20px; font-weight: 700; color: #003087;">ProSource</span>
              </div>
              <h2 style="margin: 0 0 6px; font-size: 19px;">${isSave ? 'New project saved (warm lead)' : 'New lead from your profile'}</h2>
              <p style="margin: 0 0 18px; color: #525252;">
                ${isSave
                  ? 'A homeowner built a project on ProSource and added products to it, but hasn\'t requested a quote yet. They picked you as their account manager. No immediate action needed — say hi when you have a moment.'
                  : 'A homeowner submitted a quote request via ProSource. Project + cart already saved on their account.'}
              </p>
              <div style="background:#f8f9fa;border-radius:8px;padding:14px 18px;margin-bottom:18px;">
                <p style="margin:0 0 6px;"><strong>Lead:</strong> ${escapeHtml([firstName, lastName].filter(Boolean).join(" ") || normalizedEmail)}</p>
                <p style="margin:0 0 6px;"><strong>Email:</strong> ${escapeHtml(normalizedEmail)}${phone ? " · <strong>Phone:</strong> " + escapeHtml(phone) : ""}</p>
                ${audience ? `<p style="margin:0 0 6px;"><strong>Buyer:</strong> ${escapeHtml(audience)}</p>` : ""}
                <p style="margin:0 0 6px;"><strong>Project:</strong> ${escapeHtml(projectType)}</p>
                <p style="margin:0 0 6px;"><strong>Zip:</strong> ${escapeHtml(zip)}</p>
                ${budget ? `<p style="margin:0 0 6px;"><strong>Budget:</strong> ${escapeHtml(budget)}</p>` : ""}
                <p style="margin:0 0 6px;"><strong>Timing:</strong> ${escapeHtml(timing)}</p>
                <p style="margin:0;"><strong>Cart subtotal:</strong> $${subtotal.toFixed(2)} (${cartItems.length} item${cartItems.length !== 1 ? "s" : ""})</p>
              </div>
              ${itemLines ? `<div style="margin-bottom:18px;"><strong>Items:</strong><ul style="margin:6px 0 0;padding-left:18px;color:#374151;">${itemLines}</ul></div>` : ""}
              ${notes ? `<div style="border-left:3px solid #003087;padding:6px 14px;color:#404040;font-size:14px;line-height:1.55;white-space:pre-wrap;">${escapeHtml(notes)}</div>` : ""}
            </div>
          `,
        });

        // Requester confirmation
        await getResend().emails.send({
          from: FROM_ADDRESS,
          to: normalizedEmail,
          subject: isSave
            ? `Your project is saved — ${projectType}`
            : `Quote submitted — ${projectType}`,
          html: `
            <div style="font-family: 'Open Sans', -apple-system, sans-serif; max-width: 480px; padding: 32px 24px; color: #171717;">
              <div style="margin-bottom: 22px;">
                <span style="font-size: 20px; font-weight: 700; color: #003087;">ProSource</span>
              </div>
              <h2 style="margin: 0 0 6px; font-size: 19px;">${isSave ? 'Your project is saved.' : 'Your quote is in.'}</h2>
              <p style="margin: 0 0 14px; color: #525252; line-height: 1.55;">
                ${isSave
                  ? (accountManager?.name ? escapeHtml(accountManager.name) + " at " + escapeHtml(showroom?.name || "your ProSource showroom") : "Your ProSource team") + " is your account manager whenever you're ready for pricing or have questions."
                  : (accountManager?.name ? escapeHtml(accountManager.name) + " at " + escapeHtml(showroom?.name || "your ProSource showroom") : "Your ProSource team") + " will reach out within a business day."}
              </p>
              <p style="margin: 0 0 14px; color: #525252; line-height: 1.55;">
                In the meantime, you can <a href="${process.env.URL || "https://myprosource.netlify.app"}/projects/${projectId}" style="color:#003087;font-weight:600;">view your project</a> to add details, photos, or message your team.
              </p>
            </div>
          `,
        });
      } catch (err) {
        console.warn("Quote emails failed:", err.message);
      }
    }

    return Response.json({
      success: true,
      projectId,
      userId,
      showroom,
      accountManager,
    });
  } catch (err) {
    console.error("submit-quote error:", err);
    return Response.json({ error: err.message }, { status: 500 });
  }
}
