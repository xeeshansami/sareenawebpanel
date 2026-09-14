import { useAuth } from '../context/AuthContext.jsx';

/**
 * Says plainly why a page has no buttons.
 *
 * Two different people see this, and the wording matters to both:
 *
 *   The Super Admin, who can read every shop but operate none of them. §11 and
 *   §39 put products, stock, sales and purchases with the shopkeeper, so the
 *   platform owner monitors. That is deliberate, and a bare page with no
 *   explanation reads like a bug.
 *
 *   A Shop User whose shopkeeper granted them viewing but not changing. They
 *   should know it is a permission, not a fault, and who to ask.
 */
export default function ReadOnly({ what = 'these records', children }) {
  const { isSuperAdmin } = useAuth();

  return (
    <div className="alert alert-info">
      <span>👁</span>
      <div style={{ flex: 1 }}>
        {isSuperAdmin ? (
          <>
            <strong>Viewing only.</strong> {what} belong to the shop, and the shopkeeper manages
            them. You can see everything here and change nothing — which is how ownership of the
            numbers stays clear.
          </>
        ) : (
          <>
            <strong>Viewing only.</strong> You can see {what} but not change them. Ask the
            shopkeeper if you need to.
          </>
        )}
        {children}
      </div>
    </div>
  );
}
