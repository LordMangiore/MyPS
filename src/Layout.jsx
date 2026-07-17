import React, { useState, useEffect, useMemo } from 'react'
import { Link, Outlet, useLocation } from 'react-router-dom'
import { Bell, MessageCircle, Menu, X, ShoppingCart, ClipboardList, FolderOpen } from 'lucide-react'
import { useAuth } from './auth-context'
import { guestCartCount, subscribeGuestCart, syncActiveCartToAccount } from './guest-cart'

const categories = [
  { label: 'Flooring', dept: 'Flooring' },
  { label: 'Cabinets', dept: 'Cabinets' },
  { label: 'Countertops', dept: 'Countertops' },
  { label: 'Kitchen', dept: 'Kitchen' },
  { label: 'Bath', dept: 'Bath' },
]

/**
 * What showroom staff actually navigate between. The member's category nav is a
 * shopping aisle; this is the two halves of an account manager's job. Both
 * entries are shared by the desktop header and the mobile drawer so the two can
 * never drift apart.
 */
const staffNav = [
  { to: '/am', label: 'Work Queue', menuLabel: 'Work Queue', Icon: ClipboardList },
  // "Member Projects" wherever there is room for it: she owns none of these, and
  // a menu reading "My Projects" next to somebody else's work would say she does.
  // The top nav is tight, so it gets the short form.
  { to: '/projects', label: 'Projects', menuLabel: 'Member Projects', Icon: FolderOpen },
]

