export default function Pagination({ pagination, onPage }) {
  if (!pagination) return null;
  const { page, limit, total, totalPages, hasNext, hasPrev } = pagination;
  if (total === 0) return null;

  const from = (page - 1) * limit + 1;
  const to = Math.min(page * limit, total);

  return (
    <div className="pagination">
      <span>
        Showing <strong>{from}</strong>–<strong>{to}</strong> of <strong>{total}</strong>
      </span>
      <span className="spacer" />
      <button className="btn btn-ghost btn-sm" disabled={!hasPrev} onClick={() => onPage(page - 1)}>
        ← Prev
      </button>
      <span className="small">
        Page {page} of {totalPages}
      </span>
      <button className="btn btn-ghost btn-sm" disabled={!hasNext} onClick={() => onPage(page + 1)}>
        Next →
      </button>
    </div>
  );
}
