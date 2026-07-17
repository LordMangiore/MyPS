import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Star, MapPin, Search, BadgeCheck } from 'lucide-react';
import {
  PROS,
  proFullName,
  proInitials,
  ratingOf,
  reviewCountOf,
} from './pro-directory';

const colors = {
  red: '#BA0C2F',
  darkBlue: '#003087',
  green: '#07542E',
  gray100: '#f8f9fa',
  gray200: '#e9ecef',
  gray300: '#dee2e6',
  gray500: '#6c757d',
  gray700: '#495057',
  gray900: '#212529',
};

const AVATAR_TONES = ['#003087', '#07542E', '#BA0C2F', '#1a4eb8', '#6b21a8'];

/**
 * "Find a Pro".
 *
 * This link used to land on a single hardcoded profile, so "find" meant "look
 * at the one". There is now a list to look through, which is the least a page
 * with this name can do. See src/pro-directory.js for what these are and, more
 * importantly, what they are not: they are demo content, not accounts.
 *
 * Every specialty chip and the search box filter the same list in the client,
 * because the list IS in the client. No endpoint to call and no loading state
 * to fake.
 */
export default function ProSourcePros() {
  const [query, setQuery] = useState('');
  const [specialty, setSpecialty] = useState('all');

  // Trades, not specialties: pros share trades, and a chip is only worth
  // pressing if it can group. See TRADES in src/pro-directory.js.
  const trades = useMemo(() => {
    const counts = new Map();
    PROS.forEach((p) => p.trades.forEach((t) => counts.set(t, (counts.get(t) || 0) + 1)));
    return [
      { id: 'all', label: 'All pros', count: PROS.length },
      ...[...counts.entries()]
        .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
        .map(([id, count]) => ({ id, label: id, count })),
    ];
  }, []);

  // Search still reaches the specialties, since their own words are what
  // somebody would type. The chips group; the box finds.
  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    return PROS.filter((p) => {
      if (specialty !== 'all' && !p.trades.includes(specialty)) return false;
      if (!q) return true;
      return [proFullName(p), p.company, p.location, p.headline, ...p.trades, ...p.specialties]
        .join(' ')
        .toLowerCase()
        .includes(q);
    });
  }, [query, specialty]);

  return (
    <div style={{ background: colors.gray100, minHeight: '100vh' }}>
      <div style={{ maxWidth: 1080, margin: '0 auto', padding: '32px 24px 64px' }}>
        <h1 style={{ fontSize: 28, fontWeight: 700, color: colors.gray900, margin: 0 }}>
          Find a Pro
        </h1>
        <p style={{ color: colors.gray500, fontSize: 14, margin: '6px 0 24px' }}>
          Contractors and designers who work out of your ProSource showroom. Browse their work,
          then ask one for a consultation.
        </p>

        <div style={{ position: 'relative', marginBottom: 16 }}>
          <Search
            size={16}
            color={colors.gray500}
            style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)' }}
          />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by name, trade, or city"
            style={{
              width: '100%',
              padding: '11px 12px 11px 36px',
              border: `1px solid ${colors.gray300}`,
              borderRadius: 8,
              fontSize: 14,
              fontFamily: 'inherit',
              background: '#fff',
            }}
          />
        </div>

        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 24 }}>
          {trades.map((s) => {
            const active = specialty === s.id;
            return (
              <button
                key={s.id}
                onClick={() => setSpecialty(s.id)}
                style={{
                  padding: '6px 12px',
                  borderRadius: 999,
                  border: `1px solid ${active ? colors.darkBlue : colors.gray300}`,
                  background: active ? colors.darkBlue : '#fff',
                  color: active ? '#fff' : colors.gray700,
                  fontSize: 13,
                  fontWeight: 500,
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                }}
              >
                {s.label} <span style={{ opacity: 0.7 }}>· {s.count}</span>
              </button>
            );
          })}
        </div>

        {results.length === 0 ? (
          <div style={{
            background: '#fff', border: `1px solid ${colors.gray200}`, borderRadius: 12,
            padding: '48px 24px', textAlign: 'center', color: colors.gray500, fontSize: 14,
          }}>
            No pros match that. Try a different trade or clear the search.
          </div>
        ) : (
          <div style={{ display: 'grid', gap: 16, gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))' }}>
            {results.map((pro, i) => {
              const rating = ratingOf(pro);
              return (
                <Link
                  key={pro.id}
                  to={`/profile/${pro.id}`}
                  style={{
                    background: '#fff',
                    border: `1px solid ${colors.gray200}`,
                    borderRadius: 12,
                    padding: 20,
                    textDecoration: 'none',
                    display: 'block',
                  }}
                >
                  <div style={{ display: 'flex', gap: 14, marginBottom: 12 }}>
                    {/* Flex-centred, not text-aligned: Tailwind's preflight makes
                        svg a block, so textAlign cannot centre initials beside
                        one. Same reason the icon rows below use flex. */}
                    <div style={{
                      width: 52, height: 52, borderRadius: '50%', flexShrink: 0,
                      background: AVATAR_TONES[i % AVATAR_TONES.length],
                      color: '#fff', fontWeight: 700, fontSize: 17,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>{proInitials(pro)}</div>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 16, fontWeight: 700, color: colors.gray900 }}>
                        {proFullName(pro)}
                      </div>
                      <div style={{ fontSize: 13, color: colors.darkBlue, fontWeight: 600 }}>
                        {pro.company}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 4 }}>
                        <Star size={13} fill="#f59e0b" color="#f59e0b" />
                        <span style={{ fontSize: 13, fontWeight: 600, color: colors.gray900 }}>
                          {rating.toFixed(1)}
                        </span>
                        <span style={{ fontSize: 12, color: colors.gray500 }}>
                          ({reviewCountOf(pro)})
                        </span>
                      </div>
                    </div>
                  </div>

                  <p style={{ fontSize: 13, color: colors.gray700, margin: '0 0 12px', lineHeight: 1.5 }}>
                    {pro.headline}
                  </p>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 4 }}>
                    <MapPin size={13} color={colors.gray500} style={{ flexShrink: 0 }} />
                    <span style={{ fontSize: 12, color: colors.gray500 }}>{pro.location}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                    <BadgeCheck size={13} color={colors.green} style={{ flexShrink: 0 }} />
                    <span style={{ fontSize: 12, color: colors.gray500 }}>
                      {pro.stats.hired} jobs · {pro.showroom.name}
                    </span>
                  </div>

                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 12 }}>
                    {pro.specialties.slice(0, 3).map((s) => (
                      <span key={s} style={{
                        fontSize: 11, color: colors.gray700, background: colors.gray100,
                        border: `1px solid ${colors.gray200}`, padding: '3px 8px', borderRadius: 4,
                      }}>{s}</span>
                    ))}
                    {pro.specialties.length > 3 && (
                      <span style={{ fontSize: 11, color: colors.gray500, padding: '3px 2px' }}>
                        +{pro.specialties.length - 3}
                      </span>
                    )}
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
