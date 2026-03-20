import { useState, useEffect, useCallback } from 'react';
import ToastContainer from './Toast.jsx';
import { useToast } from '../hooks/useToast.js';
import * as solidOps from '../utils/solid.js';
import * as mockOps from '../utils/mockStorage.js';
import MapView from './MapView.jsx';
import ListView from './ListView.jsx';
import AddEditPOIModal from './AddEditPOIModal.jsx';

const MOCK_MODE = import.meta.env.VITE_MOCK_MODE === 'true';
const ops = MOCK_MODE ? mockOps : solidOps;

export default function AppShell({ session, webId, onLogout }) {
  const { toasts, addToast, removeToast } = useToast();
  const [profile, setProfile] = useState(null);
  const [appRoot, setAppRoot] = useState(null);
  const [pois, setPois] = useState([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState('map');
  const [editingPOI, setEditingPOI] = useState(null);
  const [showAddEdit, setShowAddEdit] = useState(false);
  const [defaultCoords, setDefaultCoords] = useState(null);

  const loadPOIs = useCallback(async (root) => {
    try {
      const items = await ops.listContainer(root, session.fetch);
      const jsonItems = items.filter(i => !i.isFolder && i.name.endsWith('.json'));
      const loaded = await Promise.all(
        jsonItems.map(async (item) => {
          try {
            const resp = await session.fetch(item.url);
            if (!resp.ok) return null;
            return await resp.json();
          } catch { return null; }
        })
      );
      setPois(loaded.filter(Boolean));
    } catch (err) {
      console.error('Load POIs error:', err);
      addToast('Could not load points of interest.', 'error');
    }
  }, [session.fetch, addToast]);

  useEffect(() => {
    async function init() {
      try {
        const p = await ops.fetchProfile(webId, session.fetch);
        setProfile(p);
        const root = p.storageRoot + 'poi/';
        setAppRoot(root);
        try {
          const r = await session.fetch(root, { method: 'HEAD' });
          if (r.status === 404) await ops.createFolder(root, session.fetch);
        } catch {
          await ops.createFolder(root, session.fetch);
        }
        await ops.ensureOwnInboxAppendable(webId, session.fetch);
        await loadPOIs(root);
      } catch (err) {
        console.error('Init error:', err);
        addToast('Could not load. Check your pod connection.', 'error');
      } finally {
        setLoading(false);
      }
    }
    init();
  }, [webId]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSavePOI = useCallback(async (poi) => {
    const url = appRoot + poi.id + '.json';
    const blob = new Blob([JSON.stringify(poi, null, 2)], { type: 'application/json' });
    await ops.uploadFile(url, blob, session.fetch);
    await loadPOIs(appRoot);
    setShowAddEdit(false);
    addToast(editingPOI ? 'Point of interest updated.' : 'Point of interest added.', 'success');
  }, [appRoot, session.fetch, loadPOIs, editingPOI, addToast]);

  const handleDeletePOI = useCallback(async (poi) => {
    if (!window.confirm(`Delete "${poi.name}"?`)) return;
    try {
      await ops.deleteResource(appRoot + poi.id + '.json', session.fetch);
      setPois(prev => prev.filter(p => p.id !== poi.id));
      addToast('Point of interest deleted.', 'success');
    } catch (err) {
      console.error('Delete POI error:', err);
      addToast('Could not delete point of interest.', 'error');
    }
  }, [appRoot, session.fetch, addToast]);

  const handleMapClick = useCallback((lat, lng) => {
    setDefaultCoords({ lat, lng });
    setEditingPOI(null);
    setShowAddEdit(true);
  }, []);

  const handleEdit = useCallback((poi) => {
    setEditingPOI(poi);
    setDefaultCoords(null);
    setShowAddEdit(true);
  }, []);

  const handleAdd = useCallback(() => {
    setEditingPOI(null);
    setDefaultCoords(null);
    setShowAddEdit(true);
  }, []);

  const handleCloseModal = useCallback(() => {
    setShowAddEdit(false);
    setEditingPOI(null);
    setDefaultCoords(null);
  }, []);

  if (loading) {
    return (
      <div className="app-loading">
        <span className="spinner-lg" />
      </div>
    );
  }

  return (
    <div className="app-shell">
      {MOCK_MODE && (
        <div className="poi-mock-banner">
          Mock mode — data stored in browser localStorage only
        </div>
      )}
      <header className="app-shell-header">
        <div className="poi-header-left">
          <h1 className="app-shell-title">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ marginRight: 6, verticalAlign: 'middle' }}>
              <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
              <circle cx="12" cy="10" r="3" />
            </svg>
            {import.meta.env.VITE_APP_NAME || 'POI Manager'}
          </h1>
          <div className="poi-view-toggle">
            <button
              className={`poi-toggle-btn${view === 'map' ? ' active' : ''}`}
              onClick={() => setView('map')}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6" />
                <line x1="8" y1="2" x2="8" y2="18" />
                <line x1="16" y1="6" x2="16" y2="22" />
              </svg>
              Map
            </button>
            <button
              className={`poi-toggle-btn${view === 'list' ? ' active' : ''}`}
              onClick={() => setView('list')}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="8" y1="6" x2="21" y2="6" /><line x1="8" y1="12" x2="21" y2="12" /><line x1="8" y1="18" x2="21" y2="18" />
                <line x1="3" y1="6" x2="3.01" y2="6" /><line x1="3" y1="12" x2="3.01" y2="12" /><line x1="3" y1="18" x2="3.01" y2="18" />
              </svg>
              List
            </button>
          </div>
        </div>

        <div className="poi-header-right">
          <span className="poi-count-badge">{pois.length} POI{pois.length !== 1 ? 's' : ''}</span>
          <button className="btn-primary" onClick={handleAdd}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            Add POI
          </button>
          {profile?.name && <span className="app-shell-username">{profile.name}</span>}
          <button className="btn-outline" onClick={onLogout}>Sign out</button>
        </div>
      </header>

      <main className="poi-main">
        {view === 'map' ? (
          <MapView
            pois={pois}
            onMapClick={handleMapClick}
            onEdit={handleEdit}
            onDelete={handleDeletePOI}
          />
        ) : (
          <ListView
            pois={pois}
            onEdit={handleEdit}
            onDelete={handleDeletePOI}
            onAdd={handleAdd}
          />
        )}
      </main>

      {showAddEdit && (
        <AddEditPOIModal
          poi={editingPOI}
          defaultCoords={defaultCoords}
          onSave={handleSavePOI}
          onClose={handleCloseModal}
        />
      )}

      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </div>
  );
}
