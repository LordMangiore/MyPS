# PSwork Gap Analysis — 2026-07-16

Full-app audit (auth, projects, shop, orders/quotes, messaging/settings/backend).
Each numbered item is a dispatch-ready work package. File:line cites point at the
evidence. Ordered by priority.

---

## P0 — The two reported issues (confirmed)

### WP1. Real sign-in entry point + Create Account button
**Confirmed:** the landing-page header "Sign In" is an `<a href="#get-started">`
that just smooth-scrolls to the bottom email form (src/prosource-login.jsx:721-736,
section anchor at :928). `/sign-in` renders the same marketing page (src/main.jsx:62-67),
so the Layout header's Sign In link (src/Layout.jsx:196-204) also lands on a scroll page.
There is **no Create Account button** in any desktop header — only the mobile drawer
hints at it (src/Layout.jsx:275).

Scope for the agent:
- Add a dedicated sign-in view/state that jumps straight to the email/OTP form
  (the OTP flow already handles both new and returning users).
- Add an explicit "Create Account" CTA to the desktop headers (Layout.jsx and
  prosource-login.jsx nav) and route both buttons to the right form state.
- Delete or wire the dead password-login page: `renderLoginPage`
  (prosource-login.jsx:1022-1068) calls `handleLogin` which **does not exist**
  (would crash), has no case in the render switch (:1942-1953), but IS reachable
  via `setPage('login')` from the forgot-password pages (:1184, :1210) → blank screen.
  Ships `defaultValue="password123"` (:1044).
- Delete or wire the fully fake, orphaned forgot-password flow
  (prosource-login.jsx:1145-1227) — app is OTP-only, there is no password.
- Add post-login `returnTo` redirect: protected URLs currently bounce to `/`
  (main.jsx:70-73) and the destination is lost.
- Clean leftover fake state: `existingUsers` array (:84), unused password state
  (:49-51), hardcoded "Justin" default name (auth-context.jsx:36, 241, 261;
  prosource-login.jsx:249), unused address state (:52-56).

### WP2. Rooms as real entities + products tied to rooms
**Confirmed:** `project.rooms` is an array of plain strings from a hardcoded
14-item picklist (src/prosource-project-detail.jsx:403-418), rendered as tags
(:1149-1151). The create wizard never asks about rooms and writes `rooms: []`
(src/prosource-project-create.jsx:45, :150). Cart/product items carry no room
reference anywhere in the pipeline.

Recommended data model (from the audit):
```
project.rooms: [{ id, name, type?, squareFootage?, notes?, createdAt }]
project.products[n].roomId: string | null
```
- Migrate legacy string rooms (`"Kitchen"` → `{id, name: "Kitchen"}`) inside the
  existing `normalizeStored` functions (src/prosource-projects.jsx:34-48 and
  src/prosource-project-detail.jsx:101-115); unassigned products get `roomId: null`.
- Update seed data (netlify/functions/lib/seed.mjs:67-90, :482-528) so demo
  projects exercise rooms + room-assigned products.
- UI: rooms CRUD on the Overview tab replacing the checkbox-tag picker
  (project-detail.jsx:1254-1284); optional rooms step in the create wizard;
  room picker in the shop's save-to-project modal (src/prosource-shop.jsx:756-787).
- Rebuild the Products tab to render real `project.products` grouped by room,
  with move-to-room / remove / qty edit. Today the tab shows ONE hardcoded card
  (project-detail.jsx:1802) with a hardcoded `count: 1` badge (:422), while
  `saveCartToProject` (shop.jsx:360-401) genuinely persists products that no
  component ever reads.
- Fix the save-to-project merge stripping fields: it reduces items to
  `{id,name,sku,category,qty,price}` (shop.jsx:367-389), dropping image/colorName/
  sfPerBox — keep the full snapshot plus roomId.
- Wire the dead "Add To Project" button on the product detail page
  (shop.jsx:1009-1014 — no onClick at all).

Prereq note: three divergent product schemas exist (shop `id/listPrice`, admin
`sku/price`, cart snapshot `sku/price`). Standardize on SKU as canonical identity
before/while doing room linking. Also `snapshotProduct` copies `product.price`
but shop products use `listPrice`, so every cart item price is `undefined`
(shop.jsx:263-273, esp. :268) — list price is silently lost end-to-end.

