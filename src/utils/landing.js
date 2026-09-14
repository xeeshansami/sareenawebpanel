/**
 * Where a signed-in staff account belongs (§37).
 *
 * One function, used by the login page, the post-login redirect and the catch-all
 * route, so there is a single answer rather than three that drift. Capability
 * based rather than role based: an approved Shop User whose shopkeeper granted
 * them reports lands on the dashboard, and one who only sells lands on the till.
 */
export function landingFor(user, caps) {
  if (!user) return '/login';

  // The platform owner has no shop of their own to open.
  if (user.isSuperAdmin) return '/platform';

  const can = (c) => Boolean(user.capabilities?.includes(c));

  if (can(caps.REPORT_VIEW)) return '/dashboard';
  if (can(caps.SALE_CREATE)) return '/sales';
  if (can(caps.ORDER_VIEW)) return '/orders';
  if (can(caps.INVENTORY_VIEW)) return '/inventory';
  if (can(caps.PRODUCT_VIEW)) return '/products';

  // Approved, but granted nothing that has a page. Settings always exists and
  // explains what they can and cannot do, which beats an empty dashboard.
  return '/settings';
}
