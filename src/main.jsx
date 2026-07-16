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
import ProSourceSettings from './prosource-settings-v2_2'
import ProSourceProduct from './prosource-product.jsx'
import ProSourceShop from './prosource-shop.jsx'
import ProSourceOrders from './prosource-orders.jsx'
import ProSourceMessages from './prosource-messages.jsx'
import ProSourceNotifications from './prosource-notifications.jsx'
import ProSourceOrderDetail from './prosource-order-detail.jsx'

/* Routes that only exist while signed in. A logged-out visitor asking for one
   of these is expressing intent we can honor after they authenticate, so we
   stash it as ?returnTo= instead of dropping them on the landing page. */
const PROTECTED_PREFIXES = [
  '/connections', '/projects', '/project', '/settings',
  '/products', '/orders', '/messages', '/notifications',
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
  const { isLoggedIn } = useAuth()

  return (
    <Routes>
      {/* Layout is shared between logged-in and logged-out visitors so the
          category nav + cart icon are always present. The login form only
          appears on /sign-in and /create-account (or when a logged-out user
          hits a protected route). Logged-out / lands on the marketing page so
          visitors can immediately start browsing — the Thumbtack-style funnel. */}
      <Route element={<Layout />}>
        {/* Public routes — guests can browse, view pros, and manage a cart. */}
        <Route path="/shop" element={<ProSourceShop />} />
        <Route path="/cart" element={<ProSourceShop />} />
        <Route path="/profile" element={<ProSourcePublicProfile />} />
        <Route path="/carts" element={<ProSourceCarts />} />

        {/* Protected routes — only mounted when logged in */}
        {isLoggedIn && (
          <>
            <Route path="/" element={<ProSourceSettings />} />
            <Route path="/connections" element={<ProSourceConnections />} />
            <Route path="/projects" element={<ProSourceProjects />} />
            <Route path="/projects/new" element={<ProSourceProjectCreate />} />
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
      </Route>

      {/* Logged-out / shows the marketing landing page — value pitch +
          sign-up form. ProSourceLogin renders its own header so it doesn't
          inherit Layout. */}
      {!isLoggedIn && <Route path="/" element={<ProSourceLogin key="landing" />} />}

      {/* Both auth entry points mount the same component straight onto the
          email/OTP form — one flow, two intents. The `key` matters: without it
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