---

## P1 — Core commerce flow

### WP3. Product catalog backend + unified product schema
- Storefront catalog is a hardcoded 6-item array (src/prosource-shop.jsx:33-188);
  categories hardcoded (:190-198). No API/function fetch exists.
- Admin Product Manager (src/prosource-product.jsx) has a separate hardcoded
  catalog with a different schema; edits are in-memory only (:96-99); "Add
  Product" (:126-128), "Upload CSV" browse (:449-456), "Upload New Image"
  (:273-279) are all dead.
- No canonical product route: PDP is `?product=<id>` on /shop (shop.jsx:205,
  :251); unknown ids silently render the catalog; cart/saved-cart item names
  are plain text, not links (shop.jsx:638-701; prosource-carts.jsx:567-609).
- PDP cosmetic stubs: color swatch selection not recorded in cart snapshot
  (:914-918), Compare checkbox unwired (:1017-1020), zoom promise with no zoom
  (:895-897), one hardcoded Warranty/Overview blurb for all products (:1063-1074).
- Search matches name/brand only; no facets/sort/pagination (:253-258).

### WP4. Cart lifecycle: submit, save, merge
- Member quote submit is a no-op: `submitQuote` (shop.jsx:320-330) just flips
  local state and clears the cart; `quoteNotes` (:726-731) are thrown away; the
  "your account manager will review" confirmation (:567-577) is a false promise.
  Needs a real submission endpoint (guests go through QuoteWizard; members don't).
- Guest cart never merges/uploads on login (auth-context.jsx:233-236 leaves it;
  Layout badge reads guest localStorage even when logged in, Layout.jsx:70-79).
  No multi-device continuity.
- "Add to Cart" from a saved cart **replaces** the active cart wholesale
  (guest-cart.js:146-161; prosource-carts.jsx:436-439) — label lies (:553-558).
- No UI entry point to save the active cart: `saveActiveAsNewCart`
  (guest-cart.js:111-140) is never imported; /carts empty-state "Create Cart"
  button is dead (prosource-carts.jsx:529-531).
- /carts: sort control is a stub (:27, :468-470, :506-515); no share, rename,
  duplicate, or delete-cart actions (:300-309, :453-456); item images always
  placeholder (:569-571).
- Qty/unit issues: SF→box conversion only when `sfPerBox` exists (shop.jsx:942-948);
  samples get qty steppers in the /cart table (:667-695 vs drawer :1143-1152).
- Guest quote contact state collected but never passed to QuoteWizard
  (shop.jsx:243-249, :847-852).

### WP5. Orders & estimates: real data + dead controls
- Orders list renders 5 fabricated `FALLBACK_ORDERS` unless a blob exists; no
  API fetch, no loading/error state (src/prosource-orders.jsx:510-586, :588-600;
  styled emptyState defined but unused :502-507).
- Order detail is a SECOND independent hardcoded dataset; unknown orderId falls
  back to the Beans demo order instead of not-found
  (src/prosource-order-detail.jsx:265-674, :676).
- Estimates tab is dead — same list renders for both tabs (orders.jsx:125,
  :671-686, :798).
- Search submit is an acknowledged stub (:689-696); time-range filter counted
  but never applied (:94-98, :131, :767-784).
- Dead: "View PDF" x2 (orders.jsx:889-891; order-detail.jsx:889-892),
  "Load More" (orders.jsx:901).
- Approve/Pay simulated via setTimeout + localStorage override
  (components/RfmsActionModal.jsx:48-58; order-status-overrides.js); after
  "paying", balanceDue/totalPaid never update. No decline/cancel for a quote.
- Status taxonomy defines `items`/`pickup` but nothing produces them and badge
  switches don't style them (order-status.js:17-51; orders.jsx:398-430;
  order-detail.jsx:80-122).
- No quote/order ↔ project linkage: orders carry no projectId in UI; project
  Estimates & Orders tab always shows the empty state even though seed orders
  HAVE projectId (seed.mjs:350, 366; project-detail.jsx:1874-1902).
- `storage` listener leaks (orders.jsx:605-612; order-status-overrides.js:43-51).

