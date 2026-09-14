import { Navigate, Route, Routes } from 'react-router-dom';
import ProtectedRoute from './components/ProtectedRoute.jsx';
import Layout from './components/Layout.jsx';
import StoreLayout from './components/shop/StoreLayout.jsx';
import { CAPS } from './api/client.js';

// ── the public storefront: what opens when someone types the address (§8) ──
import Marketplace from './pages/shop/Marketplace.jsx';
import ProductPage from './pages/shop/ProductPage.jsx';
import ShopPage from './pages/shop/ShopPage.jsx';
import ConsumerAuth from './pages/shop/ConsumerAuth.jsx';
import CartPage from './pages/shop/CartPage.jsx';
import MyOrders from './pages/shop/MyOrders.jsx';
import MyAccount from './pages/shop/MyAccount.jsx';

// ── the admin panel, reached only through the staff sign-in link ──
import Login from './pages/Login.jsx';
import Platform from './pages/Platform.jsx';
import Markets from './pages/Markets.jsx';
import Shops from './pages/Shops.jsx';
import Dashboard from './pages/Dashboard.jsx';
import Reports from './pages/Reports.jsx';
import Products from './pages/Products.jsx';
import Models from './pages/Models.jsx';
import Inventory from './pages/Inventory.jsx';
import Sales from './pages/Sales.jsx';
import Estimates from './pages/Estimates.jsx';
import Purchases from './pages/Purchases.jsx';
import Imports from './pages/Imports.jsx';
import Orders from './pages/Orders.jsx';
import Customers from './pages/Customers.jsx';
import Suppliers from './pages/Suppliers.jsx';
import Ledgers from './pages/Ledgers.jsx';
import Users from './pages/Users.jsx';
import Settings from './pages/Settings.jsx';

const guard = (capability, element) => (
  <ProtectedRoute capability={capability}>{element}</ProtectedRoute>
);

/**
 * Two ends, one app (§9).
 *
 * The storefront is mounted at "/" and needs no account. The admin panel keeps
 * the paths it always had, so every existing link and bookmark still works — it
 * simply is no longer the front door. Nothing here redirects a visitor towards
 * the panel; the only way in is the staff sign-in link in the storefront footer
 * (§37).
 */
export default function App() {
  return (
    <Routes>
      {/* ── consumer end ── */}
      <Route element={<StoreLayout />}>
        <Route path="/" element={<Marketplace />} />
        <Route path="/product/:id" element={<ProductPage />} />
        <Route path="/shop/:id" element={<ShopPage />} />
        <Route path="/signin" element={<ConsumerAuth mode="signin" />} />
        <Route path="/signup" element={<ConsumerAuth mode="signup" />} />
        <Route path="/cart" element={<CartPage />} />
        <Route path="/my/orders" element={<MyOrders />} />
        <Route path="/my/account" element={<MyAccount />} />
      </Route>

      {/* ── staff sign-in ── */}
      <Route path="/login" element={<Login />} />

      {/* ── admin end ── */}
      <Route element={<ProtectedRoute><Layout /></ProtectedRoute>}>
        <Route path="/platform" element={guard(CAPS.SHOP_VIEW_ALL, <Platform />)} />
        {/* Markets are Super Admin territory: market.report is platform-only (§3). */}
        <Route path="/markets" element={guard(CAPS.MARKET_REPORT, <Markets />)} />
        <Route path="/shops" element={guard(CAPS.SHOP_MANAGE, <Shops />)} />

        <Route path="/dashboard" element={guard(CAPS.REPORT_VIEW, <Dashboard />)} />
        <Route path="/reports" element={guard(CAPS.REPORT_VIEW, <Reports />)} />

        <Route path="/products" element={guard(CAPS.PRODUCT_VIEW, <Products />)} />
        <Route path="/models" element={guard(CAPS.PRODUCT_VIEW, <Models />)} />
        <Route path="/inventory" element={guard(CAPS.INVENTORY_VIEW, <Inventory />)} />

        <Route path="/sales" element={guard(CAPS.SALE_VIEW, <Sales />)} />
        <Route path="/estimates" element={guard(CAPS.SALE_VIEW, <Estimates />)} />
        <Route path="/purchases" element={guard(CAPS.PURCHASE_VIEW, <Purchases />)} />
        <Route path="/imports" element={guard(CAPS.OCR_USE, <Imports />)} />
        <Route path="/orders" element={guard(CAPS.ORDER_VIEW, <Orders />)} />

        <Route path="/customers" element={guard(CAPS.CUSTOMER_VIEW, <Customers />)} />
        <Route path="/suppliers" element={guard(CAPS.SUPPLIER_VIEW, <Suppliers />)} />
        <Route path="/ledgers" element={guard(CAPS.LEDGER_VIEW, <Ledgers />)} />

        <Route path="/users" element={guard(CAPS.USER_MANAGE, <Users />)} />
        <Route path="/settings" element={<Settings />} />
      </Route>

      {/* An unknown path belongs on the storefront, never on a login screen. */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
