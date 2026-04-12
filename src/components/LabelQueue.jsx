import { useState } from 'react'

export default function LabelQueue({ queue, sender, packageDefaults, labelResults, onLabelResults, onUpdateQueue, onRemove, onClearQueue, onShowPrint }) {
  const results = labelResults
  const setResults = onLabelResults
  const [generating, setGenerating] = useState(false)
  const [editingPkg, setEditingPkg] = useState(null) // order id being edited

  const pendingCount = queue.filter(o => !results[o.id]).length
  const successCount = Object.values(results).filter(r => r.success).length
  const errorCount = Object.values(results).filter(r => !r.success).length

  const exportTrackingCSV = () => {
    const rows = [['Order #', 'Tracking #', 'Carrier']]
    for (const order of queue) {
      const result = results[order.id]
      if (result?.data?.data?.tracking) {
        rows.push([order.orderNumber, result.data.data.tracking, 'USPS'])
      }
    }
    const csv = rows.map(r => r.map(v => `"${v}"`).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `tcgplayer-tracking-${new Date().toISOString().slice(0,10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  // Get effective package for an order (per-order override or defaults)
  const getPkg = (order) => ({
    length: order.pkgLength ?? packageDefaults.length,
    width: order.pkgWidth ?? packageDefaults.width,
    height: order.pkgHeight ?? packageDefaults.height,
    weight: order.pkgWeight ?? packageDefaults.weight,
    description: order.pkgDescription ?? packageDefaults.description,
  })

  const updateOrderPkg = (orderId, field, value) => {
    onUpdateQueue(prev => prev.map(o =>
      o.id === orderId ? { ...o, [field]: value } : o
    ))
  }

  const resetOrderPkg = (orderId) => {
    onUpdateQueue(prev => prev.map(o => {
      if (o.id !== orderId) return o
      const { pkgLength, pkgWidth, pkgHeight, pkgWeight, pkgDescription, ...rest } = o
      return rest
    }))
    setEditingPkg(null)
  }

  const generateLabels = async () => {
    setGenerating(true)
    const orders = queue.filter(o => !results[o.id])

    try {
      const res = await fetch('/api/labels/batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sender: {
            name: sender.name,
            street: sender.street2 ? `${sender.street}, ${sender.street2}` : sender.street,
            city: sender.city,
            state: sender.state,
            zip: sender.zip,
          },
          orders: orders.map(o => {
            const pkg = getPkg(o)
            return {
              orderNumber: o.orderNumber,
              recipient: {
                name: o.buyerName,
                street: o.street,
                street2: o.street2 || '',
                city: o.city,
                state: o.state,
                zip: o.zip,
              },
              package: pkg,
            }
          }),
        }),
      })

      const data = await res.json()
      if (data.results) {
        const newResults = { ...results }
        for (const r of data.results) {
          const order = orders.find(o => o.orderNumber === r.orderNumber)
          if (order) {
            newResults[order.id] = r
          }
        }
        setResults(newResults)
      }
    } catch (err) {
      console.error('Label generation failed:', err)
      const newResults = { ...results }
      for (const o of orders) {
        newResults[o.id] = { success: false, error: err.message }
      }
      setResults(newResults)
    }

    setGenerating(false)
  }

  if (queue.length === 0) {
    return (
      <div className="card">
        <h2>Label Queue</h2>
        <div className="empty">
          No orders in queue. Select orders from TCGPlayer or eBay tabs and add them here.
        </div>
      </div>
    )
  }

  return (
    <div>
      <div className="card">
        <h2>Label Queue</h2>
        <div className="queue-summary">
          <div className="queue-stat">
            <span className="num">{queue.length}</span>
            <span className="label">Total</span>
          </div>
          <div className="queue-stat">
            <span className="num">{pendingCount}</span>
            <span className="label">Pending</span>
          </div>
          <div className="queue-stat">
            <span className="num" style={{ color: 'var(--success)' }}>{successCount}</span>
            <span className="label">Generated</span>
          </div>
          {errorCount > 0 && (
            <div className="queue-stat">
              <span className="num" style={{ color: 'var(--danger)' }}>{errorCount}</span>
              <span className="label">Errors</span>
            </div>
          )}
          <div className="queue-stat" style={{ marginLeft: 'auto', textAlign: 'right' }}>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>
              Default: {packageDefaults.length}x{packageDefaults.width}x{packageDefaults.height}in, {packageDefaults.weight}lb
            </span>
          </div>
        </div>

        <div className="btn-row">
          <button
            className="btn btn-primary"
            disabled={generating || pendingCount === 0}
            onClick={generateLabels}
          >
            {generating ? 'Generating...' : `Generate ${pendingCount} Labels`}
          </button>
          {successCount > 0 && (
            <>
              <button className="btn btn-success" onClick={onShowPrint}>
                Print {successCount} Labels
              </button>
              <button className="btn btn-ghost" onClick={exportTrackingCSV}>
                Export TCG Tracking CSV
              </button>
            </>
          )}
          <button className="btn btn-ghost" onClick={() => { onClearQueue(); setResults({}) }}>
            Clear Queue
          </button>
        </div>
      </div>

      <div className="card">
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Source</th>
                <th>Order #</th>
                <th>Buyer</th>
                <th>Ship To</th>
                <th>Package</th>
                <th>Status</th>
                <th>Tracking</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {queue.map(order => {
                const result = results[order.id]
                const pkg = getPkg(order)
                const hasOverride = order.pkgLength != null || order.pkgWidth != null || order.pkgHeight != null || order.pkgWeight != null
                const isEditing = editingPkg === order.id

                return (
                  <>
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
                      <td>{order.buyerName}</td>
                      <td>{order.city}, {order.state} {order.zip}</td>
                      <td>
                        <button
                          className="btn btn-ghost btn-sm"
                          onClick={() => setEditingPkg(isEditing ? null : order.id)}
                          style={hasOverride ? { borderColor: 'var(--accent)', color: 'var(--accent)' } : {}}
                          disabled={!!result}
                        >
                          {pkg.length}x{pkg.width}x{pkg.height}, {pkg.weight}lb
                          {hasOverride ? ' *' : ''}
                        </button>
                      </td>
                      <td>
                        {!result && !generating && <span className="status pending">Pending</span>}
                        {result?.success && <span className="status success">Generated</span>}
                        {result && !result.success && (
                          <span className="status error" title={result.error}>Error</span>
                        )}
                        {generating && !result && <span className="status generating">Generating...</span>}
                      </td>
                      <td style={{ fontSize: '0.8rem', fontFamily: 'monospace' }}>
                        {result?.data?.data?.tracking ? (
                          <span
                            style={{ cursor: 'pointer', userSelect: 'all', padding: '2px 6px', borderRadius: 4, background: 'var(--surface2)' }}
                            title="Click to copy"
                            onClick={() => {
                              navigator.clipboard.writeText(result.data.data.tracking)
                              const el = document.getElementById(`copied-${order.id}`)
                              if (el) { el.style.opacity = 1; setTimeout(() => el.style.opacity = 0, 1500) }
                            }}
                          >
                            {result.data.data.tracking}
                          </span>
                        ) : '—'}
                        {result?.data?.data?.tracking && (
                          <span id={`copied-${order.id}`} style={{ marginLeft: 6, fontSize: '0.7rem', color: 'var(--success)', opacity: 0, transition: 'opacity 0.2s' }}>
                            Copied!
                          </span>
                        )}
                      </td>
                      <td>
                        <button
                          className="btn btn-ghost btn-sm"
                          onClick={() => { onRemove(order.id); setResults(prev => { const n = {...prev}; delete n[order.id]; return n }) }}
                        >
                          Remove
                        </button>
                      </td>
                    </tr>
                    {isEditing && (
                      <tr key={`${order.id}-pkg`}>
                        <td colSpan={8} style={{ background: 'var(--surface2)', padding: '12px 16px' }}>
                          <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end', flexWrap: 'wrap' }}>
                            <div className="form-group">
                              <label style={{ fontSize: '0.7rem' }}>Length (in)</label>
                              <input
                                type="number"
                                value={pkg.length}
                                onChange={e => updateOrderPkg(order.id, 'pkgLength', Number(e.target.value))}
                                style={{ width: 70, padding: '5px 8px' }}
                                min={1}
                              />
                            </div>
                            <div className="form-group">
                              <label style={{ fontSize: '0.7rem' }}>Width (in)</label>
                              <input
                                type="number"
                                value={pkg.width}
                                onChange={e => updateOrderPkg(order.id, 'pkgWidth', Number(e.target.value))}
                                style={{ width: 70, padding: '5px 8px' }}
                                min={1}
                              />
                            </div>
                            <div className="form-group">
                              <label style={{ fontSize: '0.7rem' }}>Height (in)</label>
                              <input
                                type="number"
                                value={pkg.height}
                                onChange={e => updateOrderPkg(order.id, 'pkgHeight', Number(e.target.value))}
                                style={{ width: 70, padding: '5px 8px' }}
                                min={1}
                              />
                            </div>
                            <div className="form-group">
                              <label style={{ fontSize: '0.7rem' }}>Weight (lbs)</label>
                              <input
                                type="number"
                                value={pkg.weight}
                                onChange={e => updateOrderPkg(order.id, 'pkgWeight', Number(e.target.value))}
                                style={{ width: 80, padding: '5px 8px' }}
                                min={0.1}
                                step={0.1}
                              />
                            </div>
                            <div className="form-group">
                              <label style={{ fontSize: '0.7rem' }}>Description</label>
                              <input
                                value={pkg.description}
                                onChange={e => updateOrderPkg(order.id, 'pkgDescription', e.target.value)}
                                style={{ width: 140, padding: '5px 8px' }}
                              />
                            </div>
                            {hasOverride && (
                              <button className="btn btn-ghost btn-sm" onClick={() => resetOrderPkg(order.id)}>
                                Reset to Default
                              </button>
                            )}
                            <button className="btn btn-primary btn-sm" onClick={() => setEditingPkg(null)}>
                              Done
                            </button>
                          </div>
                        </td>
                      </tr>
                    )}
                  </>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