### WP6. Project detail: finish the page
> ✅ **Dead buttons RESOLVED — session 2 (commit beaad17).** All seven inert
> buttons wired to a real destination, pointed at the conversation that does the
> job (Messages), or removed. Sweep confirms every `<button>` in the file now
> carries an onClick. Photos and Designs tabs say the feature is not in the app
> rather than offering uploads with nowhere to go. Still open from this WP: the
> hardcoded "Last updated Dec 18, 2025" header (see Still open below — a separate
> session is on it), archive toggle bug, fake activity feeds, project-linked
> saved carts, shared-module extraction.
- Dead buttons (all no onClick, src/prosource-project-detail.jsx): "+ Add
  Product" / "Request Estimate" (:1781-1782), dashed Add Product card
  (:1811-1827), Discussion "Attach File" (:1328-1330), Inspiration Board buttons
  and tiles (:1592-1630), Quick Actions (:1754-1762), Designs/Photos/Estimates
  tab CTAs (:1841, :1857, :1866, :1883-1898), sidebar "View All" (:1706).
- Fake activity feeds (:1710-1743, :1916-1949), unread badge literal `3` (:59),
  hardcoded "ProSource of St. Louis" + "Last updated Dec 18, 2025" header
  (:966-969) despite real `updatedAt`.
- Archive menu bug: always `setArchived(true)` — "Unarchive Project" re-archives
  (:1012-1016).
- Surface project-linked saved carts (carts blob items have projectId,
  seed.mjs:489).
- Extract shared module: `normalizeStored`, project types, budget ranges, room
  options are duplicated/divergent across projects/create/detail files.

---

## P2 — Communication & account surfaces

### WP7. Messaging fixes
(src/prosource-messages.jsx, src/twilio-client.js)
- New users see 5 fake DEFAULT_THREADS; no true empty state (:275-350, :637-641).
- Attachment paperclip dead (:614-616); no media path in either transport.
- `?thread=` deep links from dashboard never read (no useSearchParams); ids
  can't match anyway (settings-v2_2.jsx:1114-1255 link "kim"/"heather"/etc.).
- Send failures invisible (console.error only :428-430; alert() :479).
- No loading state during Twilio init; mock threads flash then swap (:355-397).
- Twilio token (1h TTL) never refreshed → messaging dies after an hour
  (twilio-client.js; lib/twilio.mjs:43).
- Twilio mode doesn't persist to the messages blob, breaking Notifications and
  dashboard activity which read only that blob (:399-403;
  prosource-notifications.jsx:26,34; settings-v2_2.jsx:147-210).
- Blob messages store literal `date: 'Today'`, no timestamp (:434-447).
- Two identity schemes create duplicate conversations for the same person
  (twilio-client.js:201-202 vs prosource-connections_1.jsx:120).
- Full refetch of everything on every message event (twilio-client.js:181-188).

### WP8. Notifications pipeline
- Only message + project events are synthesized; order/connection/referral types
  exist only in dead LEGACY_NOTIFICATIONS (prosource-notifications.jsx:226-296,
  :313-424); filter tabs missing those types (:426-431).
- No backend store, no unread badge in header/nav, no push, events mutate
  rather than accumulate.

### WP9. Connections: real requests + persistence
(src/prosource-connections_1.jsx)
- Pending requests hardcoded; Accept/Decline only mutate local state, nothing
  persists, accepting doesn't create a connection (:218-237, :852, :868).
- Tab counts hardcoded (:700-705). FALLBACK_CONNECTIONS (8 fake people) block a
  real empty state (:591-694).
- Dead: Filter (:766-768), Remove Connection (:987), empty-state Add Connection
  (:911-913).
- Every card links to /profile which is always the single demo pro (:935).
- Invite reports success even when email silently no-ops without RESEND_API_KEY
  (send-invite.mjs:5-6, :44-47); no acceptance path → invites never become
  connections; invite first-message dropped in blob mode (:112-147).
- New connections mislabeled "ProSource Team Member" due to `projects: null`
  check (:106, :171, :1020-1026).

### WP10. Settings: persistence + de-mocking
(src/prosource-settings-v2_2.jsx)
- Notification prefs / comm frequency / acceptingLeads are useState only —
  never persisted (:227-231); no backend fields exist.
- Dead: email Change (:1736), password Update (:1743), Deactivate Account (:1858).
- Team management fully mock: hardcoded user list (:1912-1914), dead Edit/Remove
  (:1942-1943, :1980-1981), Send Invitation fakes success, doesn't call
  /api/send-invite (:2152-2161).
