import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom'

import './index.css'
import { AuthProvider, useAuth, safeReturnTo } from './auth-context'
import Layout from './Layout'
import ProSourceLogin from './prosource-login'
import ProSourceCarts from './prosource-carts'
import ProSourceConnections from './prosource-connections_1'
import ProSourceProjects from './prosource-projects'
import ProSourceProjectCreate from './prosource-project-create'
import ProSourceProjectDetail from './prosource-project-detail'
import ProSourcePublicProfile from './prosource-public-profile_1'
import ProSourcePros from './prosource-pros'
import ProSourceSettings from './prosource-settings-v2_2'
import ProSourceProduct from './prosource-product.jsx'
import ProSourceShop from './prosource-shop.jsx'
import ProSourceOrders from './prosource-orders.jsx'
import ProSourceMessages from './prosource-messages.jsx'
import ProSourceNotifications from './prosource-notifications.jsx'
import ProSourceOrderDetail from './prosource-order-detail.jsx'
import ProSourceAmConsole from './prosource-am-console.jsx'

/* Routes that only exist while signed in. A logged-out visitor asking for one
   of these is expressing intent we can honor after they authenticate, so we
   stash it as ?returnTo= instead of dropping them on the landing page. */
const PROTECTED_PREFIXES = [
  '/connections', '/projects', '/project', '/settings',
  '/products', '/orders', '/messages', '/notifications',
  '/am',
]

const isProtectedPath = (pathname) =>
  PROTECTED_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`))

/** Send a signed-in visitor to their captured destination, else home. */
const SignedInRedirect = () => {
  const location = useLocation()
  const dest = safeReturnTo(new URLSearchParams(location.search).get('returnTo')) || '/'
  return <Navigate to={dest} replace />
}

/* Wildcard. Logged in → home. Logged out → the sign-in form, carrying the
   protected destination they were reaching for; genuinely unknown URLs just
   go home rather than pushing a stranger at a login wall. */
const NotFoundRedirect = () => {
  const { isLoggedIn } = useAuth()
  const location = useLocation()
  if (isLoggedIn || !isProtectedPath(location.pathname)) {
    return <Navigate to="/" replace />
  }
  const dest = `${location.pathname}${location.search}${location.hash}`
  return <Navigate to={`/sign-in?returnTo=${encodeURIComponent(dest)}`} replace />
}

const AppRouter = () => {
  const { isLoggedIn, userType } = useAuth()
  /* The console is staff-only, so it is mounted only for the one userType that
     has a work queue. A signed-in member who types /am falls through to the
     wildcard and goes home, which is the same thing every other URL they have
     no business at does. This is not a security boundary (nothing here is one):
     it keeps a screen that would be empty and confusing out of their way. */
  const isAccountManager = isLoggedIn && userType === 'accountmanager'

  return (
    <Routes>
      {/* Layout is shared between logged-in and logged-out visitors so the
          category nav + cart icon are always present. The login form only
          appears on /sign-in and /create-account (or when a logged-out user
          hits a protected route). Logged-out / lands on the marketing page so
          visitors can immediately start browsing, the Thumbtack-style funnel. */}
      <Route element={<Layout />}>
        {/* Public routes: guests can browse, view pros, and manage a cart. */}
        <Route path="/shop" element={<ProSourceShop />} />
        {/* Canonical, shareable product page. `/shop?product=<id>` still works;
            the shop resolves the legacy id and redirects here. */}
        <Route path="/shop/:sku" element={<ProSourceShop />} />
        <Route path="/cart" element={<ProSourceShop />} />
        {/* Two different questions, which used to be one route answering both
            badly. /profile is YOURS: the account menu's "My Profile", editable,
            read from your own account. /profile/:proId is somebody else's, out
            of the pro directory, read only. When one route served both, a
            member browsing pros was shown their own name over a stranger's bio,
            because there was only ever one set of state to render.
            See src/pro-directory.js. */}
        <Route path="/pros" element={<ProSourcePros />} />
        <Route path="/profile" element={<ProSourcePublicProfile />} />
        <Route path="/profile/:proId" element={<ProSourcePublicProfile />} />
        <Route path="/carts" element={<ProSourceCarts />} />

        {/* Protected routes: only mounted when logged in */}
        {isLoggedIn && (
          <>
            {/* Home means different things to a member and to showroom staff.
                The member dashboard is a customer surface: my projects, my
                saved carts, shop now. An account manager owns none of those,
                so landing them there greets them with an empty version of
                someone else's app. Their home is the work their members are
                waiting on. */}
            <Route
              path="/"
              element={isAccountManager ? <Navigate to="/am" replace /> : <ProSourceSettings />}
            />
            <Route path="/connections" element={<ProSourceConnections />} />
            {/* /projects is shared on purpose: it answers "the projects I came
                here to look at", which for a member is their own and for an
                account manager is her members'. ProSourceProjects picks the
                reader. /projects/:id is shared for the same reason, resolving
                whose blob to read from ?owner=. */}
            <Route path="/projects" element={<ProSourceProjects />} />
            {/* An account manager creates nothing here: a project belongs to the
                member whose account holds it, and she has no account to put one
                in. The route still has to exist, or /projects/new would fall
                through to /projects/:id and be read as a project with the id
                "new". Redirect rather than unmount. */}
            <Route
              path="/projects/new"
              element={isAccountManager ? <Navigate to="/projects" replace /> : <ProSourceProjectCreate />}
            />
            <Route path="/projects/:id" element={<ProSourceProjectDetail />} />
            <Route path="/project" element={<Navigate to="/projects" replace />} />
            <Route path="/settings" element={<ProSourceSettings />} />
            <Route path="/products" element={<ProSourceProduct />} />
            <Route path="/orders" element={<ProSourceOrders />} />
            <Route path="/orders/:orderId" element={<ProSourceOrderDetail />} />
            <Route path="/messages" element={<ProSourceMessages />} />
            <Route path="/notifications" element={<ProSourceNotifications />} />
          </>
        )}

        {/* Staff-only, alongside the protected routes rather than inside them:
            its own gate, so it cannot be reached by being merely signed in. */}
        {isAccountManager && <Route path="/am" element={<ProSourceAmConsole />} />}
      </Route>

      {/* Logged-out / shows the marketing landing page: value pitch plus
          sign-up form. ProSourceLogin renders its own header so it doesn't
          inherit Layout. */}
      {!isLoggedIn && <Route path="/" element={<ProSourceLogin key="landing" />} />}

      {/* Both auth entry points mount the same component straight onto the
          email/OTP form: one flow, two intents. The `key` matters: without it
          React reconciles /sign-in ↔ /create-account as a prop update and the
          initialMode useState never re-runs, stranding the wrong copy. */}
      <Route
        path="/sign-in"
        element={isLoggedIn
          ? <SignedInRedirect />
          : <ProSourceLogin key="sign-in" initialPage="auth" initialMode="signin" />}
      />
      <Route
        path="/create-account"
        element={isLoggedIn
          ? <SignedInRedirect />
          : <ProSourceLogin key="create-account" initialPage="auth" initialMode="signup" />}
      />

      <Route path="*" element={<NotFoundRedirect />} />
    </Routes>
  )
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <BrowserRouter>
    <AuthProvider>
      <AppRouter />
    </AuthProvider>
  </BrowserRouter>
)
