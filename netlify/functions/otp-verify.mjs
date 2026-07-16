import { getStore } from "@netlify/blobs";
import { seedNewUser } from "./lib/seed.mjs";

const FIREBASE_API_KEY = process.env.FIREBASE_API_KEY;
const IDENTITY_URL = "https://identitytoolkit.googleapis.com/v1";

// Demo bypass: when set (or when Resend isn't configured), accept any 6-digit
// code. Must match the otp-send.mjs flag — they share the same env signal.
const DEV_BYPASS =
  process.env.OTP_DEV_BYPASS === "true" || !process.env.RESEND_API_KEY;

/**
 * Sign in or create a Firebase Auth user via the Identity Toolkit REST API.
 * Uses a deterministic password derived from the email + HMAC secret so no
 * password is ever held on the client. Mirrors the bettercram pattern.
 */
async function ensureFirebaseUser(email) {
  if (!FIREBASE_API_KEY || !process.env.FIREBASE_PASS_SECRET) {
    return null;
  }

  const secret = process.env.FIREBASE_PASS_SECRET;
  const encoder = new TextEncoder();
  const keyData = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", keyData, encoder.encode(email));
  const password =
    "ps_" +
    Array.from(new Uint8Array(sig))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("")
      .slice(0, 32);

  // Try sign-in first
  let res = await fetch(`${IDENTITY_URL}/accounts:signInWithPassword?key=${FIREBASE_API_KEY}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password, returnSecureToken: true }),
  });

  if (res.ok) {
    const data = await res.json();
    return { idToken: data.idToken, refreshToken: data.refreshToken, uid: data.localId };
  }

  // Doesn't exist — create
  res = await fetch(`${IDENTITY_URL}/accounts:signUp?key=${FIREBASE_API_KEY}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password, returnSecureToken: true }),
  });

  if (!res.ok) {
    const err = await res.json();
    console.error("Firebase Auth create failed:", err);
    return null;
  }

  const data = await res.json();
  return { idToken: data.idToken, refreshToken: data.refreshToken, uid: data.localId };
}

export default async function handler(req) {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  try {
    const { email, code } = await req.json();
    if (!email || !code) {
      return Response.json({ error: "Email and code required" }, { status: 400 });
    }

    const normalizedEmail = email.toLowerCase().trim();

    // Dev bypass — accept any 6-digit code and skip the blob check.
    if (DEV_BYPASS) {
      if (!/^\d{6}$/.test(String(code).trim())) {
        return Response.json({ error: "Enter the 6-digit code" }, { status: 400 });
      }
    } else {
      const store = getStore({ name: "ps-otp-codes", consistency: "strong" });

      // Retry blob read up to 5 times for read-after-write consistency
      let otpData = null;
      for (let attempt = 0; attempt < 5; attempt++) {
        try {
          otpData = await store.get(normalizedEmail, { type: "json" });
          if (otpData) break;
        } catch (e) {
          console.log(`OTP blob read attempt ${attempt + 1} failed:`, e.message);
        }
        if (attempt < 4) await new Promise((r) => setTimeout(r, 800 * (attempt + 1)));
      }

      if (!otpData) {
        return Response.json({ error: "No code found. Request a new one." }, { status: 400 });
      }

      if (Date.now() > otpData.expiresAt) {
        await store.delete(normalizedEmail);
        return Response.json({ error: "Code expired. Request a new one." }, { status: 400 });
      }

      if (otpData.attempts >= 5) {
        await store.delete(normalizedEmail);
        return Response.json({ error: "Too many attempts. Request a new code." }, { status: 400 });
      }

      if (otpData.code !== String(code).trim()) {
        otpData.attempts += 1;
        await store.setJSON(normalizedEmail, otpData);
        return Response.json({ error: "Incorrect code. Try again." }, { status: 400 });
      }

      // Success — burn the code
      await store.delete(normalizedEmail);
    }

    const firebaseAuth = await ensureFirebaseUser(normalizedEmail);
    const firebaseUid = firebaseAuth?.uid || null;
    const legacyUserId = "ps-" + normalizedEmail.replace(/[^a-z0-9]/g, "-");

    // Email → user mapping for new vs returning detection
    const userStore = getStore("ps-email-to-user");
    let existingUserId = null;
    try {
      const mapping = await userStore.get(normalizedEmail, { type: "json" });
      if (mapping?.userId) existingUserId = mapping.userId;
    } catch {}

    let isNewUser = false;
    if (!existingUserId) {
      isNewUser = true;
      const userId = firebaseUid || legacyUserId;
      await userStore.setJSON(normalizedEmail, {
        userId,
        legacyUserId,
        firebaseUid,
        createdAt: Date.now(),
      });
      existingUserId = userId;
      // Populate sample projects so the demo isn't empty on first login.
      await seedNewUser(userId);
    } else if (firebaseUid && existingUserId !== firebaseUid) {
      try {
        await userStore.setJSON(normalizedEmail, {
          userId: existingUserId,
          legacyUserId: existingUserId,
          firebaseUid,
          updatedAt: Date.now(),
        });
      } catch {}
    }

    const sessionToken =
      firebaseAuth?.idToken ||
      btoa(`${existingUserId}:${Date.now()}:${Math.random().toString(36).slice(2)}`);

    return Response.json({
      success: true,
      isNewUser,
      user: {
        id: existingUserId,
        email: normalizedEmail,
        name: normalizedEmail.split("@")[0],
        firebaseUid,
      },
      token: sessionToken,
      firebase: firebaseAuth
        ? {
            idToken: firebaseAuth.idToken,
            refreshToken: firebaseAuth.refreshToken,
            uid: firebaseAuth.uid,
          }
        : null,
    });
  } catch (err) {
    console.error("OTP verify error:", err);
    return Response.json({ error: err.message }, { status: 500 });
  }
}