const Layout = () => {
  const [accountMenuOpen, setAccountMenuOpen] = useState(false)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [hoveredIcon, setHoveredIcon] = useState(null)
  const location = useLocation()
  const { logout, userId, loadUserData, isLoggedIn, userType, homePath } = useAuth()

  /**
   * Staff, not a shopper.
   *
   * An account manager has no cart, buys nothing, and does not need a pro found
   * for her: she IS the showroom. So the member chrome (category nav, cart,
   * Find a Pro, Saved Carts, Referral Bonus, Estimates & Orders) is dropped for
   * her and the work queue takes its place, because that is the one thing she
   * came here to do. What stays is what she genuinely uses: Messages and
   * Notifications (her book of business talks to her through both) and Account
   * Settings. The member header is untouched: every branch below is additive
   * and keyed on this one flag.
   */
  const isAccountManager = isLoggedIn && userType === 'accountmanager'
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

  // One active cart, one badge. The local store is the guest's cart before
  // sign-in and the account's cart after (finalizeSession merges the two and
  // mirrors the result to the carts blob), so reading it is correct either way.
  const [cartItemCount, setCartItemCount] = useState(0)
  useEffect(() => {
    const update = () => setCartItemCount(guestCartCount())
    update()
    return subscribeGuestCart(update)
  }, [])

  // Mirror every change to the account so the cart survives to the next
  // device. Debounced: qty steppers fire a burst of writes, and this blob is
  // replaced wholesale on each one. Best-effort: syncActiveCartToAccount
  // swallows failures and no-ops until sign-in adoption has run.
  useEffect(() => {
    if (!userId) return
    let timer = null
    const schedule = () => {
      clearTimeout(timer)
      timer = setTimeout(() => syncActiveCartToAccount(userId), 800)
    }
    const unsub = subscribeGuestCart(schedule)
    return () => { clearTimeout(timer); unsub() }
  }, [userId])

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

          {/* Home for an account manager is her queue, not the storefront. */}
          <Link to={isAccountManager ? '/am' : '/'} className="no-underline shrink-0 flex items-center gap-2">
            <span style={{ fontSize: 18, fontWeight: 700, color: '#003087' }}>
              ProSource<span style={{ fontWeight: 400, fontSize: 12, color: '#003087', marginLeft: 2 }}>WHOLESALE</span>
            </span>
            {/* Says which side of the glass you are on. The app is otherwise
                identical after sign-in, so without this the only clue that you
                are staff is the nav quietly having fewer things in it. */}
            {isAccountManager && (
              <span
                className="hidden sm:inline"
                style={{
                  fontSize: 10, fontWeight: 700, letterSpacing: 0.4,
                  textTransform: 'uppercase', color: '#fff', background: '#003087',
                  borderRadius: 4, padding: '2px 6px', whiteSpace: 'nowrap',
                }}
              >Showroom</span>
            )}
          </Link>

          <nav className="hidden md:flex gap-6 flex-1 justify-center">
            {isAccountManager ? (
              /* Two things, because she does two things: work arrives in the
                 queue, and the projects that work belongs to are her members'.
                 Projects were reachable at /projects all along, but nothing in
                 her chrome said so, and what she found there was an empty copy
                 of a member's own list. */
              staffNav.map((item) => {
                const isActive = location.pathname === item.to ||
                  location.pathname.startsWith(`${item.to}/`)
                return (
                  <Link
                    key={item.to}
                    to={item.to}
                    style={{
                      display: 'inline-flex', alignItems: 'center', gap: 6,
                      color: isActive ? '#003087' : '#525252',
                      fontSize: 14, fontWeight: isActive ? 600 : 400,
                      textDecoration: 'none',
                    }}
                  >
                    <item.Icon size={16} /> {item.label}
                  </Link>
                )
              })
            ) : (
              categories.map(c => (
                <Link
                  key={c.label}
                  to={`/shop?dept=${c.dept}`}
                  style={{ color: '#525252', fontSize: 14, textDecoration: 'none' }}
                >{c.label}</Link>
              ))
            )}
          </nav>
        </div>

        <div className="flex items-center gap-3 md:gap-4 text-sm">
          {/* "Find a Pro" is a customer's errand. Tessa's equivalent is her
              connections list, which is already in the account menu.

              It goes to the pro directory now, signed in or not. It used to send
              a signed-in member to /connections, which is the people they
              already work with rather than a pro they have yet to find, and a
              signed-out one to a single hardcoded profile. Neither was the
              errand. /connections is still in the account menu, where it
              belongs. */}
          {!isAccountManager && (
            <Link to="/pros" className="hidden md:inline" style={{ color: '#525252', textDecoration: 'none' }}>Find a Pro</Link>
          )}

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

          {/* An account manager does not shop the storefront she sells from. */}
          {!isAccountManager && (
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
          )}

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
            <>
              <Link
                to="/sign-in"
                style={{
                  color: '#003087', fontWeight: 600, fontSize: 14,
                  textDecoration: 'none',
                  padding: '6px 14px', border: '1px solid #003087', borderRadius: 6,
                  whiteSpace: 'nowrap',
                }}
              >Sign In</Link>
              {/* Below sm the header is already tight; the drawer carries the
                  same CTA there, so hide rather than crush it. */}
              <Link
                to="/create-account"
                className="hidden sm:inline-block"
                style={{
                  background: '#003087', color: '#fff', fontWeight: 600, fontSize: 14,
                  textDecoration: 'none',
                  padding: '7px 14px', border: '1px solid #003087', borderRadius: 6,
                  whiteSpace: 'nowrap',
                }}
              >Create Account</Link>
            </>
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
                {/* Staff menu: the customer entries above the divider (projects,
                    referral bonus, estimates, saved carts) are things Tessa does
                    not have. Her work queue takes their place. */}
                {isAccountManager ? (
                  <>
                    <Link to="/am" style={menuItemStyle} onClick={() => setAccountMenuOpen(false)}>Work Queue</Link>
                    {/* "Member Projects", not "My Projects": she owns none of
                        them, and the menu should not imply otherwise. */}
                    <Link to="/projects" style={menuItemStyle} onClick={() => setAccountMenuOpen(false)}>Member Projects</Link>
                    <div style={{ borderTop: '1px solid #e5e5e5', margin: '8px 0' }} />
                    <Link to="/connections" style={menuItemStyle} onClick={() => setAccountMenuOpen(false)}>Connections</Link>
                    <Link to="/messages" style={menuItemStyle} onClick={() => setAccountMenuOpen(false)}>Messages</Link>
                    <Link to="/notifications" style={menuItemStyle} onClick={() => setAccountMenuOpen(false)}>Notifications</Link>
                    <div style={{ borderTop: '1px solid #e5e5e5', margin: '8px 0' }} />
                    <Link to="/settings?section=account" style={menuItemStyle} onClick={() => setAccountMenuOpen(false)}>Account Settings</Link>
                  </>
                ) : (
                  <>
                    <Link to={homePath} style={menuItemStyle} onClick={() => setAccountMenuOpen(false)}>Dashboard</Link>
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
                  </>
                )}
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
              {/* Same split as the desktop header: staff get their queue, not a
                  storefront and a cart they will never use. */}
              {isAccountManager ? (
                <>
                  <div className="px-4 py-2 text-xs uppercase tracking-wider text-neutral-500">Showroom</div>
                  {staffNav.map((item) => (
                    <Link
                      key={item.to}
                      to={item.to}
                      onClick={closeMobile}
                      className="block px-4 py-3 text-sm text-neutral-700 hover:bg-neutral-50"
                    >{item.menuLabel}</Link>
                  ))}
                  <div className="border-t border-neutral-200 my-2" />
                  <Link to="/connections" onClick={closeMobile} className="block px-4 py-3 text-sm text-neutral-700 hover:bg-neutral-50">Connections</Link>
                  <Link to="/messages" onClick={closeMobile} className="block px-4 py-3 text-sm text-neutral-700 hover:bg-neutral-50">Messages</Link>
                  <Link to="/notifications" onClick={closeMobile} className="block px-4 py-3 text-sm text-neutral-700 hover:bg-neutral-50">Notifications</Link>
                </>
              ) : (
                <>
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
                  <Link to="/pros" onClick={closeMobile} className="block px-4 py-3 text-sm text-neutral-700 hover:bg-neutral-50">Find a Pro</Link>
                  <Link to="/cart" onClick={closeMobile} className="block px-4 py-3 text-sm text-neutral-700 hover:bg-neutral-50">Your cart</Link>
                  {!isLoggedIn && (
                    <>
                      <div className="border-t border-neutral-200 my-2" />
                      <Link to="/sign-in" onClick={closeMobile} className="block px-4 py-3 text-sm font-semibold text-blue-700 hover:bg-neutral-50">Sign In</Link>
                      <Link to="/create-account" onClick={closeMobile} className="block px-4 py-3 text-sm font-semibold text-blue-700 hover:bg-neutral-50">Create Account</Link>
                    </>
                  )}
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
