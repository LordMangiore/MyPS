import React, { useEffect, useRef, useState } from 'react';

/**
 * Lightweight address autocomplete using komoot's Photon API.
 *
 * Why Photon: free, no API key, no signup, no credit card. Backed by
 * OpenStreetMap. Quality varies by region but is solid for US street
 * addresses, which is what this demo needs.
 *
 * Props:
 *   value     — controlled street-address string
 *   onChange  — fires on every keystroke with the new string
 *   onSelect  — fires when a user picks a suggestion. Receives
 *               { street, city, state, zip } so the parent can populate
 *               its other address fields in one shot.
 *   style     — passed through to the input
 *   placeholder, disabled — pass-through input props.
 *
 * Behavior: 300ms debounce, max 5 suggestions, filters to US results,
 * suggestions render in an absolute-positioned dropdown.
 */

// Compact two-letter state codes for the most common results. Photon returns
// the long form ("Missouri") so we map them down to "MO" to match our forms.
const STATE_ABBR = {
  Alabama: 'AL', Alaska: 'AK', Arizona: 'AZ', Arkansas: 'AR', California: 'CA',
  Colorado: 'CO', Connecticut: 'CT', Delaware: 'DE', Florida: 'FL', Georgia: 'GA',
  Hawaii: 'HI', Idaho: 'ID', Illinois: 'IL', Indiana: 'IN', Iowa: 'IA',
  Kansas: 'KS', Kentucky: 'KY', Louisiana: 'LA', Maine: 'ME', Maryland: 'MD',
  Massachusetts: 'MA', Michigan: 'MI', Minnesota: 'MN', Mississippi: 'MS', Missouri: 'MO',
  Montana: 'MT', Nebraska: 'NE', Nevada: 'NV', 'New Hampshire': 'NH', 'New Jersey': 'NJ',
  'New Mexico': 'NM', 'New York': 'NY', 'North Carolina': 'NC', 'North Dakota': 'ND',
  Ohio: 'OH', Oklahoma: 'OK', Oregon: 'OR', Pennsylvania: 'PA', 'Rhode Island': 'RI',
  'South Carolina': 'SC', 'South Dakota': 'SD', Tennessee: 'TN', Texas: 'TX', Utah: 'UT',
  Vermont: 'VT', Virginia: 'VA', Washington: 'WA', 'West Virginia': 'WV', Wisconsin: 'WI',
  Wyoming: 'WY', 'District of Columbia': 'DC',
};

const buildStreet = (p) => {
  const num = p.housenumber || '';
  const street = p.street || p.name || '';
  return [num, street].filter(Boolean).join(' ').trim();
};

const buildLabel = (p) => {
  const street = buildStreet(p);
  const city = p.city || p.town || p.village || '';
  const state = STATE_ABBR[p.state] || p.state || '';
  const zip = p.postcode || '';
  return [street, city, [state, zip].filter(Boolean).join(' ')]
    .filter(Boolean)
    .join(', ');
};

export default function AddressAutocomplete({
  value,
  onChange,
  onSelect,
  style,
  placeholder,
  disabled,
}) {
  const [suggestions, setSuggestions] = useState([]);
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const debounceRef = useRef(null);
  const containerRef = useRef(null);
  const abortRef = useRef(null);

  // Close on outside click.
  useEffect(() => {
    const onDoc = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!value || value.trim().length < 3) {
      setSuggestions([]);
      return;
    }
    debounceRef.current = setTimeout(async () => {
      try {
        if (abortRef.current) abortRef.current.abort();
        abortRef.current = new AbortController();
        const res = await fetch(
          `https://photon.komoot.io/api/?q=${encodeURIComponent(value)}&limit=5&lang=en`,
          { signal: abortRef.current.signal }
        );
        const data = await res.json();
        const features = (data.features || [])
          .filter((f) => f.properties?.countrycode === 'US')
          // Require enough address signal to be useful.
          .filter((f) => f.properties?.street || f.properties?.name);
        setSuggestions(features);
        setActiveIndex(-1);
        setOpen(features.length > 0);
      } catch (err) {
        if (err.name !== 'AbortError') {
          // Network or API hiccup — fall back silently to a regular text input.
          setSuggestions([]);
        }
      }
    }, 300);
    return () => clearTimeout(debounceRef.current);
  }, [value]);

  const pick = (feat) => {
    const p = feat.properties || {};
    const result = {
      street: buildStreet(p),
      city: p.city || p.town || p.village || '',
      state: STATE_ABBR[p.state] || p.state || '',
      zip: p.postcode || '',
    };
    if (onSelect) onSelect(result);
    setOpen(false);
    setSuggestions([]);
  };

  const onKeyDown = (e) => {
    if (!open || suggestions.length === 0) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex((i) => Math.min(suggestions.length - 1, i + 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex((i) => Math.max(0, i - 1));
    } else if (e.key === 'Enter' && activeIndex >= 0) {
      e.preventDefault();
      pick(suggestions[activeIndex]);
    } else if (e.key === 'Escape') {
      setOpen(false);
    }
  };

  return (
    <div ref={containerRef} style={{ position: 'relative' }}>
      <input
        type="text"
        value={value || ''}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => suggestions.length > 0 && setOpen(true)}
        onKeyDown={onKeyDown}
        style={style}
        placeholder={placeholder}
        disabled={disabled}
        autoComplete="off"
      />
      {open && suggestions.length > 0 && (
        <div
          style={{
            position: 'absolute',
            top: '100%',
            left: 0,
            right: 0,
            marginTop: 4,
            background: '#fff',
            border: '1px solid #e5e5e5',
            borderRadius: 6,
            boxShadow: '0 8px 24px rgba(0,0,0,0.08)',
            zIndex: 100,
            overflow: 'hidden',
          }}
        >
          {suggestions.map((feat, i) => (
            <button
              key={feat.properties?.osm_id || i}
              type="button"
              onMouseDown={(e) => { e.preventDefault(); pick(feat); }}
              onMouseEnter={() => setActiveIndex(i)}
              style={{
                display: 'block',
                width: '100%',
                textAlign: 'left',
                padding: '10px 14px',
                background: i === activeIndex ? '#f0f5ff' : 'transparent',
                border: 'none',
                cursor: 'pointer',
                fontSize: 14,
                color: '#171717',
                fontFamily: 'inherit',
                borderBottom: i < suggestions.length - 1 ? '1px solid #f5f5f5' : 'none',
              }}
            >
              {buildLabel(feat.properties)}
            </button>
          ))}
          <div style={{ padding: '6px 14px', fontSize: 11, color: '#a3a3a3', borderTop: '1px solid #f5f5f5' }}>
            Powered by OpenStreetMap
          </div>
        </div>
      )}
    </div>
  );
}
