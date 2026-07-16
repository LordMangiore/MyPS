import { getStore } from "@netlify/blobs";
import { Resend } from "resend";
import {
  TWILIO_ENABLED,
  getRestClient,
  ensureConversation,
} from "./lib/twilio.mjs";

const FROM_ADDRESS = process.env.RESEND_FROM || "ProSource <onboarding@resend.dev>";
const DEV_BYPASS = process.env.OTP_DEV_BYPASS === "true" || !process.env.RESEND_API_KEY;
const getResend = () => new Resend(process.env.RESEND_API_KEY);

const escapeHtml = (s) =>
  String(s || "").replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  }[c]));

/**
 * Capture a consultation lead from a pro's profile page.
 *
 * POST body:
 *   { toProName, toProUserId, fromName, fromEmail, fromPhone, fromUserId?,
 *     projectType, zip, budget, timing, message, createdAt }
 *
 * Side effects:
 *   1. Save into `ps-consultation-requests/{toProUserId}` (or unassigned bucket)
 *   2. If both sides have user IDs AND Twilio is live: create a Conversation
 *      between fromUserId and toProUserId, post the message as the first
 *      message, attribute it to fromUserId
 *   3. Email the pro a heads-up (if their email is known)
 *   4. Email the requester a confirmation
 */
export default async function handler(req) {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  try {
    const body = await req.json();
    const {
      toProName,
      toProUserId,
      fromName,
      fromEmail,
      fromPhone,
      fromUserId,
      projectType,
      zip,
      budget,
      timing,
      message,
      createdAt,
    } = body || {};

    if (!fromName || !fromEmail || !projectType) {
      return Response.json(
        { error: "Missing required fields (name, email, projectType)" },
        { status: 400 }
      );
    }

    const requestId = `cr-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const record = {
      id: requestId,
      toProName,
      toProUserId: toProUserId || null,
      fromName,
      fromEmail: fromEmail.toLowerCase().trim(),
      fromPhone: fromPhone || "",
      fromUserId: fromUserId || null,
      projectType,
      zip: zip || "",
      budget: budget || "",
      timing: timing || "",
      message: message || "",
      createdAt: createdAt || Date.now(),
      status: "new",
    };

    // 1) Persist on the pro's side so they can see incoming leads.
    try {
      const store = getStore({ name: "ps-consultation-requests", consistency: "strong" });
      const bucketKey = toProUserId || "unassigned";
      const existing = await store.get(bucketKey, { type: "json" }).catch(() => null);
      const list = Array.isArray(existing?.list) ? existing.list : [];
      await store.setJSON(bucketKey, {
        list: [...list, record],
        updatedAt: Date.now(),
      });
    } catch (err) {
      console.warn("consultation persist failed:", err.message);
    }

    // 2) If both identities are known + Twilio is live, kick off a thread.
    let conversationSid = null;
    if (TWILIO_ENABLED && fromUserId && toProUserId) {
      try {
        const client = getRestClient();
        const convo = await ensureConversation({
          uniqueName: `consult-${fromUserId}__${toProUserId}`,
          friendlyName: `${fromName} — ${projectType}`,
          attributes: {
            counterpartyName: fromName,
            counterpartyInitials: (fromName || "?").split(/\s+/).map((s) => s[0]).join("").slice(0, 2),
            counterpartyRole: "Consultation lead",
            counterpartyType: "client",
            projectType,
            zip,
            budget,
            timing,
            origin: "consultation",
          },
          participants: [fromUserId, toProUserId],
        });
        await client.conversations.v1
          .conversations(convo.sid)
          .messages.create({ author: fromUserId, body: message || "" });
        conversationSid = convo.sid;
      } catch (err) {
        console.warn("consultation Twilio kickoff failed:", err.message);
      }
    }

    // 3) Email the pro (best-effort).
    if (!DEV_BYPASS) {
      try {
        // The pro's email lives on their saved profile.
        let proEmail = null;
        if (toProUserId) {
          const users = getStore({ name: "ps-users", consistency: "strong" });
          const proProfile = await users.get(toProUserId, { type: "json" }).catch(() => null);
          proEmail = proProfile?.email || null;
        }
        if (proEmail) {
          await getResend().emails.send({
            from: FROM_ADDRESS,
            to: proEmail,
            subject: `New consultation request from ${fromName}`,
            html: `
              <div style="font-family: 'Open Sans', -apple-system, sans-serif; max-width: 520px; padding: 32px 24px; color: #171717;">
                <div style="margin-bottom: 22px;">
                  <span style="font-size: 20px; font-weight: 700; color: #003087;">ProSource</span>
                </div>
                <h2 style="margin: 0 0 6px; font-size: 19px;">New lead</h2>
                <p style="margin: 0 0 18px; color: #525252;">
                  ${escapeHtml(fromName)} just sent a consultation request via your profile.
                </p>
                <div style="background: #f8f9fa; border-radius: 8px; padding: 14px 18px; margin-bottom: 18px;">
                  <p style="margin: 0 0 6px;"><strong>Project:</strong> ${escapeHtml(projectType)}</p>
                  ${zip ? `<p style="margin: 0 0 6px;"><strong>Zip:</strong> ${escapeHtml(zip)}</p>` : ""}
                  ${budget ? `<p style="margin: 0 0 6px;"><strong>Budget:</strong> ${escapeHtml(budget)}</p>` : ""}
                  ${timing ? `<p style="margin: 0 0 6px;"><strong>Timing:</strong> ${escapeHtml(timing)}</p>` : ""}
                  <p style="margin: 0 0 6px;"><strong>From:</strong> ${escapeHtml(fromName)} · ${escapeHtml(fromEmail)}${fromPhone ? " · " + escapeHtml(fromPhone) : ""}</p>
                </div>
                ${message ? `<div style="border-left: 3px solid #003087; padding: 4px 14px; color: #404040; font-size: 14px; line-height: 1.55; white-space: pre-wrap;">${escapeHtml(message)}</div>` : ""}
                <p style="margin: 28px 0 0; color: #6b7280; font-size: 12px;">
                  Reply directly to start the conversation, or open the thread inside ProSource.
                </p>
              </div>
            `,
          });
        }

        // 4) Confirmation to the requester.
        await getResend().emails.send({
          from: FROM_ADDRESS,
          to: fromEmail,
          subject: `Your request to ${toProName} is on the way`,
          html: `
            <div style="font-family: 'Open Sans', -apple-system, sans-serif; max-width: 520px; padding: 32px 24px; color: #171717;">
              <div style="margin-bottom: 22px;">
                <span style="font-size: 20px; font-weight: 700; color: #003087;">ProSource</span>
              </div>
              <h2 style="margin: 0 0 12px; font-size: 19px;">We sent your request to ${escapeHtml(toProName)}.</h2>
              <p style="margin: 0 0 14px; color: #525252; line-height: 1.55;">
                They'll reach out within a business day. Want to track the conversation in one place?
                <a href="${process.env.URL || "https://myprosource.netlify.app"}/" style="color: #003087; font-weight: 600;">Claim your account</a>.
              </p>
            </div>
          `,
        });
      } catch (err) {
        console.warn("Resend consultation emails failed:", err.message);
      }
    }

    return Response.json({ success: true, requestId, conversationSid });
  } catch (err) {
    console.error("consultation-request error:", err);
    return Response.json({ error: err.message }, { status: 500 });
  }
}
