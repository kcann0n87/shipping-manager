import { useState, useEffect } from 'react'

export default function LabelQueue({ queue, sender, packageDefaults, defaultServiceSpeed, labelResults, onLabelResults, onUpdateQueue, onRemove, onClearQueue, onShowPrint, onSaveHistory }) {
  const results = labelResults
  const setResults = onLabelResults
  const [generating, setGenerating] = useState(false)
  const [editingPkg, setEditingPkg] = useState(null) // order id being edited
  const [editingAddr, setEditingAddr] = useState(null) // order id being address-edited
  const [bulkPkg, setBulkPkg] = useState({
    length: packageDefaults.length,
    width: packageDefaults.width,
    height: packageDefaults.height,
    weight: packageDefaults.weight,
  })
  const [bulkApplied, setBulkApplied] = useState(false)
  const [bulkService, setBulkService] = useState(defaultServiceSpeed || 'USPS Priority Pitney Bowes V2')
  const [services, setServices] = useState(null)

  useEffect(() => {
    fetch('/api/services').then(r => r.json()).then(d => { if (d?.data) setServices(d.data) }).catch(() => {})
  }, [])

  const applyBulkService = () => {
    onUpdateQueue(prev => prev.map(o =>
      results[o.id] ? o : { ...o, serviceSpeed: bulkService }
    ))
    setBulkApplied(true)
    setTimeout(() => setBulkApplied(false), 1500)
  }

  const applyBulkPkg = () => {
    onUpdateQueue(prev => prev.map(o => {
      if (results[o.id]) return o // skip already-generated labels
      return {
        ...o,
        pkgLength: bulkPkg.length,
        pkgWidth: bulkPkg.width,
        pkgHeight: bulkPkg.height,
        pkgWeight: bulkPkg.weight,
      }
    }))
    setBulkApplied(true)
    setTimeout(() => setBulkApplied(false), 1500)
  }

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

  const updateOrderField = (orderId, field, value) => {
    onUpdateQueue(prev => prev.map(o =>
      o.id === orderId ? { ...o, [field]: value } : o
    ))
  }

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
          defaultServiceSpeed: defaultServiceSpeed || 'USPS Priority Pitney Bowes V2',
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
              serviceSpeed: o.serviceSpeed || undefined,
              recipient: {
                name: o.buyerName,
                company: o.company || '',
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
        const justGeneratedOrders = []
        for (const r of data.results) {
          const order = orders.find(o => o.orderNumber === r.orderNumber)
          if (order) {
            newResults[order.id] = r
            justGeneratedOrders.push(order)
          }
        }
        setResults(newResults)
        // Save batch to history (only the orders we just processed)
        if (onSaveHistory && justGeneratedOrders.length > 0) {
          // Build a results map for just these orders
          const batchResults = justGeneratedOrders.reduce((acc, o) => {
            acc[o.id] = newResults[o.id]
            return acc
          }, {})
          onSaveHistory(justGeneratedOrders, batchResults)
        }
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

        <div style={{
          background: 'var(--surface2)',
          borderRadius: 6,
          padding: '12px 14px',
          marginBottom: 14,
          display: 'flex',
          gap: 10,
          alignItems: 'flex-end',
          flexWrap: 'wrap',
        }}>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-dim)', alignSelf: 'center', marginRight: 6 }}>
            Bulk override:
          </div>
          <div className="form-group">
            <label style={{ fontSize: '0.7rem' }}>Length (in)</label>
            <input
              type="number"
              value={bulkPkg.length}
              onChange={e => setBulkPkg(p => ({ ...p, length: Number(e.target.value) }))}
              style={{ width: 70, padding: '5px 8px' }}
              min={1}
            />
          </div>
          <div className="form-group">
            <label style={{ fontSize: '0.7rem' }}>Width (in)</label>
            <input
              type="number"
              value={bulkPkg.width}
              onChange={e => setBulkPkg(p => ({ ...p, width: Number(e.target.value) }))}
              style={{ width: 70, padding: '5px 8px' }}
              min={1}
            />
          </div>
          <div className="form-group">
            <label style={{ fontSize: '0.7rem' }}>Height (in)</label>
            <input
              type="number"
              value={bulkPkg.height}
              onChange={e => setBulkPkg(p => ({ ...p, height: Number(e.target.value) }))}
              style={{ width: 70, padding: '5px 8px' }}
              min={1}
            />
          </div>
          <div className="form-group">
            <label style={{ fontSize: '0.7rem' }}>Weight (lbs)</label>
            <input
              type="number"
              value={bulkPkg.weight}
              onChange={e => setBulkPkg(p => ({ ...p, weight: Number(e.target.value) }))}
              style={{ width: 80, padding: '5px 8px' }}
              min={0.1}
              step={0.1}
            />
          </div>
          <button
            className="btn btn-primary btn-sm"
            onClick={applyBulkPkg}
            disabled={pendingCount === 0}
          >
            Apply Size to All Pending
          </button>
          <div style={{ flexBasis: '100%', height: 0 }} />
          <div style={{ fontSize: '0.8rem', color: 'var(--text-dim)', alignSelf: 'center', marginRight: 6 }}>
            Bulk service:
          </div>
          <div className="form-group" style={{ flex: 1, minWidth: 240 }}>
            <label style={{ fontSize: '0.7rem' }}>USPS Service</label>
            <select
              value={bulkService}
              onChange={e => setBulkService(e.target.value)}
              style={{ padding: '5px 8px', width: '100%' }}
            >
              {services
                ? Object.entries(services).sort(([a], [b]) => a.localeCompare(b)).map(([name, price]) => (
                    <option key={name} value={`USPS ${name}`}>
                      USPS {name} — ${price.toFixed(2)}
                    </option>
                  ))
                : <option value={bulkService}>{bulkService}</option>}
            </select>
          </div>
          <button
            className="btn btn-primary btn-sm"
            onClick={applyBulkService}
            disabled={pendingCount === 0}
          >
            Apply Service to All Pending
          </button>
          {bulkApplied && (
            <span style={{ color: 'var(--success)', fontSize: '0.8rem', alignSelf: 'center' }}>
              Applied!
            </span>
          )}
        </div>

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
                      <td>
                        <button
                          className="btn btn-ghost btn-sm"
                          onClick={() => setEditingAddr(editingAddr === order.id ? null : order.id)}
                          disabled={!!result}
                          style={{ textAlign: 'left', whiteSpace: 'nowrap' }}
                        >
                          {order.buyerName}{order.company ? ` / ${order.company}` : ''}<br/>
                          <span style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>
                            {order.street}{order.street2 ? `, ${order.street2}` : ''}, {order.city}, {order.state} {order.zip}
                          </span>
                        </button>
                      </td>
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
                    {editingAddr === order.id && !result && (
                      <tr key={`${order.id}-addr`}>
                        <td colSpan={8} style={{ background: 'var(--surface2)', padding: '12px 16px' }}>
                          <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end', flexWrap: 'wrap' }}>
                            <div className="form-group">
                              <label style={{ fontSize: '0.7rem' }}>Name</label>
                              <input
                                value={order.buyerName}
                                onChange={e => updateOrderField(order.id, 'buyerName', e.target.value)}
                                style={{ width: 160, padding: '5px 8px' }}
                              />
                            </div>
                            <div className="form-group">
                              <label style={{ fontSize: '0.7rem' }}>Business Name</label>
                              <input
                                value={order.company || ''}
                                onChange={e => updateOrderField(order.id, 'company', e.target.value)}
                                style={{ width: 160, padding: '5px 8px' }}
                                placeholder="Optional"
                              />
                            </div>
                            <div className="form-group">
                              <label style={{ fontSize: '0.7rem' }}>Address Line 1</label>
                              <input
                                value={order.street}
                                onChange={e => updateOrderField(order.id, 'street', e.target.value)}
                                style={{ width: 200, padding: '5px 8px' }}
                              />
                            </div>
                            <div className="form-group">
                              <label style={{ fontSize: '0.7rem' }}>Address Line 2</label>
                              <input
                                value={order.street2 || ''}
                                onChange={e => updateOrderField(order.id, 'street2', e.target.value)}
                                style={{ width: 140, padding: '5px 8px' }}
                                placeholder="Apt, Suite, etc."
                              />
                            </div>
                            <div className="form-group">
                              <label style={{ fontSize: '0.7rem' }}>City</label>
                              <input
                                value={order.city}
                                onChange={e => updateOrderField(order.id, 'city', e.target.value)}
                                style={{ width: 130, padding: '5px 8px' }}
                              />
                            </div>
                            <div className="form-group">
                              <label style={{ fontSize: '0.7rem' }}>State</label>
                              <input
                                value={order.state}
                                onChange={e => updateOrderField(order.id, 'state', e.target.value)}
                                style={{ width: 50, padding: '5px 8px' }}
                                maxLength={2}
                              />
                            </div>
                            <div className="form-group">
                              <label style={{ fontSize: '0.7rem' }}>Zip</label>
                              <input
                                value={order.zip}
                                onChange={e => updateOrderField(order.id, 'zip', e.target.value)}
                                style={{ width: 90, padding: '5px 8px' }}
                              />
                            </div>
                            <button className="btn btn-primary btn-sm" onClick={() => setEditingAddr(null)}>
                              Done
                            </button>
                          </div>
                        </td>
                      </tr>
                    )}
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
                            <div className="form-group" style={{ minWidth: 220 }}>
                              <label style={{ fontSize: '0.7rem' }}>USPS Service</label>
                              <select
                                value={order.serviceSpeed || defaultServiceSpeed || 'USPS Priority Pitney Bowes V2'}
                                onChange={e => updateOrderField(order.id, 'serviceSpeed', e.target.value)}
                                style={{ padding: '5px 8px', width: '100%' }}
                              >
                                {services
                                  ? Object.entries(services).sort(([a], [b]) => a.localeCompare(b)).map(([name, price]) => (
                                      <option key={name} value={`USPS ${name}`}>USPS {name} — ${price.toFixed(2)}</option>
                                    ))
                                  : <option value={order.serviceSpeed || defaultServiceSpeed}>{order.serviceSpeed || defaultServiceSpeed}</option>}
                              </select>
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
