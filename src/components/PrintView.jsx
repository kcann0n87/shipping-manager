import { useState } from 'react'
import { PDFDocument } from 'pdf-lib'

function base64ToBytes(b64) {
  const bin = atob(b64)
  const len = bin.length
  const bytes = new Uint8Array(len)
  for (let i = 0; i < len; i++) bytes[i] = bin.charCodeAt(i)
  return bytes
}

export default function PrintView({ queue, results, onClose }) {
  const [merging, setMerging] = useState(false)

  // Filter to only orders that have a generated PDF
  const labelsWithPdf = queue
    .map(order => ({ order, result: results[order.id] }))
    .filter(({ result }) => result?.data?.data?.label_pdf)

  const handlePrint = () => window.print()

  const handleDownloadCombined = async () => {
    if (labelsWithPdf.length === 0) return
    setMerging(true)
    try {
      const merged = await PDFDocument.create()
      for (const { result } of labelsWithPdf) {
        const bytes = base64ToBytes(result.data.data.label_pdf)
        const src = await PDFDocument.load(bytes)
        const pages = await merged.copyPages(src, src.getPageIndices())
        for (const p of pages) merged.addPage(p)
      }
      const out = await merged.save()
      const blob = new Blob([out], { type: 'application/pdf' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `shipping-labels-${new Date().toISOString().slice(0,10)}-${labelsWithPdf.length}.pdf`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch (err) {
      console.error('PDF merge failed:', err)
      alert('Failed to merge PDFs: ' + err.message)
    }
    setMerging(false)
  }

  const handleOpenCombined = async () => {
    if (labelsWithPdf.length === 0) return
    setMerging(true)
    try {
      const merged = await PDFDocument.create()
      for (const { result } of labelsWithPdf) {
        const bytes = base64ToBytes(result.data.data.label_pdf)
        const src = await PDFDocument.load(bytes)
        const pages = await merged.copyPages(src, src.getPageIndices())
        for (const p of pages) merged.addPage(p)
      }
      const out = await merged.save()
      const blob = new Blob([out], { type: 'application/pdf' })
      const url = URL.createObjectURL(blob)
      // Open in a new tab — user can use the browser's built-in print to print all pages at once
      window.open(url, '_blank')
      // Don't revoke immediately, let the new tab keep it
      setTimeout(() => URL.revokeObjectURL(url), 60000)
    } catch (err) {
      console.error('PDF merge failed:', err)
      alert('Failed to merge PDFs: ' + err.message)
    }
    setMerging(false)
  }

  return (
    <div className="print-overlay">
      <div className="close-print no-print">
        <button className="btn btn-ghost" onClick={onClose} style={{ marginRight: 8 }}>
          Close
        </button>
        <button
          className="btn btn-primary"
          onClick={handleOpenCombined}
          disabled={merging || labelsWithPdf.length === 0}
          style={{ marginRight: 8 }}
        >
          {merging ? 'Building PDF...' : `Print All ${labelsWithPdf.length} Labels (Combined PDF)`}
        </button>
        <button
          className="btn btn-success"
          onClick={handleDownloadCombined}
          disabled={merging || labelsWithPdf.length === 0}
          style={{ marginRight: 8 }}
        >
          Download Combined PDF
        </button>
        <button className="btn btn-ghost btn-sm" onClick={handlePrint}>
          Print Page Preview
        </button>
      </div>

      <div style={{ marginTop: 60 }}>
        {labelsWithPdf.length === 0 && (
          <div style={{ textAlign: 'center', padding: 40, color: '#666' }}>
            No labels with PDFs available. Generate labels first.
          </div>
        )}
        {labelsWithPdf.map(({ order, result }) => (
          <div key={order.id} style={{ marginBottom: 20, pageBreakAfter: 'always' }}>
            <div className="no-print" style={{ marginBottom: 8, fontSize: 12, color: '#666' }}>
              {order.orderNumber} — {order.buyerName} — {result.data.data.tracking}
            </div>
            <iframe
              src={`data:application/pdf;base64,${result.data.data.label_pdf}`}
              style={{ width: '100%', height: '700px', border: '1px solid #ccc' }}
              title={`Label for ${order.orderNumber}`}
            />
          </div>
        ))}
      </div>
    </div>
  )
}
