import { useState, useRef } from 'react'
import Papa from 'papaparse'
import OrderTable from './OrderTable'

const COL_MAP = {
  orderNumber: ['order number', 'sales record number'],
  shipToName: ['ship to name', 'buyer name'],
  shipToPhone: ['ship to phone'],
  shipToAddress1: ['ship to address 1', 'buyer address 1'],
  shipToAddress2: ['ship to address 2', 'buyer address 2'],
  shipToCity: ['ship to city', 'buyer city'],
  shipToState: ['ship to state', 'buyer state'],
  shipToZip: ['ship to zip', 'buyer zip'],
  itemTitle: ['item title'],
  quantity: ['quantity'],
  soldFor: ['sold for'],
  trackingNumber: ['tracking number'],
}

function findColumn(headers, aliases) {
  const lower = headers.map(h => h.toLowerCase().trim())
  for (const alias of aliases) {
    const idx = lower.indexOf(alias)
    if (idx !== -1) return headers[idx]
  }
  return null
}

function parseEbayCSV(text) {
  // eBay CSVs have a blank first row and footer rows — clean them up
  const lines = text.split('\n')
  // Find the header row (the one with "Order Number" or "Sales Record Number")
  let headerIdx = -1
  for (let i = 0; i < Math.min(lines.length, 5); i++) {
    if (lines[i].toLowerCase().includes('order number') || lines[i].toLowerCase().includes('sales record')) {
      headerIdx = i
      break
    }
  }
  if (headerIdx === -1) headerIdx = 0

  // Find where data ends (look for footer like "X,record(s) downloaded")
  let endIdx = lines.length
  for (let i = headerIdx + 1; i < lines.length; i++) {
    if (lines[i].match(/^\d+,record\(s\)/i) || lines[i].match(/^Seller ID/i)) {
      endIdx = i
      break
    }
  }

  const cleanCSV = lines.slice(headerIdx, endIdx).join('\n')
  const result = Papa.parse(cleanCSV, { header: true, skipEmptyLines: true })

  if (result.errors.length) {
    console.warn('eBay CSV parse warnings:', result.errors)
  }

  const headers = result.meta.fields || []
  const mapping = {}
  for (const [field, aliases] of Object.entries(COL_MAP)) {
    mapping[field] = findColumn(headers, aliases)
  }

  const orders = []
  for (const row of result.data) {
    const orderNum = (mapping.orderNumber && row[mapping.orderNumber]) || ''
    const name = (mapping.shipToName && row[mapping.shipToName]) || ''

    // Skip empty/header rows
    if (!orderNum && !name) continue

    const street = (mapping.shipToAddress1 && row[mapping.shipToAddress1]) || ''
    const street2 = (mapping.shipToAddress2 && row[mapping.shipToAddress2]) || ''
    const city = (mapping.shipToCity && row[mapping.shipToCity]) || ''
    const state = (mapping.shipToState && row[mapping.shipToState]) || ''
    const zip = (mapping.shipToZip && row[mapping.shipToZip]) || ''

    // Skip rows with no address data
    if (!street && !city) continue

    const itemTitle = (mapping.itemTitle && row[mapping.itemTitle]) || ''
    const qty = (mapping.quantity && row[mapping.quantity]) || '1'
    const soldFor = (mapping.soldFor && row[mapping.soldFor]) || ''
    const phone = (mapping.shipToPhone && row[mapping.shipToPhone]) || ''
    const existingTracking = (mapping.trackingNumber && row[mapping.trackingNumber]) || ''

    orders.push({
      id: `ebay-${orderNum || `row-${orders.length}`}`,
      source: 'ebay',
      orderNumber: orderNum,
      buyerName: name,
      phone: phone.replace(/[^0-9]/g, ''),
      street,
      street2,
      city,
      state,
      zip,
      items: itemTitle ? `${itemTitle} x${qty}` : `${qty} item(s) — ${soldFor}`,
      existingTracking,
    })
  }

  return orders
}

export default function EbayOrders({ orders, onOrdersLoaded, selectedIds, onToggleSelect, onToggleAll, onAddToQueue }) {
  const [dragOver, setDragOver] = useState(false)
  const [fileName, setFileName] = useState(null)
  const fileRef = useRef()

  const handleFile = (file) => {
    if (!file) return
    setFileName(file.name)
    const reader = new FileReader()
    reader.onload = (e) => {
      const parsed = parseEbayCSV(e.target.result)
      onOrdersLoaded(parsed)
    }
    reader.readAsText(file)
  }

  const handleDrop = (e) => {
    e.preventDefault()
    setDragOver(false)
    const file = e.dataTransfer.files[0]
    handleFile(file)
  }

  const selectedOrders = orders.filter(o => selectedIds.has(o.id))

  return (
    <div>
      <div className="card">
        <h2>eBay Orders</h2>
        <div
          className={`dropzone ${dragOver ? 'dragover' : ''}`}
          onDragOver={e => { e.preventDefault(); setDragOver(true) }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          onClick={() => fileRef.current?.click()}
        >
          <p>{fileName ? `Loaded: ${fileName}` : 'Drop an eBay Orders CSV here or click to browse'}</p>
          <p className="hint">Supports eBay Seller Hub order export format</p>
          <input
            ref={fileRef}
            type="file"
            accept=".csv"
            style={{ display: 'none' }}
            onChange={e => handleFile(e.target.files[0])}
          />
        </div>
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
                onClick={() => { onOrdersLoaded([]); setFileName(null) }}
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
            source="ebay"
          />
        </div>
      )}
    </div>
  )
}
