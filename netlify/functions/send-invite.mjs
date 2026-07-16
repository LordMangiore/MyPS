import { Resend } from "resend";
import { getStore } from "@netlify/blobs";
import { randomUUID } from "node:crypto";

const FROM_ADDRESS = process.env.RESEND_FROM || "ProSource <onboarding@resend.dev>";

const DEV_BYPASS =
  process.env.OTP_DEV_BYPASS === "true" || !process.env.RESEND_API_KEY;

const getResend = () => new Resend(process.env.RESEND_API_KEY);

/**
 * Persist a real invite record keyed by a real token, so an invite is an actual
 * thing that exists rather than a fire-and-forget email. Stored in "ps-invites"
 * under the token, plus an email→token pointer so a resend reuses the same
 * invite instead of minting a new one.
 */
const recordInvite = async ({ toEmail, fromName, fromUserId, message, emailSent, emailError }) => {
  try {
    const store = getStore({ name: "ps-invites", consistency: "strong" });
    const normalized = String(toEmail).toLowerCase().trim();
    const pointerKey = `email::${normalized}`;

    const existingToken = await store
      .get(pointerKey, { type: "json" })
      .catch(() => null);
    const token = existingToken?.token || randomUUID();

    const prior = existingToken?.token
      ? await store.get(token, { type: "json" }).catch(() => null)
      : null;

    const record = {
      token,
      email: normalized,
      fromName: fromName || null,
      fromUserId: fromUserId || null,
      // The personal note travels with the invite so it is not lost when no
      // email goes out. Messaging can pick it up when they join.
      message: message || prior?.message || "",
      status: prior?.status || "pending",
      createdAt: prior?.createdAt || Date.now(),
      updatedAt: Date.now(),
      emailSent,
      emailError: emailError || null,
      sendCount: (prior?.sendCount || 0) + 1,
    };

    await store.setJSON(token, record);
    await store.setJSON(pointerKey, { token });
    return record;
  } catch (err) {
    console.error("recordInvite failed:", err);
    return null;
  }
};

const escapeHtml = (s) =>
  String(s || "").replace(/[&<>"']/g, (c) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  }[c]));

/**
 * Record a ProSource invitation and, if email is configured, send it.
 *
 * POST { toEmail, fromName, fromUserId?, fromBusinessName?, signupUrl?, message? }
 *
 * Always returns what ACTUALLY happened so the UI can say so:
 *   { success: true, emailSent: true,  token, inviteUrl }
 *   { success: true, emailSent: false, reason: "email-not-configured", token, inviteUrl }
 *   { success: true, emailSent: false, reason: "send-failed", error, token }
 *
 * The invite record is persisted either way, so the pending state is real and
 * survives a reload even when nothing is emailed.
 */
export default async function handler(req) {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  try {
    const { toEmail, fromName, fromUserId, fromBusinessName, signupUrl, message } =
      await req.json();
    if (!toEmail || !toEmail.includes("@")) {
      return Response.json({ error: "Valid toEmail required" }, { status: 400 });
    }

    const safeFromName = escapeHtml(fromName || "A trade pro");
    const safeFromBiz = escapeHtml(fromBusinessName || "");
    const safeMessage = escapeHtml(message || "");
    const linkUrl =
      signupUrl ||
      (process.env.URL ? process.env.URL : "https://myprosource.netlify.app") + "/";

    if (DEV_BYPASS) {
      console.log(
        `[send-invite] RESEND_API_KEY not configured. Recording invite for ${toEmail} from ${fromName}, NO email sent.`
      );
      const record = await recordInvite({
        toEmail,
        fromName,
        fromUserId,
        message,
        emailSent: false,
      });
      return Response.json({
        success: true,
        emailSent: false,
        reason: "email-not-configured",
        devBypass: true,
        token: record?.token || null,
        inviteUrl: record?.token ? `${linkUrl}?invite=${record.token}` : linkUrl,
      });
    }

    const fromLine = safeFromBiz
      ? `${safeFromName} at ${safeFromBiz}`
      : safeFromName;

    const { error } = await getResend().emails.send({
      from: FROM_ADDRESS,
      to: toEmail,
      subject: `${fromName || "A trade pro"} invited you to ProSource`,
      html: `
        <div style="font-family: 'Open Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 480px; margin: 0 auto; padding: 40px 24px; color: #171717;">
          <div style="margin-bottom: 28px;">
            <span style="font-size: 22px; font-weight: 700; color: #003087;">ProSource</span>
            <span style="font-size: 11px; font-weight: 400; color: #003087; letter-spacing: 1.5px; margin-left: 4px;">WHOLESALE</span>
          </div>
          <p style="font-size: 17px; line-height: 1.5; margin: 0 0 18px;">
            <strong>${fromLine}</strong> invited you to connect on ProSource.
          </p>
          ${safeMessage ? `
            <div style="border-left: 3px solid #003087; padding: 10px 14px; margin: 0 0 22px; background: #f8faff; color: #374151; font-size: 14px; line-height: 1.55; white-space: pre-wrap;">${safeMessage}</div>
          ` : ""}
          <p style="font-size: 14px; color: #374151; line-height: 1.6; margin: 0 0 22px;">
            ProSource is the wholesale platform trade pros and their clients use to manage projects, share product selections, and place orders together.
            Create your free account to accept the invitation.
          </p>
          <a href="${linkUrl}" style="display: inline-block; background: #003087; color: #fff; padding: 12px 22px; border-radius: 6px; text-decoration: none; font-weight: 600; font-size: 14px;">
            Accept invitation
          </a>
          <p style="color: #6b7280; font-size: 12px; line-height: 1.55; margin-top: 28px;">
            If you weren't expecting this, you can safely ignore the email.
          </p>
        </div>
      `,
    });

    if (error) {
      console.error("Resend invite error:", error);
      // The invite still exists; only the email failed. Record it and say so.
      const record = await recordInvite({
        toEmail,
        fromName,
        fromUserId,
        message,
        emailSent: false,
        emailError: error.message || "Email send failed",
      });
      return Response.json({
        success: true,
        emailSent: false,
        reason: "send-failed",
        error: error.message || "Email send failed",
        token: record?.token || null,
      });
    }

    const record = await recordInvite({
      toEmail,
      fromName,
      fromUserId,
      message,
      emailSent: true,
    });
    return Response.json({
      success: true,
      emailSent: true,
      token: record?.token || null,
      inviteUrl: record?.token ? `${linkUrl}?invite=${record.token}` : linkUrl,
    });
  } catch (err) {
    console.error("send-invite error:", err);
    return Response.json({ error: err.message }, { status: 500 });
  }
}
