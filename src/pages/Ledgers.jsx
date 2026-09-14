import { useEffect, useState } from 'react';
import api, { errorMessage, CAPS } from '../api/client.js';
import { useAuth } from '../context/AuthContext.jsx';
import ReadOnly from '../components/ReadOnly.jsx';
import Modal from '../components/Modal.jsx';
import { Loading, Empty, ErrorNote } from '../components/States.jsx';
import { money, date, dateTime } from '../utils/format.js';

export default function Ledgers() {
  // Taking a payment writes to the ledger; reading a statement does not.
  const { can } = useAuth();
  const canTakePayment = can(CAPS.SALE_PAY) || can(CAPS.PURCHASE_PAY);
  const [tab, setTab] = useState('customer');
  const [outstanding, setOutstanding] = useState(null);
  const [state, setState] = useState({ loading: true, error: '' });
  const [selected, setSelected] = useState(null);
  const [statement, setStatement] = useState(null);
  const [payFor, setPayFor] = useState(null);
  const [payAmount, setPayAmount] = useState('');
  const [payMethod, setPayMethod] = useState('cash');
  const [payNotes, setPayNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [payError, setPayError] = useState('');

  const load = async () => {
    setState({ loading: true, error: '' });
    try {
      const { data } = await api.get('/ledgers/outstanding');
      setOutstanding(data.data);
      setState({ loading: false, error: '' });
    } catch (err) {
      setState({ loading: false, error: errorMessage(err) });
    }
  };

  useEffect(() => { load(); }, []);

  const openStatement = async (partyType, party) => {
    setSelected({ partyType, party });
    setStatement(null);
    try {
      const { data } = await api.get(`/ledgers/${partyType}/${party._id}`);
      setStatement(data.data);
    } catch (err) { setStatement({ error: errorMessage(err) }); }
  };

  const submitPayment = async (e) => {
    e.preventDefault();
    const amount = Number(payAmount);
    if (!amount || amount <= 0) { setPayError('Enter an amount greater than zero.'); return; }
    setSaving(true); setPayError('');
    try {
      await api.post(`/ledgers/${payFor.partyType}/${payFor.party._id}/payment`, {
        amount, method: payMethod, notes: payNotes,
      });
      setPayFor(null); setPayAmount(''); setPayNotes('');
      load();
      if (selected) openStatement(selected.partyType, selected.party);
    } catch (err) { setPayError(errorMessage(err)); } finally { setSaving(false); }
  };

  if (state.loading) return <Loading label="Loading balances…" />;
  if (state.error) return <ErrorNote message={state.error} onRetry={load} />;

  const readOnlyNote = canTakePayment ? null : <ReadOnly what="Balances" />;

  const isCustomer = tab === 'customer';
  const bucket = isCustomer ? outstanding.receivables : outstanding.payables;

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Credit / Udhaar</h1>
          <div className="sub">
            What each customer owes, what you owe your suppliers, and every entry behind both
          </div>
        </div>
        <div className="page-head-actions">
          <div className="seg">
            <button aria-pressed={isCustomer} onClick={() => { setTab('customer'); setSelected(null); }}>
              Receivable {money(outstanding.receivables.total)}
            </button>
            <button aria-pressed={!isCustomer} onClick={() => { setTab('supplier'); setSelected(null); }}>
              Payable {money(outstanding.payables.total)}
            </button>
          </div>
        </div>
      </div>

      {readOnlyNote}

      {outstanding.overLimit?.length > 0 && isCustomer && (
        <div className="alert alert-warning">
          <span>⚠</span>
          <div>
            <strong>{outstanding.overLimit.length} customer{outstanding.overLimit.length === 1 ? ' is' : 's are'} over
            the agreed credit limit</strong> — {outstanding.overLimit.map((c) => c.name).join(', ')}
          </div>
        </div>
      )}

      <div className="grid grid-2">
        <div className="card">
          <div className="card-head">
            <h2>{isCustomer ? 'Customers who owe you' : 'Suppliers you owe'}</h2>
            <div className="actions small muted">{bucket.count} {bucket.count === 1 ? 'party' : 'parties'}</div>
          </div>
          {bucket.parties.length === 0 ? (
            <Empty icon="✓" title={isCustomer ? 'Nothing outstanding' : 'Nothing owed'}
                   hint="Every account is settled." />
          ) : (
            <div className="table-wrap">
              <table>
                <thead><tr><th>Name</th><th>Phone</th><th className="num">Balance</th><th /></tr></thead>
                <tbody>
                  {bucket.parties.map((p) => {
                    const over = isCustomer && p.creditLimit > 0 && p.balance > p.creditLimit;
                    return (
                      <tr key={p._id}>
                        <td>
                          <div className="strong">{p.name}</div>
                          {over && <span className="badge badge-red">over limit {money(p.creditLimit)}</span>}
                        </td>
                        <td className="muted">{p.phone || '—'}</td>
                        <td className="num strong" style={{ color: 'var(--warning)' }}>{money(p.balance)}</td>
                        <td className="actions-cell">
                          <button className="btn btn-ghost btn-sm" onClick={() => openStatement(tab, p)}>Statement</button>
                          {canTakePayment && (
                            <>
                              {' '}
                              <button className="btn btn-ghost btn-sm"
                                      onClick={() => { setPayFor({ partyType: tab, party: p }); setPayAmount(String(p.balance)); setPayError(''); }}>
                                {isCustomer ? 'Receive' : 'Pay'}
                              </button>
                            </>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="card">
          <div className="card-head">
            <h2>{selected ? `${selected.party.name} — statement` : 'Statement'}</h2>
          </div>
          {!selected ? (
            <Empty icon="☰" title="Pick a party" hint="Choose a name on the left to see its account history." />
          ) : !statement ? (
            <Loading label="Loading statement…" />
          ) : statement.error ? (
            <ErrorNote message={statement.error} />
          ) : (
            <>
              <div className="card-body" style={{ borderBottom: '1px solid var(--border)' }}>
                <div className="flex" style={{ justifyContent: 'space-between' }}>
                  <span className="muted">Current balance</span>
                  <span className="strong" style={{ fontSize: 18 }}>{money(statement.party.balance)}</span>
                </div>
                <div className="flex mt-2 small" style={{ justifyContent: 'space-between' }}>
                  <span className="muted">Total debit / credit</span>
                  <span>{money(statement.totals.debit)} / {money(statement.totals.credit)}</span>
                </div>
              </div>
              {statement.rows.length === 0 ? (
                <Empty icon="☰" title="No entries yet" />
              ) : (
                <div className="table-wrap" style={{ maxHeight: 420, overflowY: 'auto' }}>
                  <table>
                    <thead>
                      <tr><th>Date</th><th>Detail</th><th className="num">Debit</th>
                          <th className="num">Credit</th><th className="num">Balance</th></tr>
                    </thead>
                    <tbody>
                      {statement.rows.map((r) => (
                        <tr key={r._id}>
                          <td className="muted small nowrap">{date(r.date)}</td>
                          <td>
                            <div>{r.description}</div>
                            {r.reference && <div className="small muted mono">{r.reference}</div>}
                          </td>
                          <td className="num">{r.debit ? money(r.debit) : '—'}</td>
                          <td className="num">{r.credit ? money(r.credit) : '—'}</td>
                          <td className="num strong">{money(r.balanceAfter)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      <Modal
        open={Boolean(payFor)}
        title={payFor?.partyType === 'customer' ? `Receive from ${payFor?.party.name}` : `Pay ${payFor?.party.name}`}
        onClose={() => setPayFor(null)}
        footer={
          <>
            <button className="btn btn-ghost" onClick={() => setPayFor(null)} disabled={saving}>Cancel</button>
            <button className="btn btn-primary" onClick={submitPayment} disabled={saving}>
              {saving ? <><span className="spinner" /> Saving…</> : 'Record'}
            </button>
          </>
        }
      >
        <form onSubmit={submitPayment}>
          {payError && <div className="alert alert-error"><span>⚠</span><div>{payError}</div></div>}
          <div className="alert alert-info">
            <span>ℹ</span>
            <div>Current balance: <strong>{money(payFor?.party.balance)}</strong>. This is a payment on account,
            not tied to one invoice.</div>
          </div>
          <div className="field">
            <label>Amount *</label>
            <input type="number" step="0.01" min="0" value={payAmount}
                   onChange={(e) => setPayAmount(e.target.value)} autoFocus />
          </div>
          <div className="field">
            <label>Method</label>
            <select value={payMethod} onChange={(e) => setPayMethod(e.target.value)}>
              <option value="cash">Cash</option><option value="bank">Bank transfer</option>
              <option value="card">Card</option><option value="wallet">Mobile wallet</option>
            </select>
          </div>
          <div className="field">
            <label>Note</label>
            <input value={payNotes} onChange={(e) => setPayNotes(e.target.value)} placeholder="Optional reference" />
          </div>
        </form>
      </Modal>
    </>
  );
}
