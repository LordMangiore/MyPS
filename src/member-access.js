/**
 * Reading a member's data from an account manager's session.
 *
 * An account manager owns no projects of her own. What she needs to look at is
 * her members' work, and that lives in their per-user blobs (`${userId}::projects`).
 * `loadUserData` in auth-context is bound to the signed-in account, so it can
 * only ever read her own blob, which for an AM is empty. These helpers run the
 * same request against an explicit userId instead.
 *
 * `/api/user-data` has no auth gate (deliberate in this demo: nothing here has
 * one), so reaching another account's blob is a plain GET. It is the same door
 * the AM console already opens to work across members, rather than a new
 * endpoint invented for one screen.
 */

import { normalizeStored } from './project-model';

/**
 * Read one blob for an explicit account.
 *
 * The stored record is double wrapped: the writer saves `{ value, updatedAt }`
 * and the endpoint hands that whole wrapper back as its own `value`, so a blob
 * that exists arrives as `{ value: { value: <payload> } }`. Unwrap it exactly
 * the way loadUserData does, or every read comes back as a wrapper no caller
 * can use.
 *
 * Throws on failure. A read that failed is not a read that found nothing, and
 * the difference is the whole point: one is an error state, the other is an
 * empty state, and a caller that cannot tell them apart will report the wrong
 * one.
 */
export const readUserBlob = async (userId, key) => {
  const res = await fetch(
    `/api/user-data?userId=${encodeURIComponent(userId)}&key=${encodeURIComponent(key)}`
  );
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Could not load ${key} (${res.status})`);
  if (data.value && typeof data.value === 'object' && 'value' in data.value) {
    return data.value.value ?? null;
  }
  return data.value ?? null;
};

/**
 * Every project on a member's account, migrated through the shared model.
 * Deliberately unfiltered: see membersFromConnections for why ownership is at
 * the account level and not the project's team.
 */
export const loadMemberProjects = async (memberUserId) =>
  normalizeStored(await readUserBlob(memberUserId, 'projects'));

/**
 * The members behind an account manager's connections list.
 *
 * A connection carrying a real `userId` is a real account with real blobs. One
 * carrying only a `demoIdentity` is an AI persona (Kim, Denise): a colleague the
 * demo speaks as, not a customer with projects to look at.
 *
 * Some carry BOTH, and they are members too. An AI member (Gwen, Owen, Camille:
 * see AM_MEMBER_CAST in netlify/functions/lib/seed.mjs) is a demoIdentity so the
 * model answers her threads, and a real seeded account so she has projects to
 * open. The two fields answer different questions, and only one of them is this
 * function's question: a userId means an account with blobs behind it, whoever
 * or whatever does the talking. So the presence of a userId is still the entire
 * test, and it is deliberately not `!demoIdentity && userId`. That would filter
 * out exactly the members this screen exists to show.
 *
 * Note what this does NOT do: it does not ask whether the account manager
 * appears on any project's `team`. She is a default owner on the member's
 * ACCOUNT, so she gets the member's whole list. Filtering by team membership
 * would also happen to render nothing, because the seeded project teams carry
 * Kim Marks as the account manager persona rather than the human account you
 * sign in as, and an empty screen is indistinguishable from a broken one.
 */
export const membersFromConnections = (stored) => {
  const list = Array.isArray(stored?.list) ? stored.list : [];
  return list
    .filter((c) => c && typeof c.userId === 'string' && c.userId.trim())
    .map((c) => ({
      connectionId: c.id,
      userId: c.userId,
      name: c.name || 'Member',
      initials: c.initials || String(c.name || '?').slice(0, 2).toUpperCase(),
      role: c.role || '',
      type: c.type || 'client',
    }));
};

/**
 * Where an account manager opens one of her members' projects.
 *
 * The owner rides in the URL because the project id alone does not say whose
 * blob it came from, and the detail page has no other way to find out: ids are
 * unique per account, not globally. One link carries both halves of the answer,
 * so a refresh, a bookmark or a shared URL all still resolve.
 */
export const memberProjectPath = (projectId, memberUserId) =>
  `/projects/${encodeURIComponent(projectId)}?owner=${encodeURIComponent(memberUserId)}`;
