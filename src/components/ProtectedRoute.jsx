import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

export default function ProtectedRoute({ children, requireSuperAdmin = false, capability = null }) {
  const { isAuthenticated, booting, isSuperAdmin, can } = useAuth();
  const location = useLocation();

  if (booting) {
    return (
      <div className="loading-block" style={{ minHeight: '100vh' }}>
        <div className="spinner" />
        <div>Restoring your session…</div>
      </div>
    );
  }

  if (!isAuthenticated) {
    // Sending them to /login is right here — they asked for an admin page — but
    // the storefront never routes anyone into this branch (§37).
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  if (capability && !can(capability)) {
    return (
      <div className="card">
        <div className="card-body">
          <div className="alert alert-warning">
            <span>⚠</span>
            <div>
              <strong>Not permitted.</strong> This page needs the <code>{capability}</code> permission.
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (requireSuperAdmin && !isSuperAdmin) {
    return (
      <div className="card">
        <div className="card-body">
          <div className="alert alert-warning">
            <span>⚠</span>
            <div>
              <strong>Super Admin only.</strong> Your account does not have permission to view this page.
            </div>
          </div>
        </div>
      </div>
    );
  }

  return children;
}
