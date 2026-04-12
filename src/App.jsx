import { useState, useEffect, useCallback } from 'react'
import SenderSettings, { DEFAULT_SENDER, DEFAULT_PACKAGE } from './components/SenderSettings'
import TCGPlayerUpload from './components/TCGPlayerUpload'
import EbayOrders from './components/EbayOrders'
import AmazonOrders from './components/AmazonOrders'
import LabelQueue from './components/LabelQueue'
import PrintView from './components/PrintView'

const TABS = [
  { id: 'tcgplayer', label: 'TCGPlayer' },
  { id: 'ebay', label: 'eBay' },
  { id: 'amazon', label: 'Amazon' },
  { id: 'queue', label: 'Label Queue' },
  { id: 'settings', label: 'Settings' },
]

export default function App() {
  const [activeTab, setActiveTab] = useState('tcgplayer')
  const [sender, setSender] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('sender_address')) || DEFAULT_SENDER
    } catch {
      return DEFAULT_SENDER
    }
  })

  // Package defaults
  const [packageDefaults, setPackageDefaults] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('package_defaults')) || DEFAULT_PACKAGE
    } catch {
      return DEFAULT_PACKAGE
    }
  })

  const savePackageDefaults = (data) => {
    setPackageDefaults(data)
    localStorage.setItem('package_defaults', JSON.stringify(data))
  }

  // Orders by source
  const [tcgOrders, setTcgOrders] = useState([])
  const [ebayOrders, setEbayOrders] = useState([])
  const [amazonOrders, setAmazonOrders] = useState([])

  // Selection state (shared set of order IDs)
  const [selectedIds, setSelectedIds] = useState(new Set())

  // Label queue
  const [queue, setQueue] = useState([])

  // Label results (keyed by order id)
  const [labelResults, setLabelResults] = useState({})

  // Print view
  const [showPrint, setShowPrint] = useState(false)

  // Toast
  const [toast, setToast] = useState(null)

  const showToast = (msg) => {
    setToast(msg)
    setTimeout(() => setToast(null), 3000)
  }

  const saveSender = (data) => {
    setSender(data)
    localStorage.setItem('sender_address', JSON.stringify(data))
  }

  const toggleSelect = useCallback((id) => {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  const toggleAll = useCallback((orders) => {
    setSelectedIds(prev => {
      const allSelected = orders.every(o => prev.has(o.id))
      const next = new Set(prev)
      if (allSelected) {
        orders.forEach(o => next.delete(o.id))
      } else {
        orders.forEach(o => next.add(o.id))
      }
      return next
    })
  }, [])

  const addToQueue = (orders) => {
    const existingIds = new Set(queue.map(o => o.id))
    const newOrders = orders.filter(o => !existingIds.has(o.id))
    if (newOrders.length === 0) {
      showToast('All selected orders are already in the queue.')
      return
    }
    setQueue(prev => [...prev, ...newOrders])
    setSelectedIds(new Set())
    showToast(`Added ${newOrders.length} order(s) to label queue.`)
    setActiveTab('queue')
  }

  const removeFromQueue = (id) => {
    setQueue(prev => prev.filter(o => o.id !== id))
  }

  const queueCount = queue.length

  return (
    <div className="app">
      {showPrint && (
        <PrintView queue={queue} results={labelResults} onClose={() => setShowPrint(false)} />
      )}

      <header>
        <h1>Shipping Label Manager</h1>
        <span className="badge">ShipAway.io</span>
      </header>

      <div className="tabs">
        {TABS.map(tab => (
          <button
            key={tab.id}
            className={`tab ${activeTab === tab.id ? 'active' : ''}`}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label}
            {tab.id === 'queue' && queueCount > 0 && (
              <span style={{
                marginLeft: 6,
                background: 'var(--accent)',
                color: '#fff',
                borderRadius: 10,
                padding: '1px 7px',
                fontSize: '0.7rem',
              }}>
                {queueCount}
              </span>
            )}
          </button>
        ))}
      </div>

      {activeTab === 'tcgplayer' && (
        <TCGPlayerUpload
          orders={tcgOrders}
          onOrdersLoaded={setTcgOrders}
          selectedIds={selectedIds}
          onToggleSelect={toggleSelect}
          onToggleAll={toggleAll}
          onAddToQueue={addToQueue}
        />
      )}

      {activeTab === 'ebay' && (
        <EbayOrders
          orders={ebayOrders}
          onOrdersLoaded={setEbayOrders}
          selectedIds={selectedIds}
          onToggleSelect={toggleSelect}
          onToggleAll={toggleAll}
          onAddToQueue={addToQueue}
        />
      )}

      {activeTab === 'amazon' && (
        <AmazonOrders
          orders={amazonOrders}
          onOrdersLoaded={setAmazonOrders}
          selectedIds={selectedIds}
          onToggleSelect={toggleSelect}
          onToggleAll={toggleAll}
          onAddToQueue={addToQueue}
        />
      )}

      {activeTab === 'queue' && (
        <LabelQueue
          queue={queue}
          sender={sender}
          packageDefaults={packageDefaults}
          labelResults={labelResults}
          onLabelResults={setLabelResults}
          onUpdateQueue={setQueue}
          onRemove={removeFromQueue}
          onClearQueue={() => { setQueue([]); setLabelResults({}) }}
          onShowPrint={() => setShowPrint(true)}
        />
      )}

      {activeTab === 'settings' && (
        <SenderSettings
          sender={sender}
          onSave={saveSender}
          packageDefaults={packageDefaults}
          onSavePackage={savePackageDefaults}
        />
      )}

      {toast && <div className="toast">{toast}</div>}
    </div>
  )
}
