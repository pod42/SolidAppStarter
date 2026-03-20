import { useState } from 'react';
import Modal from './Modal.jsx';

const CATEGORIES = [
  { value: 'landmark',   label: 'Landmark' },
  { value: 'restaurant', label: 'Restaurant' },
  { value: 'park',       label: 'Park' },
  { value: 'shop',       label: 'Shop' },
  { value: 'other',      label: 'Other' },
];

export default function AddEditPOIModal({ poi, defaultCoords, onSave, onClose }) {
  const isEdit = Boolean(poi);
  const [name, setName]               = useState(poi?.name ?? '');
  const [category, setCategory]       = useState(poi?.category ?? 'landmark');
  const [lat, setLat]                 = useState(
    poi?.lat != null         ? String(poi.lat)
    : defaultCoords?.lat != null ? defaultCoords.lat.toFixed(7)
    : ''
  );
  const [lng, setLng]                 = useState(
    poi?.lng != null         ? String(poi.lng)
    : defaultCoords?.lng != null ? defaultCoords.lng.toFixed(7)
    : ''
  );
  const [description, setDescription] = useState(poi?.description ?? '');
  const [notes, setNotes]             = useState(poi?.notes ?? '');
  const [gpsLoading, setGpsLoading]   = useState(false);
  const [saving, setSaving]           = useState(false);
  const [error, setError]             = useState('');

  const handleGPS = () => {
    if (!navigator.geolocation) {
      setError('Geolocation is not supported by your browser.');
      return;
    }
    setGpsLoading(true);
    setError('');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLat(pos.coords.latitude.toFixed(7));
        setLng(pos.coords.longitude.toFixed(7));
        setGpsLoading(false);
      },
      (err) => {
        setError('Could not get location: ' + err.message);
        setGpsLoading(false);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    const latNum = parseFloat(lat);
    const lngNum = parseFloat(lng);
    if (!name.trim())                               { setError('Name is required.'); return; }
    if (!lat || isNaN(latNum) || latNum < -90  || latNum > 90)  { setError('Enter a valid latitude (−90 to 90).'); return; }
    if (!lng || isNaN(lngNum) || lngNum < -180 || lngNum > 180) { setError('Enter a valid longitude (−180 to 180).'); return; }

    setSaving(true);
    const now = new Date().toISOString();
    try {
      await onSave({
        id:          poi?.id ?? crypto.randomUUID(),
        name:        name.trim(),
        category,
        lat:         latNum,
        lng:         lngNum,
        description: description.trim(),
        notes:       notes.trim(),
        created:     poi?.created ?? now,
        modified:    now,
      });
    } catch (err) {
      console.error('Save POI error:', err);
      setError('Could not save. Please try again.');
      setSaving(false);
    }
  };

  return (
    <Modal
      isOpen
      title={isEdit ? 'Edit Point of Interest' : 'Add Point of Interest'}
      onClose={onClose}
      size="md"
    >
      <form className="poi-form" onSubmit={handleSubmit}>
        {error && <p className="poi-form-error">{error}</p>}

        <div className="poi-form-field">
          <label className="poi-form-label">
            Name <span className="poi-required">*</span>
          </label>
          <input
            className="login-input"
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="e.g. Eiffel Tower"
            maxLength={100}
            autoFocus
          />
        </div>

        <div className="poi-form-field">
          <label className="poi-form-label">Category</label>
          <select
            className="login-input poi-select-input"
            value={category}
            onChange={e => setCategory(e.target.value)}
          >
            {CATEGORIES.map(c => (
              <option key={c.value} value={c.value}>{c.label}</option>
            ))}
          </select>
        </div>

        <div className="poi-coords-row">
          <div className="poi-form-field">
            <label className="poi-form-label">
              Latitude <span className="poi-required">*</span>
            </label>
            <input
              className="login-input"
              type="number"
              step="any"
              min="-90"
              max="90"
              value={lat}
              onChange={e => setLat(e.target.value)}
              placeholder="e.g. 48.8584"
            />
          </div>
          <div className="poi-form-field">
            <label className="poi-form-label">
              Longitude <span className="poi-required">*</span>
            </label>
            <input
              className="login-input"
              type="number"
              step="any"
              min="-180"
              max="180"
              value={lng}
              onChange={e => setLng(e.target.value)}
              placeholder="e.g. 2.2945"
            />
          </div>
        </div>

        <button
          type="button"
          className="poi-gps-btn"
          onClick={handleGPS}
          disabled={gpsLoading}
        >
          {gpsLoading ? (
            <><span className="spinner-sm" />Getting location…</>
          ) : (
            <>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="3" />
                <path d="M12 2v3M12 19v3M2 12h3M19 12h3" />
              </svg>
              Use my current location
            </>
          )}
        </button>

        <div className="poi-form-field">
          <label className="poi-form-label">Description</label>
          <input
            className="login-input"
            value={description}
            onChange={e => setDescription(e.target.value)}
            placeholder="Short description (optional)"
            maxLength={200}
          />
        </div>

        <div className="poi-form-field">
          <label className="poi-form-label">Notes</label>
          <textarea
            className="login-input poi-textarea"
            value={notes}
            onChange={e => setNotes(e.target.value)}
            placeholder="Additional notes… (optional)"
            rows={3}
            maxLength={500}
          />
        </div>

        <div className="poi-form-actions">
          <button type="button" className="btn-outline" onClick={onClose} disabled={saving}>
            Cancel
          </button>
          <button type="submit" className="btn-primary" disabled={saving}>
            {saving
              ? <><span className="spinner-sm" />Saving…</>
              : isEdit ? 'Save changes' : 'Add POI'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
