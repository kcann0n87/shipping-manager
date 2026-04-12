import { useState, useRef } from 'react'
import Papa from 'papaparse'
import OrderTable from './OrderTable'

// Common TCGPlayer CSV column name mappings
const COL_MAP = {
  orderNumber: ['order #', 'order number', 'order', 'ordernumber', 'order_number', 'orderid', 'order id'],
  firstName: ['firstname', 'first name', 'first_name'],
  lastName: ['lastname', 'last name', 'last_name'],
  buyerName: ['buyer name', 'buyername', 'buyer', 'name', 'recipient', 'ship to name', 'full name'],
  street: ['address1', 'address 1', 'address', 'street', 'ship to address', 'shipping address', 'street address', 'address line 1'],
  street2: ['address2', 'address 2', 'address line 2', 'apt', 'suite', 'unit'],
  city: ['city', 'ship to city', 'shipping city'],
  state: ['state', 'ship to state', 'shipping state', 'province', 'region'],
  zip: ['postalcode', 'postal code', 'zip', 'zipcode', 'zip code', 'postal', 'ship to zip', 'shipping zip'],
  items: ['product name', 'item', 'items', 'product', 'title', 'description', 'product line'],
  itemCount: ['item count', 'itemcount', 'item_count'],
  quantity: ['quantity', 'qty'],
  value: ['value of products', 'value', 'total', 'order total'],
  shippingMethod: ['shipping method', 'ship method'],
}

function findColumn(headers, aliases) {
  const lower = headers.map(h => h.toLowerCase().trim())
  for (const alias of aliases) {
    const idx = lower.indexOf(alias)
    if (idx !== -1) return headers[idx]
  }
  return null
}

function parseCSV(text) {
  const result = Papa.parse(text, { header: true, skipEmptyLines: true })
  if (result.errors.length) {
    console.warn('CSV parse warnings:', result.errors)
  }

  const headers = result.meta.fields || []
  const mapping = {}
  for (const [field, aliases] of Object.entries(COL_MAP)) {
    mapping[field] = findColumn(headers, aliases)
  }

  // Group rows by order number so multi-item orders become one row
  const orderMap = new Map()
  let counter = 0

  for (const row of result.data) {
    const orderNum = (mapping.orderNumber && row[mapping.orderNumber]) || `ROW-${++counter}`

    // Build buyer name: prefer combined FirstName+LastName, fall back to single buyerName column
    let buyerName = ''
    const first = (mapping.firstName && row[mapping.firstName]) || ''
    const last = (mapping.lastName && row[mapping.lastName]) || ''
    if (first || last) {
      buyerName = `${first} ${last}`.trim()
    } else {
      buyerName = (mapping.buyerName && row[mapping.buyerName]) || ''
    }

    // Keep Address1 and Address2 separate for shipping API
    let street = (mapping.street && row[mapping.street]) || ''
    const street2 = (mapping.street2 && row[mapping.street2]) || ''

    if (!orderMap.has(orderNum)) {
      orderMap.set(orderNum, {
        id: `tcg-${orderNum}`,
        source: 'tcgplayer',
        orderNumber: orderNum,
        buyerName,
        street,
        street2,
        city: (mapping.city && row[mapping.city]) || '',
        state: (mapping.state && row[mapping.state]) || '',
        zip: (mapping.zip && row[mapping.zip]) || '',
        items: '',
        itemList: [],
        itemCount: (mapping.itemCount && row[mapping.itemCount]) || '',
        value: (mapping.value && row[mapping.value]) || '',
        shippingMethod: (mapping.shippingMethod && row[mapping.shippingMethod]) || '',
      })
    }

    const item = (mapping.items && row[mapping.items]) || ''
    const qty = (mapping.quantity && row[mapping.quantity]) || '1'
    if (item) {
      orderMap.get(orderNum).itemList.push(`${item} x${qty}`)
    }
  }

  // Flatten item lists; if no product names, show item count + value
  for (const order of orderMap.values()) {
    if (order.itemList.length > 0) {
      order.items = order.itemList.join(', ')
    } else if (order.itemCount) {
      order.items = `${order.itemCount} item(s) — $${order.value}`
    }
    delete order.itemList
  }

  return Array.from(orderMap.values())
}

export default function TCGPlayerUpload({ orders, onOrdersLoaded, selectedIds, onToggleSelect, onToggleAll, onAddToQueue }) {
  const [dragOver, setDragOver] = useState(false)
  const [fileName, setFileName] = useState(null)
  const fileRef = useRef()

  const handleFile = (file) => {
    if (!file) return
    setFileName(file.name)
    const reader = new FileReader()
    reader.onload = (e) => {
      const parsed = parseCSV(e.target.result)
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
        <h2>TCGPlayer Orders</h2>
        <div
          className={`dropzone ${dragOver ? 'dragover' : ''}`}
          onDragOver={e => { e.preventDefault(); setDragOver(true) }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          onClick={() => fileRef.current?.click()}
        >
          <p>{fileName ? `Loaded: ${fileName}` : 'Drop a TCGPlayer CSV here or click to browse'}</p>
          <p className="hint">Supports standard TCGPlayer export format</p>
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
            source="tcgplayer"
          />
        </div>
      )}
    </div>
  )
}
