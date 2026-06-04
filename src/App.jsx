import { useState, useEffect, useCallback } from 'react'
import SenderSettings, { DEFAULT_SENDER, DEFAULT_PACKAGE } from './components/SenderSettings'
import TCGPlayerUpload from './components/TCGPlayerUpload'
import EbayOrders from './components/EbayOrders'
import AmazonOrders from './components/AmazonOrders'
import LabelQueue from './components/LabelQueue'
import PrintView from './components/PrintView'
import History from './components/History'

const TABS = [
  { id: 'tcgplayer', label: 'TCGPlayer' },
  { id: 'ebay', label: 'eBay' },
  { id: 'amazon', label: 'Amazon' },
  { id: 'queue', label: 'Label Queue' },
  { id: 'history', label: 'History' },
  { id: 'settings', label: 'Settings' },
]

const HISTORY_CAP = 20 // keep last 20 batches

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

  // Default USPS service speed
  const [defaultServiceSpeed, setDefaultServiceSpeed] = useState(() => {
    return localStorage.getItem('default_service_speed') || 'USPS Priority (9488 Series)'
  })

  const saveDefaultServiceSpeed = (val) => {
    setDefaultServiceSpeed(val)
    localStorage.setItem('default_service_speed', val)
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

  // History of past batches
  const [history, setHistory] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('label_history')) || []
    } catch {
      return []
    }
  })

  const saveHistoryBatch = useCallback((orders, results) => {
    // Only snapshot orders that produced a result
    const ordersWithResults = orders.filter(o => results[o.id])
    if (ordersWithResults.length === 0) return
    const batch = {
      id: `batch-${Date.now()}`,
      timestamp: Date.now(),
      orders: ordersWithResults,
      results: ordersWithResults.reduce((acc, o) => {
        acc[o.id] = results[o.id]
        return acc
      }, {}),
    }
    setHistory(prev => {
      const next = [batch, ...prev].slice(0, HISTORY_CAP)
      try {
        localStorage.setItem('label_history', JSON.stringify(next))
      } catch (err) {
        // localStorage full — drop oldest until it fits
        let trimmed = next
        while (trimmed.length > 1) {
          trimmed = trimmed.slice(0, -1)
          try {
            localStorage.setItem('label_history', JSON.stringify(trimmed))
            break
          } catch {}
        }
        return trimmed
      }
      return next
    })
  }, [])

  const deleteHistoryBatch = useCallback((batchId) => {
    setHistory(prev => {
      const next = prev.filter(b => b.id !== batchId)
      localStorage.setItem('label_history', JSON.stringify(next))
      return next
    })
  }, [])

  const clearHistory = useCallback(() => {
    setHistory([])
    localStorage.removeItem('label_history')
  }, [])

  // Print view (used both for current queue and for re-printing from history)
  const [showPrint, setShowPrint] = useState(false)
  const [printBatch, setPrintBatch] = useState(null) // null = use current queue, or { orders, results }

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
        <PrintView
          queue={printBatch ? printBatch.orders : queue}
          results={printBatch ? printBatch.results : labelResults}
          onClose={() => { setShowPrint(false); setPrintBatch(null) }}
        />
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
          defaultServiceSpeed={defaultServiceSpeed}
          labelResults={labelResults}
          onLabelResults={setLabelResults}
          onUpdateQueue={setQueue}
          onRemove={removeFromQueue}
          onClearQueue={() => { setQueue([]); setLabelResults({}) }}
          onShowPrint={() => { setPrintBatch(null); setShowPrint(true) }}
          onSaveHistory={saveHistoryBatch}
        />
      )}

      {activeTab === 'history' && (
        <History
          history={history}
          onDelete={deleteHistoryBatch}
          onClearAll={clearHistory}
          onReprint={(batch) => { setPrintBatch(batch); setShowPrint(true) }}
        />
      )}

      {activeTab === 'settings' && (
        <SenderSettings
          sender={sender}
          onSave={saveSender}
          packageDefaults={packageDefaults}
          onSavePackage={savePackageDefaults}
          defaultServiceSpeed={defaultServiceSpeed}
          onSaveServiceSpeed={saveDefaultServiceSpeed}
        />
      )}

      {toast && <div className="toast">{toast}</div>}
    </div>
  )
}
