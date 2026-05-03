import { useState } from 'react'

function formatDate(ts) {
  const d = new Date(ts)
  return d.toLocaleString(undefined, {
    year: 'numeric', month: 'short', day: 'numeric',
    hour: 'numeric', minute: '2-digit',
  })
}

function batchStats(batch) {
  const total = batch.orders.length
  let success = 0
  let error = 0
  const sources = {}
  for (const order of batch.orders) {
    const r = batch.results[order.id]
    if (r?.success) success++
    else error++
    sources[order.source] = (sources[order.source] || 0) + 1
  }
  return { total, success, error, sources }
}

function exportTrackingCSV(batch) {
  const rows = [['Order #', 'Tracking #', 'Carrier']]
  for (const order of batch.orders) {
    const r = batch.results[order.id]
    if (r?.data?.data?.tracking) {
      rows.push([order.orderNumber, r.data.data.tracking, 'USPS'])
    }
  }
  const csv = rows.map(r => r.map(v => `"${v}"`).join(',')).join('\n')
  const blob = new Blob([csv], { type: 'text/csv' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `tracking-${new Date(batch.timestamp).toISOString().slice(0,10)}-${batch.id.slice(-6)}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

export default function History({ history, onDelete, onClearAll, onReprint }) {
  const [expanded, setExpanded] = useState(null) // batch id

  if (history.length === 0) {
    return (
      <div className="card">
        <h2>History</h2>
        <div className="empty">
          No past batches yet. Once you generate labels in the Queue, they'll appear here.
        </div>
      </div>
    )
  }

  return (
    <div>
      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2>History ({history.length})</h2>
          <button className="btn btn-ghost btn-sm" onClick={() => {
            if (confirm('Delete ALL batch history? This cannot be undone.')) onClearAll()
          }}>
            Clear All
          </button>
        </div>
        <p className="hint" style={{ margin: '4px 0 0 0' }}>
          Last 20 batches are saved locally on this computer. Tracking numbers and address details persist; PDF labels can be reprinted.
        </p>
      </div>

      {history.map(batch => {
        const stats = batchStats(batch)
        const isExpanded = expanded === batch.id
        return (
          <div className="card" key={batch.id}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
              <div>
                <div style={{ fontSize: '1rem', fontWeight: 600 }}>
                  {formatDate(batch.timestamp)}
                </div>
                <div style={{ fontSize: '0.85rem', color: 'var(--text-dim)', marginTop: 2 }}>
                  {stats.total} label{stats.total !== 1 ? 's' : ''} •{' '}
                  <span style={{ color: 'var(--success)' }}>{stats.success} succeeded</span>
                  {stats.error > 0 && <> • <span style={{ color: 'var(--danger)' }}>{stats.error} errors</span></>}
                  {' • '}
                  {Object.entries(stats.sources).map(([src, n], i) => (
                    <span key={src}>{i > 0 ? ', ' : ''}{n} {src}</span>
                  ))}
                </div>
              </div>
              <div className="btn-row" style={{ margin: 0 }}>
                <button className="btn btn-ghost btn-sm" onClick={() => setExpanded(isExpanded ? null : batch.id)}>
                  {isExpanded ? 'Hide' : 'View'}
                </button>
                <button className="btn btn-success btn-sm" onClick={() => onReprint(batch)} disabled={stats.success === 0}>
                  Reprint
                </button>
                <button className="btn btn-ghost btn-sm" onClick={() => exportTrackingCSV(batch)} disabled={stats.success === 0}>
                  Export CSV
                </button>
                <button className="btn btn-ghost btn-sm" onClick={() => {
                  if (confirm('Delete this batch from history?')) onDelete(batch.id)
                }}>
                  Delete
                </button>
              </div>
            </div>

            {isExpanded && (
              <div className="table-wrap" style={{ marginTop: 12 }}>
                <table>
                  <thead>
                    <tr>
                      <th>Source</th>
                      <th>Order #</th>
                      <th>Recipient</th>
                      <th>Address</th>
                      <th>Status</th>
                      <th>Tracking</th>
                    </tr>
                  </thead>
                  <tbody>
                    {batch.orders.map(order => {
                      const r = batch.results[order.id]
                      const tracking = r?.data?.data?.tracking
                      return (
                        <tr key={order.id}>
                          <td>
                            <span className="status" style={{
                              background:
                                order.source === 'tcgplayer' ? 'rgba(108,140,255,0.15)' :
                                order.source === 'amazon' ? 'rgba(255,153,0,0.15)' :
                                'rgba(251,191,36,0.15)',
                              color:
                                order.source === 'tcgplayer' ? 'var(--accent)' :
                                order.source === 'amazon' ? '#ff9900' :
                                'var(--warning)'
                            }}>
                              {order.source === 'tcgplayer' ? 'TCG' : order.source === 'amazon' ? 'AMZ' : 'eBay'}
                            </span>
                          </td>
                          <td>{order.orderNumber}</td>
                          <td>
                            {order.buyerName}
                            {order.company && <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>{order.company}</div>}
                          </td>
                          <td style={{ fontSize: '0.8rem' }}>
                            {order.street}{order.street2 ? `, ${order.street2}` : ''}<br/>
                            {order.city}, {order.state} {order.zip}
                          </td>
                          <td>
                            {r?.success && <span className="status success">Generated</span>}
                            {r && !r.success && <span className="status error" title={r.error}>Error</span>}
                          </td>
                          <td style={{ fontSize: '0.8rem', fontFamily: 'monospace' }}>
                            {tracking ? (
                              <span
                                style={{ cursor: 'pointer', userSelect: 'all', padding: '2px 6px', borderRadius: 4, background: 'var(--surface2)' }}
                                title="Click to copy"
                                onClick={() => {
                                  navigator.clipboard.writeText(tracking)
                                  const el = document.getElementById(`hist-copied-${order.id}`)
                                  if (el) { el.style.opacity = 1; setTimeout(() => el.style.opacity = 0, 1500) }
                                }}
                              >
                                {tracking}
                              </span>
                            ) : '—'}
                            {tracking && (
                              <span id={`hist-copied-${order.id}`} style={{ marginLeft: 6, fontSize: '0.7rem', color: 'var(--success)', opacity: 0, transition: 'opacity 0.2s' }}>
                                Copied!
                              </span>
                            )}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
