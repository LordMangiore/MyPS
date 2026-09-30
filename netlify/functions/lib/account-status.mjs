import { getStore } from "@netlify/blobs";

/**
 * Account deactivation, shared by the functions that have to honor it.
 *
 * Deactivation is the member's own choice about their myProSource account:
 * their profile stops showing up to other members and email notifications to
 * them stop. It is NOT their ProSource membership, which the showroom manages.
 * Signing back in reactivates the account (see otp-verify).
 *
 * The flag lives on the ps-users profile as `deactivatedAt` (epoch ms).
 */

const users = () => getStore({ name: "ps-users", consistency: "strong" });

export async function getProfile(userId) {
  if (!userId) return null;
  return users().get(userId, { type: "json" }).catch(() => null);
}

export async function userIdForEmail(email) {
  if (!email) return null;
  const mapping = await getStore("ps-email-to-user")
    .get(String(email).toLowerCase().trim(), { type: "json" })
    .catch(() => null);
  return mapping?.userId || null;
}

export const isDeactivated = (profile) => Boolean(profile?.deactivatedAt);

export async function isDeactivatedEmail(email) {
  return isDeactivated(await getProfile(await userIdForEmail(email)));
}

export async function setDeactivated(userId, deactivated) {
  const existing = (await getProfile(userId)) || { userId };
  const next = { ...existing, userId, updatedAt: Date.now() };
  if (deactivated) next.deactivatedAt = Date.now();
  else delete next.deactivatedAt;
  await users().setJSON(userId, next);
  return next;
}
