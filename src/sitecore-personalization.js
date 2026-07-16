/**
 * Planned Sitecore personalization content for the dashboard welcome bar.
 *
 * NOT WIRED UP. The live dashboard renders a static "Welcome, {name}." line
 * (see prosource-settings-v2_2.jsx). Once the Sitecore personalization layer
 * is connected, the variants below become content items the marketing team
 * can manage without a code change.
 *
 * Each variant carries:
 *   - `rule`: a plain-English condition the Sitecore rule editor can mirror.
 *   - `match`: a runtime predicate any future client could use to pick a
 *     variant locally if Sitecore isn't reachable.
 *   - `title` / `subtitle`: the copy.
 *
 * `{name}` is substituted at render time by the renderer that picks the variant.
 */

// ── Time-of-day greetings (title) ─────────────────────────────────────────────
// One match per hour bucket, evaluated against the visitor's local time.
// Sitecore equivalent: a "Day part / hour of day" personalization rule.
export const TIME_OF_DAY_GREETINGS = [
  {
    id: 'midnight-oil',
    rule: 'Local hour is between 00:00 and 04:59',
    match: (hour) => hour >= 0 && hour < 5,
    title: 'Burning the midnight oil, {name}.',
  },
  {
    id: 'morning',
    rule: 'Local hour is between 05:00 and 11:59',
    match: (hour) => hour >= 5 && hour < 12,
    title: 'Good morning, {name}.',
  },
  {
    id: 'afternoon',
    rule: 'Local hour is between 12:00 and 16:59',
    match: (hour) => hour >= 12 && hour < 17,
    title: 'Good afternoon, {name}.',
  },
  {
    id: 'evening',
    rule: 'Local hour is between 17:00 and 20:59',
    match: (hour) => hour >= 17 && hour < 21,
    title: 'Good evening, {name}.',
  },
  {
    id: 'late-night',
    rule: 'Local hour is between 21:00 and 23:59',
    match: (hour) => hour >= 21 && hour < 24,
    title: 'Welcome back, {name}.',
  },
];

// ── Last-visit subtitles ──────────────────────────────────────────────────────
// One match per recency bucket, ordered from most recent to least recent.
// Sitecore equivalent: a "Days since last visit" personalization rule.
//
// Buckets:
//   - new            → no prior visit on record
//   - <5min          → reopened the tab, same session
//   - <12hrs         → returned later the same day
//   - same-day       → second visit later in the day
//   - 1day           → visited yesterday
//   - 2-6days        → "Last here N days ago."
//   - 1-4weeks       → "Last here N week(s) ago."
//   - 30+days        → it's been a while
export const LAST_VISIT_SUBTITLES = [
  {
    id: 'new',
    rule: 'Visitor has no prior visit timestamp',
    match: ({ lastVisitTs }) => !lastVisitTs,
    subtitle: "Welcome to myProSource. Let's get you set up.",
  },
  {
    id: 'fresh-session',
    rule: 'Less than 5 minutes since last visit',
    match: ({ diffMinutes }) => diffMinutes < 5,
    subtitle: 'Picking up where you left off.',
  },
  {
    id: 'same-day-short',
    rule: 'Less than 12 hours since last visit',
    match: ({ diffHours }) => diffHours < 12,
    subtitle: 'Good to see you again.',
  },
  {
    id: 'same-day-long',
    rule: 'Less than 24 hours since last visit',
    match: ({ diffDays }) => diffDays < 1,
    subtitle: 'Anything new on your projects today?',
  },
  {
    id: 'yesterday',
    rule: 'Between 1 and 2 days since last visit',
    match: ({ diffDays }) => diffDays < 2,
    subtitle: 'Last here yesterday. Welcome back.',
  },
  {
    id: 'this-week',
    rule: 'Between 2 and 7 days since last visit',
    match: ({ diffDays }) => diffDays < 7,
    subtitle: 'Last here {daysAgo} days ago. Welcome back.',
  },
  {
    id: 'recent-weeks',
    rule: 'Between 7 and 30 days since last visit',
    match: ({ diffDays }) => diffDays < 30,
    subtitle: 'Last here {weeksAgo} week{weekPlural} ago. Welcome back.',
  },
  {
    id: 'long-gone',
    rule: '30 or more days since last visit',
    match: ({ diffDays }) => diffDays >= 30,
    subtitle: "It's been a while. Let's catch you up.",
  },
];

/**
 * Reference implementation of the variant picker, kept here so the future
 * Sitecore integration team has a runnable spec for the fallback behavior.
 * Not currently imported by the app.
 */
export function pickWelcomeVariant({ name, now = new Date(), lastVisitTs = null }) {
  const hour = now.getHours();
  const greeting = TIME_OF_DAY_GREETINGS.find((v) => v.match(hour)) || TIME_OF_DAY_GREETINGS[0];

  const diffMs = lastVisitTs ? now.getTime() - lastVisitTs : null;
  const diffMinutes = diffMs == null ? Infinity : diffMs / 60000;
  const diffHours = diffMinutes / 60;
  const diffDays = diffHours / 24;
  const ctx = { lastVisitTs, diffMinutes, diffHours, diffDays };
  const subtitleDef = LAST_VISIT_SUBTITLES.find((v) => v.match(ctx)) || LAST_VISIT_SUBTITLES[0];

  const daysAgo = Math.max(1, Math.round(diffDays));
  const weeksAgo = Math.max(1, Math.round(diffDays / 7));
  const subtitle = subtitleDef.subtitle
    .replace('{daysAgo}', String(daysAgo))
    .replace('{weeksAgo}', String(weeksAgo))
    .replace('{weekPlural}', weeksAgo === 1 ? '' : 's');

  return {
    title: greeting.title.replace('{name}', name || 'there'),
    subtitle,
    variantIds: { greeting: greeting.id, subtitle: subtitleDef.id },
  };
}