- "My Projects" section hardcoded despite real projectsList loading elsewhere
  (:1298-1303, :1343-1349); search unwired (:1268-1274); "+ New Project" dead
  (:1275-1277); sort onChange={()=>{}} (:1284-1294); Load More dead (:1332, :1373).
- Referral bonus data all literals (:1411, :1434-1501).
- Dashboard team panels hardcode Kim/Heather/John/Jane with Unsplash photos
  instead of real accountManager/showroom (:1098-1133, :1220-1257).
- Carousel slide 3 "Learn More →" no-op (:1028, :1066-1068).

### WP11. Public profile: multi-user + real data
(src/prosource-public-profile_1.jsx)
> ✅ **RESOLVED — session 2 (commit 255a289), but reframed.** The doc's premise
> (`/profile/:userId` so connection cards can link) was wrong: no account's
> connections carry a real `userId` except Tessa's (whose are members she opens
> in /projects), so a per-*user* route would serve nobody. What shipped instead:
> a client-side pro directory (`src/pro-directory.js`, 5 pros), a list page at
> `/pros`, and `/profile/:proId` for each. "Your profile" (`/profile`) and "a
> pro's profile" (`/profile/:proId`) are now two routes off two sources, so the
> old identity-mixing (your name over Mae Reedy's bio, the literal "MR" avatar
> for everyone) is gone. Reviews stay as deliberate filler, but rating / count /
> star-breakdown / chip-counts are DERIVED from the review list, so chips filter
> truthfully. Share, reviews anchor, view-all-photos, credential details all
> wired; showroom card reads the real showroom; photo upload and cover-photo
> were removed as fakes with no backend. See session-2 handoff.
- Single-profile architecture: own-vs-public is `?own=1` (:42); no
  /profile/:userId route; ConsultationWizard gets `userId: null` (:1699) so
  requests can't route to a pro.
- Reviews/ratings/stats hardcoded; filter chips don't filter (:977-1040,
  :1565-1577); no review submission.
- Photos are integers, no upload handlers (:104, :1157-1160, :1201-1216).
- profileVisibility saved but never enforced (:99, :1301-1315).
- Edited certifications not rendered (sidebar hardcoded :1658-1667); showroom
  card hardcoded "ProSource of Allen" with map placeholder (:1636-1655).
- Dead: Share (:1280-1282), reviews anchor (:1251), View all photos
  (:1523-1527), credential details (:1671-1673).

### WP12. Quote / consultation / appointment flows
> ✅ **RESOLVED — session 2 (commit beaad17), except one stale item.** Quote
> wizard resend, submit-quote email gate, consultation success-on-reject, the
> `userName !== 'Justin'` prefill, and the fully-mocked appointment modal all
> fixed and driven end to end. The consultation "one-tap link" over-promise and
> the false "X will reach out" naming were fixed in commit 255a289 (the pro
> directory made the honest routing possible). **Stale in the list below:**
> "Consultation records get status:'new' with no viewing UI" — the AM work queue
> (added in session 1) surfaces consultations with an open→handled lifecycle, so
> a human does see them.
- Quote wizard: "Resend code" on the verify step calls sendCode → goNext(),
  advancing to a blank success screen (prosource-quote-wizard.jsx:125-145,
  :411-419, :424).
- submit-quote: requester confirmation email nested inside the AM-email gate —
  if showroom lookup fails (swallowed :79-95) nobody gets any email
  (submit-quote.mjs:235, :276-298).
- Consultation wizard shows success even when the server rejects (fetch errors
  swallowed, res.ok never checked; record pre-saved before the call)
  (prosource-consultation-wizard.jsx:143-166, :333-351).
- "One-tap link to claim your account" promise unimplemented — server sends a
  generic email to the homepage (wizard :345-350; consultation-request.mjs:164-181).
- Consultation records get status:'new' with no lifecycle or any viewing UI
  (consultation-request.mjs:77-92).
- Appointment modal fully mocked: hardcoded staff/slots/showroom, blob-only
  save, no server endpoint, no email, no calendar invite despite the promise,
  guests see "Saved to your dashboard" without a save; no cancel/reschedule;
  "Step X of 5" but 6 steps (prosource-appointment-modal.jsx:26-49, :117-151,
  :182, :207, :316, :341).
