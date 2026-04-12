export default function PrintView({ queue, results, onClose }) {
  const handlePrint = () => window.print()

  // Filter to only orders that have a generated PDF
  const labelsWithPdf = queue
    .map(order => ({ order, result: results[order.id] }))
    .filter(({ result }) => result?.data?.data?.label_pdf)

  return (
    <div className="print-overlay">
      <div className="close-print no-print">
        <button className="btn btn-ghost" onClick={onClose} style={{ marginRight: 8 }}>
          Close
        </button>
        <button className="btn btn-primary" onClick={handlePrint}>
          Print {labelsWithPdf.length} Labels
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
