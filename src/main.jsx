import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'

import './index.css'
import { AuthProvider, useAuth } from './auth-context'
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

const AppRouter = () => {
  const { isLoggedIn } = useAuth()

  return (
    <Routes>
      {/* Layout is shared between logged-in and logged-out visitors so the
          category nav + cart icon are always present. The dead-end login form
          only appears on /sign-in (or when a logged-out user hits a protected
          route). Logged-out / lands on the shop so visitors can immediately
          start browsing — the original Thumbtack-style funnel. */}
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
      {!isLoggedIn && <Route path="/" element={<ProSourceLogin />} />}

      <Route
        path="/sign-in"
        element={isLoggedIn ? <Navigate to="/" replace /> : <ProSourceLogin />}
      />

      {/* Anything else: logged in → home, logged out → marketing page. */}
      <Route
        path="*"
        element={<Navigate to={isLoggedIn ? '/' : '/'} replace />}
      />
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