- Leftover demo artifact: name prefill guarded by `userName !== 'Justin'`
  (prosource-consultation-wizard.jsx:79).

---

## P3 — DEFERRED: Security hardening (accepted risk — internal control demo)

> **Decision (2026-07-16, per project owner):** this is an internal control demo.
> Security is explicitly NOT a goal; the bar is "it works." WP13 below stays
> documented for the record but is intentionally NOT scheduled. Revisit only if
> this app ever faces real users or real customer data.
>
> **CORRECTION (2026-07-16): the OTP dev bypass is NOT load-bearing.** An earlier
> version of this document claimed `RESEND_API_KEY` was unset (it is commented
> out in `.env`) and therefore `DEV_BYPASS` was ON and any 6-digit code would log
> you in. **That was wrong.** The project is linked to a Netlify site whose
> settings define `RESEND_API_KEY`, and `netlify dev` injects those site env vars
> locally — observed directly: `Injected project settings env vars: FIREBASE_API_KEY,
> FIREBASE_PASS_SECRET, RESEND_API_KEY, RESEND_FROM`. So `DEV_BYPASS` is **false**
> both locally and in production, OTP is real, and **`send-invite` will genuinely
> attempt to send real email to whatever address you type.** Be careful testing the
> invite and OTP flows against addresses you don't own. To force the bypass on
> deliberately, set `OTP_DEV_BYPASS=true`.
>
> Items originally filed here that cause *visible breakage* have been moved OUT
> into WP14, because they make the demo look broken regardless of security
> posture.

### WP13. Backend auth: every endpoint is open — DEFERRED, NOT SCHEDULED
- Client never sends the token; all functions keyed on plaintext userId, which
  is derivable from email (`"ps-" + email`, otp-verify.mjs:127). Anyone can
  read/write anyone's data (auth-context.jsx:106-172; user-data.mjs:14
  "Demo only — no auth check"; save-profile.mjs:11; get-profile.mjs).
- DEV_BYPASS fails OPEN: a missing RESEND_API_KEY silently accepts ANY 6-digit
  OTP (otp-send.mjs:9-10; otp-verify.mjs:9-10, :82-85). CORRECTED 2026-07-16:
  the key IS set via Netlify site settings, so this is latent rather than active
  — but it means accidentally deleting that env var silently removes
  authentication instead of failing loudly.
- lookup-user: unauthenticated PII lookup + account enumeration
  (lookup-user.mjs:13, :54-79).
- send-invite: open relay — unauthenticated, attacker-controlled `signupUrl`
  embedded verbatim in a ProSource-branded email (send-invite.mjs:26-56, :73);
  no invite token/record.
- submit-quote trusts unauthenticated body identity (submit-quote.mjs:25-27,
  :50-72). twilio-token mints tokens for any userId (twilio-token.mjs:9-10);
  twilio-conversations `post` lets callers author messages as any identity
  (:231-243).
- OTP: seed-failure after mapping write creates a profileless "returning" user
  (otp-verify.mjs:120-149); rate limit per-email only — no per-IP throttle
  (otp-send.mjs:35-59). Firebase refreshToken returned but never used
  (otp-verify.mjs:175-181).
- Session gaps: no expiry, no logout invalidation, onboarding skipped forever
  if abandoned (account created at verify time, otp-verify.mjs:137-149;
  prosource-login.jsx:125-157); profile-save failure swallowed on onboarding
  complete (:227-251); "Demo: Skip Signup" creates broken userId:null session
  (:742-761; auth-context.jsx:239-253); tradepro onboarding steps have no
  field validation (:1542-1730).

### WP14. Reliability bugs — STILL IN SCOPE (these break the demo, not just security)

Moved here from WP13 because they cause visible breakage even with security
deprioritized:
- **"Demo: Skip Signup" creates a dead session.** The dashed button
  (prosource-login.jsx:742-761) and `login()` (auth-context.jsx:239-253) build a
  session with `userId: null`, so every persistence helper fails silently —
  `saveUserData` throws "Not signed in" (auth-context.jsx:120), `loadUserData`
  returns fallback (:104). Anyone demoing via Skip Signup gets an app where
  projects/messages/settings silently never save. **High priority for a demo:**
  give it a real seeded userId so the app actually functions.
