import { useState, useRef } from 'react'
import OrderTable from './OrderTable'

export default function AmazonOrders({ orders, onOrdersLoaded, selectedIds, onToggleSelect, onToggleAll, onAddToQueue }) {
  const [dragOver, setDragOver] = useState(false)
  const [fileNames, setFileNames] = useState([])
  const [parsing, setParsing] = useState(false)
  const [error, setError] = useState(null)
  const fileRef = useRef()

  const handleFiles = async (fileList) => {
    const files = Array.from(fileList || []).filter(f => f.name.toLowerCase().endsWith('.pdf'))
    if (files.length === 0) {
      setError('Please drop one or more PDF packing slips.')
      return
    }
    setError(null)
    setFileNames(files.map(f => f.name))
    setParsing(true)
    try {
      const formData = new FormData()
      for (const f of files) formData.append('files', f)
      const res = await fetch('/api/amazon/parse', { method: 'POST', body: formData })
      const data = await res.json()
      if (data.error) {
        setError(data.error)
      } else {
        // Merge with existing orders, deduping by id
        const existingIds = new Set(orders.map(o => o.id))
        const merged = [...orders, ...data.orders.filter(o => !existingIds.has(o.id))]
        onOrdersLoaded(merged)
        if (data.orders.length === 0) {
          setError('No orders could be parsed from the uploaded PDFs.')
        }
      }
    } catch (err) {
      setError(err.message)
    }
    setParsing(false)
  }

  const handleDrop = (e) => {
    e.preventDefault()
    setDragOver(false)
    handleFiles(e.dataTransfer.files)
  }

  const selectedOrders = orders.filter(o => selectedIds.has(o.id))

  return (
    <div>
      <div className="card">
        <h2>Amazon Orders</h2>
        <div
          className={`dropzone ${dragOver ? 'dragover' : ''}`}
          onDragOver={e => { e.preventDefault(); setDragOver(true) }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          onClick={() => fileRef.current?.click()}
        >
          <p>
            {parsing
              ? 'Parsing PDFs...'
              : fileNames.length > 0
                ? `Loaded: ${fileNames.join(', ')}`
                : 'Drop Amazon packing slip PDFs here or click to browse'}
          </p>
          <p className="hint">Download packing slips from Amazon Seller Central. Multiple PDFs supported.</p>
          <input
            ref={fileRef}
            type="file"
            accept=".pdf,application/pdf"
            multiple
            style={{ display: 'none' }}
            onChange={e => handleFiles(e.target.files)}
          />
        </div>
        {error && (
          <div style={{ color: 'var(--danger)', fontSize: '0.85rem', marginTop: 8 }}>{error}</div>
        )}
      </div>

      {orders.length > 0 && (
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h2>Parsed Orders ({orders.length})</h2>
            <div className="btn-row" style={{ margin: 0 }}>
              <button
                className="btn btn-primary btn-sm"
                disabled={selectedOrders.length === 0}
                onClick={() => onAddToQueue(selectedOrders)}
              >
                Add {selectedOrders.length} to Label Queue
              </button>
              <button
                className="btn btn-ghost btn-sm"
                onClick={() => { onOrdersLoaded([]); setFileNames([]) }}
              >
                Clear
              </button>
            </div>
          </div>
          <OrderTable
            orders={orders}
            selectedIds={selectedIds}
            onToggleSelect={onToggleSelect}
            onToggleAll={onToggleAll}
            source="amazon"
          />
        </div>
      )}
    </div>
  )
}
