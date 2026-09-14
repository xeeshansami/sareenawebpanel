export const currency = (n) =>
  new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(
    Number(n || 0)
  );

export const money = (n) =>
  n === null || n === undefined || n === '' ? '••••' : `Rs ${currency(n)}`;

export const number = (n) => new Intl.NumberFormat('en-US').format(Number(n || 0));

export const date = (d) =>
  d ? new Date(d).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }) : '—';

export const dateTime = (d) =>
  d
    ? new Date(d).toLocaleString('en-US', {
        year: 'numeric', month: 'short', day: 'numeric',
        hour: '2-digit', minute: '2-digit',
      })
    : '—';

export const initials = (first = '', last = '') =>
  `${(first[0] || '').toUpperCase()}${(last[0] || '').toUpperCase()}` || '?';

export const statusBadge = (status) => {
  const map = {
    paid: 'badge-green',
    received: 'badge-green',
    partial: 'badge-orange',
    pending: 'badge-orange',
    unpaid: 'badge-red',
    cancelled: 'badge-gray',
  };
  return map[status] || 'badge-gray';
};
