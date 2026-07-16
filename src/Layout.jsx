import React, { useState, useEffect, useMemo } from 'react'
import { Link, Outlet, useLocation } from 'react-router-dom'
import { Bell, MessageCircle, Menu, X, ShoppingCart } from 'lucide-react'
import { useAuth } from './auth-context'
import { guestCartCount, subscribeGuestCart } from './guest-cart'

const categories = [
  { label: 'Flooring', dept: 'Flooring' },
  { label: 'Cabinets', dept: 'Cabinets' },
  { label: 'Countertops', dept: 'Countertops' },
  { label: 'Kitchen', dept: 'Kitchen' },
  { label: 'Bath', dept: 'Bath' },
]

const Layout = () => {
  const [accountMenuOpen, setAccountMenuOpen] = useState(false)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [hoveredIcon, setHoveredIcon] = useState(null)
  const location = useLocation()
  const { logout, userId, loadUserData, isLoggedIn } = useAuth()
  const [projects, setProjects] = useState([])
  const [threads, setThreads] = useState([])
  const [readIds, setReadIds] = useState(new Set())

  // Re-fetch on every route change so badge counts stay current as users
  // navigate between pages that mutate data (post a comment, send a message,
  // mark a notification read).
  useEffect(() => {
    if (!userId) return
    let cancelled = false
    Promise.all([
      loadUserData('projects', null),
      loadUserData('messages', null),
      loadUserData('notifications', null),
    ]).then(([p, m, n]) => {
      if (cancelled) return
      const list = Array.isArray(p?.list)
        ? p.list
        : (p?.project ? [{ ...p.project, status: p.status || 'working', id: 'legacy' }] : [])
      setProjects(list)
      setThreads(Array.isArray(m?.threads) ? m.threads : [])
      setReadIds(new Set(Array.isArray(n?.readIds) ? n.readIds : []))
    })
    return () => { cancelled = true }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, location.pathname])

  // Mirror the notifications-page synth so badge counts match exactly.
  const unreadNotificationCount = useMemo(() => {
    let ids = []
    threads.forEach((t) => {
      const last = t.messages?.[t.messages.length - 1]
      if (!last || last.isMe) return
      ids.push(`msg:${t.id}:${last.id || last.timestamp}`)
    })
    projects.forEach((p) => {
      if (p.archived) return
      const base = `proj:${p.id}`
      if (p.status === 'complete') ids.push(`${base}:complete`)
      else if (p.status === 'published') ids.push(`${base}:published`)
      else ids.push(`${base}:created`)
    })
    return ids.filter((id) => !readIds.has(id)).length
  }, [threads, projects, readIds])

  const unreadMessageCount = useMemo(() =>
    threads.filter((t) => t.unread).length,
  [threads])

  const [cartItemCount, setCartItemCount] = useState(0)
  useEffect(() => {
    // For logged-out visitors the count comes from localStorage. For signed-in
    // users we surface the number of items in their most recent saved cart
    // so the icon stays meaningful even after migration.
    const updateGuest = () => setCartItemCount(guestCartCount())
    updateGuest()
    const unsub = subscribeGuestCart(updateGuest)
    return () => unsub()
  }, [])

  const isMessagesActive = location.pathname === '/messages'
  const isNotificationsActive = location.pathname === '/notifications'

  const closeMobile = () => setMobileMenuOpen(false)

  return (
    <div>
      <header
        className="flex justify-between items-center px-4 md:px-6 py-3 border-b border-neutral-200 bg-white max-w-[1140px] mx-auto"
        style={{ fontFamily: "'Open Sans', -apple-system, BlinkMacSystemFont, sans-serif" }}
      >
        <div className="flex items-center gap-4 md:gap-12 flex-1 min-w-0">
          <button
            className="md:hidden p-1 -ml-1 text-neutral-700"
            onClick={() => setMobileMenuOpen(true)}
            aria-label="Open menu"
          >
            <Menu size={22} />
          </button>

          <Link to="/" className="no-underline shrink-0">
            <span style={{ fontSize: 18, fontWeight: 700, color: '#003087' }}>
              ProSource<span style={{ fontWeight: 400, fontSize: 12, color: '#003087', marginLeft: 2 }}>WHOLESALE</span>
            </span>
          </Link>

          <nav className="hidden md:flex gap-6 flex-1 justify-center">
            {categories.map(c => (
              <Link
                key={c.label}
                to={`/shop?dept=${c.dept}`}
                style={{ color: '#525252', fontSize: 14, textDecoration: 'none' }}
              >{c.label}</Link>
            ))}
          </nav>
        </div>

        <div className="flex items-center gap-3 md:gap-4 text-sm">
          <Link to={isLoggedIn ? "/connections" : "/profile"} className="hidden md:inline" style={{ color: '#525252', textDecoration: 'none' }}>Find a Pro</Link>

          {isLoggedIn && (
          <Link
            to="/messages"
            onMouseEnter={() => setHoveredIcon('messages')}
            onMouseLeave={() => setHoveredIcon(null)}
            style={{
              position: 'relative',
              color: isMessagesActive || hoveredIcon === 'messages' ? '#003087' : '#525252',
              display: 'flex',
              alignItems: 'center',
              transition: 'color 0.15s ease',
            }}
          >
            <MessageCircle size={20} />
            {unreadMessageCount > 0 && (
              <span style={{
                position: 'absolute', top: -4, right: -4,
                width: 8, height: 8, borderRadius: '50%',
                background: '#BA0C2F',
              }} />
            )}
          </Link>
          )}

          <Link
            to="/cart"
            onMouseEnter={() => setHoveredIcon('cart')}
            onMouseLeave={() => setHoveredIcon(null)}
            style={{
              position: 'relative',
              color: location.pathname === '/cart' || location.pathname === '/carts' || hoveredIcon === 'cart' ? '#003087' : '#525252',
              display: 'flex',
              alignItems: 'center',
              transition: 'color 0.15s ease',
            }}
            aria-label="Cart"
          >
            <ShoppingCart size={20} />
            {cartItemCount > 0 && (
              <span style={{
                position: 'absolute', top: -6, right: -8,
                background: '#003087', color: '#fff',
                fontSize: 10, fontWeight: 700,
                borderRadius: 10, padding: '1px 5px',
                lineHeight: '14px',
              }}>{cartItemCount > 99 ? '99+' : cartItemCount}</span>
            )}
          </Link>

          {isLoggedIn && (
          <Link
            to="/notifications"
            onMouseEnter={() => setHoveredIcon('notifications')}
            onMouseLeave={() => setHoveredIcon(null)}
            style={{
              position: 'relative',
              color: isNotificationsActive || hoveredIcon === 'notifications' ? '#003087' : '#525252',
              display: 'flex',
              alignItems: 'center',
              transition: 'color 0.15s ease',
            }}
          >
            <Bell size={20} />
            {unreadNotificationCount > 0 && (
              <span style={{
                position: 'absolute', top: -6, right: -8,
                background: '#BA0C2F', color: '#fff',
                fontSize: 10, fontWeight: 700,
                borderRadius: 10, padding: '1px 5px',
                lineHeight: '14px',
              }}>{unreadNotificationCount > 99 ? '99+' : unreadNotificationCount}</span>
            )}
          </Link>
          )}

          {!isLoggedIn ? (
            <Link
              to="/sign-in"
              style={{
                color: '#003087', fontWeight: 600, fontSize: 14,
                textDecoration: 'none',
                padding: '6px 14px', border: '1px solid #003087', borderRadius: 6,
              }}
            >Sign In</Link>
          ) : (
          <div className="relative">
            <button
              onClick={() => setAccountMenuOpen(!accountMenuOpen)}
              style={{
                background: 'none',
                border: 'none',
                color: '#003087',
                fontWeight: 600,
                fontSize: 14,
                cursor: 'pointer',
                padding: 0,
              }}
            >
              <span className="hidden sm:inline">My Account</span>
              <span className="sm:hidden">Account</span>
            </button>

            {accountMenuOpen && (
              <div className="absolute top-full right-0 mt-2 bg-white border border-neutral-200 rounded-lg shadow-lg min-w-[200px] z-50">
                <Link to="/settings" style={menuItemStyle} onClick={() => setAccountMenuOpen(false)}>Dashboard</Link>
                <Link to="/projects" style={menuItemStyle} onClick={() => setAccountMenuOpen(false)}>My Projects</Link>
                <Link to="/settings?section=referrals" style={menuItemStyle} onClick={() => setAccountMenuOpen(false)}>Referral Bonus</Link>
                <Link to="/orders" style={menuItemStyle} onClick={() => setAccountMenuOpen(false)}>Estimates & Orders</Link>
                <div style={{ borderTop: '1px solid #e5e5e5', margin: '8px 0' }} />
                <Link to="/carts" style={menuItemStyle} onClick={() => setAccountMenuOpen(false)}>Saved Carts</Link>
                <Link to="/connections" style={menuItemStyle} onClick={() => setAccountMenuOpen(false)}>Connections</Link>
                <Link to="/messages" style={menuItemStyle} onClick={() => setAccountMenuOpen(false)}>Messages</Link>
                <Link to="/notifications" style={menuItemStyle} onClick={() => setAccountMenuOpen(false)}>Notifications</Link>
                <Link to="/profile?own=1" style={menuItemStyle} onClick={() => setAccountMenuOpen(false)}>My Profile</Link>
                <div style={{ borderTop: '1px solid #e5e5e5', margin: '8px 0' }} />
                <Link to="/settings?section=account" style={menuItemStyle} onClick={() => setAccountMenuOpen(false)}>Account Settings</Link>
                <Link to="/settings?section=team" style={menuItemStyle} onClick={() => setAccountMenuOpen(false)}>Manage Users</Link>
                <div style={{ borderTop: '1px solid #e5e5e5', margin: '8px 0' }} />
                <button style={{ ...menuItemStyle, width: '100%', textAlign: 'left', background: 'none', border: 'none', color: '#BA0C2F', cursor: 'pointer' }} onClick={() => { setAccountMenuOpen(false); logout(); }}>Sign Out</button>
              </div>
            )}
          </div>
          )}
        </div>
      </header>

      {mobileMenuOpen && (
        <div className="md:hidden fixed inset-0 z-[100]">
          <div className="absolute inset-0 bg-black/40" onClick={closeMobile} />
          <div className="absolute top-0 left-0 bottom-0 w-72 max-w-[80vw] bg-white shadow-xl flex flex-col">
            <div className="flex items-center justify-between px-4 py-3 border-b border-neutral-200">
              <span style={{ fontSize: 16, fontWeight: 700, color: '#003087' }}>
                ProSource<span style={{ fontWeight: 400, fontSize: 11, marginLeft: 2 }}>WHOLESALE</span>
              </span>
              <button onClick={closeMobile} aria-label="Close menu" className="p-1 text-neutral-700">
                <X size={20} />
              </button>
            </div>
            <nav className="flex-1 overflow-auto py-2">
              <div className="px-4 py-2 text-xs uppercase tracking-wider text-neutral-500">Shop</div>
              {categories.map(c => (
                <Link
                  key={c.label}
                  to={`/shop?dept=${c.dept}`}
                  onClick={closeMobile}
                  className="block px-4 py-3 text-sm text-neutral-700 hover:bg-neutral-50"
                >{c.label}</Link>
              ))}
              <div className="border-t border-neutral-200 my-2" />
              <Link to={isLoggedIn ? "/connections" : "/profile"} onClick={closeMobile} className="block px-4 py-3 text-sm text-neutral-700 hover:bg-neutral-50">Find a Pro</Link>
              <Link to="/cart" onClick={closeMobile} className="block px-4 py-3 text-sm text-neutral-700 hover:bg-neutral-50">Your cart</Link>
              {!isLoggedIn && (
                <>
                  <div className="border-t border-neutral-200 my-2" />
                  <Link to="/sign-in" onClick={closeMobile} className="block px-4 py-3 text-sm font-semibold text-blue-700 hover:bg-neutral-50">Sign In / Create Account</Link>
                </>
              )}
            </nav>
          </div>
        </div>
      )}

      <Outlet />
    </div>
  )
}

const menuItemStyle = {
  display: 'block',
  padding: '12px 16px',
  color: '#404040',
  textDecoration: 'none',
  fontSize: 14
}

export default Layout
