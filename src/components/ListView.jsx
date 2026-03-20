import { useState } from 'react';

const CATEGORY_META = {
  landmark:   { label: 'Landmark',   color: '#1A73E8', bg: '#E8F0FE' },
  restaurant: { label: 'Restaurant', color: '#EA4335', bg: '#FCE8E6' },
  park:       { label: 'Park',       color: '#34A853', bg: '#E6F4EA' },
  shop:       { label: 'Shop',       color: '#c9a100', bg: '#FEF9E5' },
  other:      { label: 'Other',      color: '#5F6368', bg: '#F1F3F4' },
};

export default function ListView({ pois, onEdit, onDelete, onAdd }) {
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState('name');
  const [filterCat, setFilterCat] = useState('all');

  const filtered = pois
    .filter(p => filterCat === 'all' || p.category === filterCat)
    .filter(p => {
      if (!search) return true;
      const q = search.toLowerCase();
      return (
        p.name.toLowerCase().includes(q) ||
        (p.description || '').toLowerCase().includes(q) ||
        (p.notes || '').toLowerCase().includes(q)
      );
    })
    .sort((a, b) => {
      if (sortBy === 'category') return (a.category || '').localeCompare(b.category || '');
      if (sortBy === 'date') {
        return new Date(b.modified || b.created || 0) - new Date(a.modified || a.created || 0);
      }
      return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
    });

  return (
    <div className="poi-list-view">
      <div className="poi-list-toolbar">
        <div className="poi-search-wrap">
          <svg className="poi-search-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            className="poi-search"
            placeholder="Search POIs…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <select className="poi-select" value={filterCat} onChange={e => setFilterCat(e.target.value)}>
          <option value="all">All categories</option>
          {Object.entries(CATEGORY_META).map(([k, v]) => (
            <option key={k} value={k}>{v.label}</option>
          ))}
        </select>
        <select className="poi-select" value={sortBy} onChange={e => setSortBy(e.target.value)}>
          <option value="name">Name</option>
          <option value="category">Category</option>
          <option value="date">Newest</option>
        </select>
        {pois.length > 0 && (
          <span className="poi-toolbar-count">
            {filtered.length} of {pois.length}
          </span>
        )}
      </div>

      {pois.length === 0 ? (
        <div className="poi-empty">
          <svg width="52" height="52" viewBox="0 0 24 24" fill="none" stroke="var(--sd-border)" strokeWidth="1.2">
            <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
            <circle cx="12" cy="10" r="3" />
          </svg>
          <p>No points of interest yet.</p>
          <button className="btn-primary" onClick={onAdd}>Add your first POI</button>
        </div>
      ) : filtered.length === 0 ? (
        <div className="poi-empty">
          <p>No results match your search.</p>
          <button className="btn-outline" onClick={() => { setSearch(''); setFilterCat('all'); }}>
            Clear filters
          </button>
        </div>
      ) : (
        <div className="poi-card-grid">
          {filtered.map(poi => {
            const meta = CATEGORY_META[poi.category] || CATEGORY_META.other;
            return (
              <div key={poi.id} className="poi-card">
                <div className="poi-card-top">
                  <span className="poi-card-name">{poi.name}</span>
                  <span
                    className="poi-card-badge"
                    style={{ color: meta.color, background: meta.bg }}
                  >
                    {meta.label}
                  </span>
                </div>
                {poi.description && (
                  <p className="poi-card-desc">{poi.description}</p>
                )}
                <div className="poi-card-coords">
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                    <circle cx="12" cy="10" r="3" />
                  </svg>
                  {poi.lat?.toFixed(5)}, {poi.lng?.toFixed(5)}
                </div>
                {poi.notes && (
                  <p className="poi-card-notes">{poi.notes}</p>
                )}
                <div className="poi-card-actions">
                  <button className="btn-outline poi-card-btn" onClick={() => onEdit(poi)}>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                    </svg>
                    Edit
                  </button>
                  <button className="btn-outline poi-card-btn poi-card-btn-danger" onClick={() => onDelete(poi)}>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <polyline points="3 6 5 6 21 6" />
                      <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                      <path d="M10 11v6M14 11v6" />
                      <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
                    </svg>
                    Delete
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
