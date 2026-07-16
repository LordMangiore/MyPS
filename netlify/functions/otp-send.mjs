import { getStore } from "@netlify/blobs";
import { Resend } from "resend";

const FROM_ADDRESS = process.env.RESEND_FROM || "ProSource <onboarding@resend.dev>";

// Demo bypass: if env flag is set OR no Resend key is configured, accept any
// 6-digit code on verify and don't actually send email. Lets the prototype
// run end-to-end without provisioning Resend.
const DEV_BYPASS =
  process.env.OTP_DEV_BYPASS === "true" || !process.env.RESEND_API_KEY;

// Lazy — Resend's constructor throws if RESEND_API_KEY is missing, so we can't
// instantiate it at module load.
const getResend = () => new Resend(process.env.RESEND_API_KEY);

export default async function handler(req) {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  try {
    const { email } = await req.json();
    if (!email || !email.includes("@") || email.length > 254) {
      return Response.json({ error: "Valid email required" }, { status: 400 });
    }

    const normalizedEmail = email.toLowerCase().trim();

    // Dev bypass — accept any 6-digit code on verify, no email sent.
    if (DEV_BYPASS) {
      console.log(`[OTP dev bypass] would have sent code to ${normalizedEmail}`);
      return Response.json({ success: true, devBypass: true });
    }

    // Rate limit: 60s between sends, max 3 per 5 minutes
    const store = getStore({ name: "ps-otp-codes", consistency: "strong" });

    // Stale-block recovery: if our records say the user was rate-limited
    // but they never received a code (which we can tell because Resend
    // failed before we set sentAt), give them a one-time fresh start.
    // In practice this means: only enforce the count limit when the most
    // recent sent timestamp is within the last 5 minutes.
    try {
      const existing = await store.get(normalizedEmail, { type: "json" });
      const now = Date.now();
      if (existing?.sentAt && (now - existing.sentAt) < 60_000) {
        const waitSec = Math.ceil((60_000 - (now - existing.sentAt)) / 1000);
        return Response.json(
          { error: `Please wait ${waitSec}s before requesting a new code.` },
          { status: 429 }
        );
      }
      if (existing?.sentCount >= 3 && (now - existing.firstSentAt) < 300_000) {
        return Response.json(
          { error: "Too many requests. Please try again in a few minutes." },
          { status: 429 }
        );
      }
    } catch {}

    // Generate 6-digit code
    const codeArray = new Uint32Array(1);
    crypto.getRandomValues(codeArray);
    const code = String(100000 + (codeArray[0] % 900000));
    const expiresAt = Date.now() + 10 * 60 * 1000;

    // Compute rate-limit metadata — but don't persist until Resend confirms
    // the send. Failed sends (bad From, unverified domain, etc.) shouldn't
    // count against the user.
    let sentCount = 1;
    let firstSentAt = Date.now();
    try {
      const existing = await store.get(normalizedEmail, { type: "json" });
      if (existing?.firstSentAt && (Date.now() - existing.firstSentAt) < 300_000) {
        sentCount = (existing.sentCount || 0) + 1;
        firstSentAt = existing.firstSentAt;
      }
    } catch {}

    const { error } = await getResend().emails.send({
      from: FROM_ADDRESS,
      to: email,
      subject: `${code} — Your ProSource login code`,
      html: `
        <div style="font-family: 'Open Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 440px; margin: 0 auto; padding: 40px 20px; color: #171717;">
          <div style="text-align: center; margin-bottom: 30px;">
            <span style="font-size: 22px; font-weight: 700; color: #003087;">ProSource</span>
            <span style="font-size: 11px; font-weight: 400; color: #003087; letter-spacing: 1.5px; margin-left: 4px;">WHOLESALE</span>
          </div>
          <p style="color: #374151; font-size: 16px; margin-bottom: 8px;">Your login code:</p>
          <div style="background: #f3f4f6; border-radius: 12px; padding: 24px; text-align: center; margin-bottom: 24px;">
            <span style="font-size: 36px; font-weight: 700; letter-spacing: 8px; color: #003087;">${code}</span>
          </div>
          <p style="color: #6b7280; font-size: 14px; line-height: 1.5;">
            This code expires in 10 minutes. If you didn't request this, ignore this email.
          </p>
          <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;" />
          <p style="color: #9ca3af; font-size: 12px; text-align: center;">
            ProSource Wholesale — trade pricing on flooring, cabinets, and countertops
          </p>
        </div>
      `,
    });

    if (error) {
      console.error("Resend error:", error);
      const message =
        error.message ||
        (typeof error === "string" ? error : "Email provider rejected the request");
      return Response.json({ error: message }, { status: 502 });
    }

    // Persist the code + rate-limit state only on a successful send.
    await store.setJSON(normalizedEmail, {
      code,
      expiresAt,
      attempts: 0,
      sentAt: Date.now(),
      sentCount,
      firstSentAt,
    });

    return Response.json({ success: true });
  } catch (err) {
    console.error("OTP send error:", err);
    return Response.json({ error: err.message }, { status: 500 });
  }
}
