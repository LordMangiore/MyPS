import { Resend } from "resend";

const FROM_ADDRESS = process.env.RESEND_FROM || "ProSource <onboarding@resend.dev>";

const DEV_BYPASS =
  process.env.OTP_DEV_BYPASS === "true" || !process.env.RESEND_API_KEY;

const getResend = () => new Resend(process.env.RESEND_API_KEY);

const escapeHtml = (s) =>
  String(s || "").replace(/[&<>"']/g, (c) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  }[c]));

/**
 * Send a ProSource invitation email so the recipient can sign up and connect.
 *
 * POST { toEmail, fromName, fromBusinessName?, signupUrl? }
 *
 * Returns { success: true, devBypass?: true } or { error }.
 */
export default async function handler(req) {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  try {
    const { toEmail, fromName, fromBusinessName, signupUrl, message } = await req.json();
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
      console.log(`[invite dev bypass] would have invited ${toEmail} on behalf of ${fromName}`);
      return Response.json({ success: true, devBypass: true });
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
      return Response.json({ error: error.message || "Email send failed" }, { status: 502 });
    }
    return Response.json({ success: true });
  } catch (err) {
    console.error("send-invite error:", err);
    return Response.json({ error: err.message }, { status: 500 });
  }
}
