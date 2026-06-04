import { useState, useEffect } from 'react'

const DEFAULT_SENDER = {
  name: '',
  street: '',
  street2: '',
  city: '',
  state: '',
  zip: '',
}

const DEFAULT_PACKAGE = {
  length: 12,
  width: 10,
  height: 6,
  weight: 2,
  description: 'Trading Cards',
}

export default function SenderSettings({ sender, onSave, packageDefaults, onSavePackage, defaultServiceSpeed, onSaveServiceSpeed }) {
  const [form, setForm] = useState(sender || DEFAULT_SENDER)
  const [pkgForm, setPkgForm] = useState(packageDefaults || DEFAULT_PACKAGE)
  const [saved, setSaved] = useState(false)
  const [pkgSaved, setPkgSaved] = useState(false)
  const [services, setServices] = useState(null) // { "Service Name": price }
  const [servicesError, setServicesError] = useState(null)
  const [svcSaved, setSvcSaved] = useState(false)

  useEffect(() => {
    fetch('/api/services')
      .then(r => r.json())
      .then(data => {
        if (data?.data) setServices(data.data)
        else setServicesError(data?.error || 'Could not load services')
      })
      .catch(err => setServicesError(err.message))
  }, [])

  useEffect(() => {
    if (sender) setForm(sender)
  }, [sender])

  useEffect(() => {
    if (packageDefaults) setPkgForm(packageDefaults)
  }, [packageDefaults])

  const update = (field, value) => setForm(prev => ({ ...prev, [field]: value }))
  const updatePkg = (field, value) => setPkgForm(prev => ({ ...prev, [field]: value }))

  const handleSave = () => {
    onSave(form)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const handleSavePkg = () => {
    onSavePackage(pkgForm)
    setPkgSaved(true)
    setTimeout(() => setPkgSaved(false), 2000)
  }

  return (
    <>
      <div className="card">
        <h2>Sender / Return Address</h2>
        <div className="form-grid">
          <div className="form-group full">
            <label>Full Name</label>
            <input value={form.name} onChange={e => update('name', e.target.value)} />
          </div>
          <div className="form-group full">
            <label>Street Address</label>
            <input value={form.street} onChange={e => update('street', e.target.value)} />
          </div>
          <div className="form-group full">
            <label>Address Line 2</label>
            <input value={form.street2 || ''} onChange={e => update('street2', e.target.value)} placeholder="Suite, Unit, etc." />
          </div>
          <div className="form-group">
            <label>City</label>
            <input value={form.city} onChange={e => update('city', e.target.value)} />
          </div>
          <div className="form-group">
            <label>State</label>
            <input value={form.state} onChange={e => update('state', e.target.value)} maxLength={2} />
          </div>
          <div className="form-group">
            <label>Zip Code</label>
            <input value={form.zip} onChange={e => update('zip', e.target.value)} />
          </div>
        </div>
        <div className="btn-row">
          <button className="btn btn-primary" onClick={handleSave}>
            Save Address
          </button>
          {saved && <span style={{ color: 'var(--success)', alignSelf: 'center', fontSize: '0.85rem' }}>Saved!</span>}
        </div>
      </div>

      <div className="card">
        <h2>Default Shipping Service</h2>
        <h3>Used for new labels unless overridden in the Label Queue</h3>
        {servicesError && (
          <div style={{ color: 'var(--danger)', fontSize: '0.85rem', marginBottom: 10 }}>
            Couldn't load services from ShipAway: {servicesError}
          </div>
        )}
        <div className="form-grid">
          <div className="form-group full">
            <label>USPS Service</label>
            <select
              value={defaultServiceSpeed || 'USPS Priority (9488 Series)'}
              onChange={e => {
                onSaveServiceSpeed(e.target.value)
                setSvcSaved(true)
                setTimeout(() => setSvcSaved(false), 1500)
              }}
            >
              {/* Show currently saved one even if API list hasn't loaded yet */}
              {(!services || !Object.keys(services).includes((defaultServiceSpeed || '').replace(/^USPS /, ''))) && defaultServiceSpeed && (
                <option value={defaultServiceSpeed}>{defaultServiceSpeed}</option>
              )}
              {services && Object.entries(services)
                .sort(([a], [b]) => a.localeCompare(b))
                .map(([name, price]) => (
                  <option key={name} value={`USPS ${name}`}>
                    USPS {name} — ${price.toFixed(2)}
                  </option>
                ))}
            </select>
          </div>
        </div>
        {svcSaved && <span style={{ color: 'var(--success)', fontSize: '0.85rem' }}>Saved!</span>}
      </div>

      <div className="card">
        <h2>Default Package Size</h2>
        <h3>Applied to all orders unless overridden in the Label Queue</h3>
        <div className="form-grid three-col">
          <div className="form-group">
            <label>Length (in)</label>
            <input type="number" value={pkgForm.length} onChange={e => updatePkg('length', Number(e.target.value))} min={1} />
          </div>
          <div className="form-group">
            <label>Width (in)</label>
            <input type="number" value={pkgForm.width} onChange={e => updatePkg('width', Number(e.target.value))} min={1} />
          </div>
          <div className="form-group">
            <label>Height (in)</label>
            <input type="number" value={pkgForm.height} onChange={e => updatePkg('height', Number(e.target.value))} min={1} />
          </div>
          <div className="form-group">
            <label>Weight (lbs)</label>
            <input type="number" value={pkgForm.weight} onChange={e => updatePkg('weight', Number(e.target.value))} min={0.1} step={0.1} />
          </div>
          <div className="form-group" style={{ gridColumn: 'span 2' }}>
            <label>Description</label>
            <input value={pkgForm.description} onChange={e => updatePkg('description', e.target.value)} />
          </div>
        </div>
        <div className="btn-row">
          <button className="btn btn-primary" onClick={handleSavePkg}>
            Save Package Defaults
          </button>
          {pkgSaved && <span style={{ color: 'var(--success)', alignSelf: 'center', fontSize: '0.85rem' }}>Saved!</span>}
        </div>
      </div>
    </>
  )
}

export { DEFAULT_SENDER, DEFAULT_PACKAGE }
