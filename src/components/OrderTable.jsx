export default function OrderTable({ orders, selectedIds, onToggleSelect, onToggleAll, source }) {
  if (!orders.length) {
    return <div className="empty">No orders loaded. {source === 'tcgplayer' ? 'Upload a CSV to get started.' : 'Connect your account to fetch orders.'}</div>
  }

  const allSelected = orders.length > 0 && orders.every(o => selectedIds.has(o.id))

  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>
              <input type="checkbox" checked={allSelected} onChange={() => onToggleAll(orders)} />
            </th>
            <th>Order #</th>
            <th>Buyer</th>
            <th>Address</th>
            <th>Line 2</th>
            <th>City</th>
            <th>State</th>
            <th>Zip</th>
            <th>Items</th>
          </tr>
        </thead>
        <tbody>
          {orders.map(order => (
            <tr key={order.id}>
              <td>
                <input
                  type="checkbox"
                  checked={selectedIds.has(order.id)}
                  onChange={() => onToggleSelect(order.id)}
                />
              </td>
              <td>{order.orderNumber}</td>
              <td>{order.buyerName}</td>
              <td>{order.street}</td>
              <td>{order.street2 || ''}</td>
              <td>{order.city}</td>
              <td>{order.state}</td>
              <td>{order.zip}</td>
              <td style={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {order.items}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