- **Onboarding abandonment is permanent.** The account is created at OTP-verify
  time (otp-verify.mjs:137-149) but the session is only React state
  (prosource-login.jsx:125-147). Refresh mid-wizard → next login reports
  `isNewUser: false` → onboarding is skipped forever and no name/type is ever
  collected. Also, if `seedNewUser` throws after the mapping write
  (otp-verify.mjs:120-149), the retry is treated as a returning user with no
  profile and no seed data — an empty, broken demo account.
- **Profile-save failure is swallowed** on onboarding complete
  (prosource-login.jsx:227-251) — user is logged in anyway with an empty profile
  blob and no warning.

Original data-layer items:
- Whole-collection blob writes (one `projects` blob per user, replaced entirely
  on every save from 3 different pages) → lost-update races; code already
  comments on one such bug (project-detail.jsx:133-136, :151-209, :282-286;
  user-data.mjs:16-34).
- Same get-then-set race on shared lead/consultation buckets
  (submit-quote.mjs:182-229; consultation-request.mjs:82-89).
- lookup-showroom stub: Fenton's '630' prefix unreachable (first-match wins on
  St. Louis) (lookup-showroom.mjs:13-47, :88-96).
- Dead code: sitecore-personalization.js declared "NOT WIRED UP" by its own
  header; GET twilio-conversations path unused (twilio-conversations.mjs:141-151).

---

## Suggested dispatch order

> **Status (2026-07-17): everything below is done except WP13.** WP1–WP12 and
> WP14 have shipped across sessions 1 and 2; WP13 is deferred by decision. The
> ordering is kept as the record of how the work was sequenced. Current open
> items are in the session-2 handoff at the bottom.

Framing: internal control demo. The bar is **"the click-through works and nothing
silently no-ops"** — not production hardening. Prioritize dead buttons, false
success messages, and mock data that contradicts real data, since those are what
break a live walkthrough.

1. **WP1 (sign-in/create-account) + WP2 (rooms)** — the reported issues.
   *(SHIPPED, session 1.)* WP2's data model lands first since
   WP4/WP6 build on it.
2. **WP14 reliability bugs** — small, high-leverage for a demo. Especially the
   Skip-Signup dead session: today that path makes the whole app silently
   non-persistent.
3. **WP3 + WP4** (catalog + cart) — unify the product schema; fix the
   `price`/`listPrice` bug that blanks every cart price.
4. **WP5 + WP6** (orders + project detail) — wire real data through; kill the
   ~15 dead buttons and the archive toggle bug.
5. **WP7–WP12** in parallel — mostly independent surfaces. Bias toward the
   false-success bugs (consultation "success" on server failure, invite
   "Invitation sent" when nothing sent, quote wizard's blank success screen).
6. **WP13** — deferred indefinitely (see above). Not scheduled.

---

# Handoff, 2026-07-16 (end of session 1)

## Where things stand

Everything below WP1 through WP14 in this document has shipped and is deployed
except the deferred security work (WP13). The live demo is
https://myprosource.netlify.app, `main` auto-deploys, and the repo is public
(github.com/LordMangiore/MyPS). `.env` is correctly gitignored: no credential has
ever been committed, and a scan runs before each push.

## The three demo accounts

The landing page has three demo sign-in buttons. Each is a real, persistent
account with a deterministic userId (`"ps-" + email.replace(/[^a-z0-9]/g,'-')`):

| Button | Person | userId | userType |
|---|---|---|---|
| Demo: Skip Signup | Justin Reyes | ps-demo-prosource-com | tradepro |
| Account manager | Tessa Brandt | ps-tessa-brandt-prosource-com | accountmanager |
| Homeowner | Alicia Navarro | ps-alicia-navarro-email-com | homeowner |

## Rules that are load-bearing. Break these and the demo breaks subtly

1. **Nothing you can sign in AS may be an AI persona.** The six personas (Kim
   Marks, Denise Okafor, Heather Yager, Bubba Beans, Sarah Chen, Ryan O'Toole)
   are answered by the model in their own voice. If an account you sign into is
   also a persona, the bot answers as her while you type as her. `twilio-client`
   matches demo contacts BY NAME, so a name collision alone triggers it.
2. **Bump `TWILIO_SEED_VERSION` whenever demo conversation copy changes.**
   Seeding is version-gated now, and skipping the seed also skips the
   conversation copy refresh, so a copy change silently never reaches Twilio.
   This has already burned us once: em dashes removed from this repo stayed live
   in Twilio because attributes were frozen at creation.
3. **Seed markers are versioned, not booleans, and are checked against reality.**
   Re-seeding used to be self-healing; a naive flag throws that away. The blob
   marker is checked against the keys that exist; the Twilio marker is checked by
   the client against the identities that actually arrived, and forces a real
   seed when the marker is lying.
4. **An account manager is a default owner on member ACCOUNTS, not projects.**
   Her projects view must never filter by project `team`: the seeded teams carry
   Kim Marks (a persona), not Tessa, so a team filter renders nothing.
5. **Money: null means "not priced yet", 0 means "free".** An unpriced quote
   renders "To be quoted", never "$0.00".
6. **Tailwind's preflight sets `svg { display: block }`,** so `textAlign:
   'center'` cannot centre an icon. Flex-centre the container. This has caused
   three separate bugs.
7. **RESEND_API_KEY is live** and `netlify dev` injects it from the Netlify site
   settings even though `.env` comments it out. Any "test" invite or OTP emails a
   real person. The OTP dev bypass is NOT active. **Corollary for testing
   email-sending flows:** stub `fetch` in the browser so the request never leaves
   the page (both the quote and consultation confirms were verified this way),
   never by submitting a real address.

The following were added in session 2 (2026-07-17):

8. **`amTeamMember` carries `userId`, not a `connectionId`, and never a
   `demoIdentity`.** When an account manager is a name on a project team, the
   `userId` is what marks the entry as a real account (so the discussion can ask
   "is the reader on this team, as themselves?") and what the repair pass matches
   her by. She must stay OUT of `DEMO_IDENTITY_BY_NAME`: a team entry that
   resolves to a demo identity gets AI words put in its mouth, and Tessa is an
   account you sign in as. This is rule 1 wearing a different hat.
9. **Authored discussion posts: `authorUserId` (a real account) and
   `authorIdentity` (a demo persona) are opposites and must never be confused.**
   An unsigned post belongs to the project owner; the reader, the activity feed
   and the AI-reply history all branch on this. Signing a post keys on "is this
   thread mine" (guest), never on role. A guest's post is written to the OWNER's
   blob via `writeUserBlob`, and no AI reply fires for a guest.
10. **`ensureAmOnProjectTeams` is surgical, not a blob rewrite, on purpose.**
    Project ids are minted from the seed clock and the discussions blob is keyed
    by project id, so regenerating ids would orphan every comment. The repair
    keeps ids, touches only the team, and is idempotent by `userId`. Same family
    as `ensureAmMemberConnections`, but it runs against the MEMBER's projects key
    (a different account's blob), so its hook placement differs.
11. **A directory pro (`src/pro-directory.js`) is content, not an account.** No
    userId, no blobs, no threads. Names are load-bearing exactly as rule 1 says:
    none may collide with a persona or a sign-in account. A consultation request
    about a pro carries `toProId` for the record but `toProUserId: null`, because
    there is nowhere to deliver it; the copy must not imply a named pro will call
    (it routes to the showroom queue by zip).
12. **A pro's profile and your own are two routes off two sources.**
    `/profile/:proId` reads the directory (read only); `/profile` reads your
    account (editable). They must never share state: one page for both is what
    printed your name over Mae Reedy's history. On your own profile, unfilled
    fields start EMPTY, never borrowed from a pro.

## Known seams, accepted deliberately

- The members' assigned account manager is Kim Marks (a persona, so their
  conversations get AI replies), while the account manager you sign in as is
  Tessa (a human account). Both facts are load-bearing; do not "reconcile" them.
- An account manager still sees some member chrome after sign-in (the app is
  member-shaped). Her real surfaces are /am and /projects.
- Whole-blob read-modify-write races (WP14) remain. This is the one thing a real
  database would fix; Railway/Postgres was discussed for exactly this.

## In flight at handoff

One agent is building an AI cast per demo account: AI members for Tessa (a
`demoIdentity` so they talk back, plus a real seeded `userId` so they have
projects she can open), and a homeowner-appropriate cast for Alicia (her AM,
designer, installer, rather than the other homeowners she has today). Justin's
six threads must be unchanged: that is the regression that matters.

## Still open (as of session-1 handoff — see session-2 handoff below for current)

_Superseded. Session 2 shipped the Tessa job, WP11, WP12, and the WP6 dead
buttons. The current open list lives in the session-2 handoff at the bottom of
this document._

---

# Handoff, 2026-07-17 (end of session 2)

## What shipped this session

Three commits on `main`, none pushed yet (the owner decides when, since `main`
auto-deploys to the live demo). Each was verified by driving the real app, not
just by building.

1. **`1889ecf` — Tessa on her own members' project teams + authored posts.**
   The "Next up" job from session 1, both halves. Seed side: `castProjectTeam`
   now puts Tessa (not Kim) on Gwen's, Owen's and Camille's project teams, via
   `amTeamMember`; already-seeded accounts are repaired by `ensureAmOnProjectTeams`
   (`SEED_VERSION` 2→3). Client side: an authored-post shape (`authorUserId`)
   lets a guest teammate post into the OWNER's discussions blob under her own
   name, rendering correctly to the member as Tessa. Justin's and Alicia's teams
   keep Kim (load-bearing, rule 1). See load-bearing rules 8–10.

2. **`beaad17` — WP12 false-success flows + WP6 dead buttons.** Fanned out to
   five agents, each fix adversarially reviewed before landing; the review pass
   caught two agents introducing NEW lies (see "Corrections" below for the
   submit-quote one). Quote-wizard resend, submit-quote email gate, consultation
   success-on-reject + `!== 'Justin'` prefill, the appointment modal (de-mocked,
   routed to the AM work queue, no email), and all seven WP6 dead buttons.

3. **`255a289` — WP11, reframed as a pro directory.** See the WP11 marker above.
   The consultation wizard's false "X will reach out" promise was fixed here too,
   because a per-pro route was what made honest routing expressible.

## Corrections to this document's own claims

- **WP14 blast radius was backwards.** Session 1 warned that a wrongly-removed
  guard on the project page "silently overwrites a member's projects." It does
  not: `saveUserData` is bound to the SIGNED-IN account, so the damage is to the
  guest's OWN blob (clobbered with the member's list), not the member's. Still
  silent, still bad, but the account at risk is hers.
- **WP12 "no viewing UI" for consultations is stale.** The AM work queue surfaces
  them with an open→handled lifecycle. (The `ps-consultation-requests` bucket
  itself still has no reader, but a human does see the lead.)
- **The submit-quote fix nearly shipped a new lie.** `lookup-showroom` resolves
  every unseeded zip to a fallback manager with a real-looking NAME and an EMPTY
  email. Gating the requester's confirmation on the name (as the first attempt
  did) would have emailed a callback promise to the most common zip path, where
  nobody is coming. It gates on the email now (`amIsReachable`).

## Still open (current)

- **WP13** — security. Deferred by decision, not scheduled. Unchanged.
- **"Last updated Dec 18, 2025"** — hardcoded header on the project detail page
  (still at `src/prosource-project-detail.jsx`, search the literal). A separate
  local session was dispatched to fix it (render the real `updatedAt`); not yet
  committed to this branch as of this handoff.
- **WP6 remainders** — the "more" menu's archive item still calls
  `setArchived(true)` unconditionally, so its "Unarchive Project" label
  re-archives (a separate working unarchive control exists elsewhere on the page,
  so fix the menu item, not that one). Plus fake activity feeds, project-linked
  saved carts, and the shared-module extraction. Only the dead buttons were done
  this session.
- **WP11 depth** — the directory is client-side demo content by design; there is
  no review submission, no real photo storage, and profileVisibility is still not
  enforced (it is saved but nothing reads it). These are intentional non-goals
  for a demo, recorded so nobody re-files them as bugs.
- **Housekeeping:** a stray empty file named `directory` is tracked at the repo
  root (`git ls-files directory`). Looks like junk; left in place because this
  session did not create it. Safe to `git rm` if the owner confirms.

## Rules added this session

See load-bearing rules 8–12 in the session-1 handoff list above (kept in one
place so the reference stays complete). In short: an account manager on a team
carries a `userId` and never a demo identity; authored posts distinguish real
accounts from personas and must not blur them; the team repair is surgical to
protect discussion ids; a directory pro is content with a name that must not
collide; and a pro's profile and your own are two routes off two sources.
