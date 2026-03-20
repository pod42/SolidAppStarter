import { useEffect, useRef } from 'react';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

// Fix Leaflet default icon paths for Vite bundler
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

const CATEGORY_COLORS = {
  landmark:   '#1A73E8',
  restaurant: '#EA4335',
  park:       '#34A853',
  shop:       '#F9A825',
  other:      '#9E9E9E',
};

function makePinIcon(category) {
  const color = CATEGORY_COLORS[category] || CATEGORY_COLORS.other;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 28 40" width="28" height="40">
    <path d="M14 0C6.268 0 0 6.268 0 14c0 10.5 14 26 14 26s14-15.5 14-26C28 6.268 21.732 0 14 0z"
      fill="${color}" stroke="rgba(0,0,0,0.3)" stroke-width="1"/>
    <circle cx="14" cy="14" r="6" fill="rgba(255,255,255,0.92)"/>
  </svg>`;
  return L.divIcon({
    html: svg,
    className: '',
    iconSize: [28, 40],
    iconAnchor: [14, 40],
    popupAnchor: [0, -42],
  });
}

function escapeHtml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export default function MapView({ pois, onMapClick, onEdit, onDelete }) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const markersRef = useRef([]);
  // Use refs so Leaflet handlers always call the latest callbacks
  const onMapClickRef = useRef(onMapClick);
  const onEditRef = useRef(onEdit);
  const onDeleteRef = useRef(onDelete);

  useEffect(() => { onMapClickRef.current = onMapClick; }, [onMapClick]);
  useEffect(() => { onEditRef.current = onEdit; }, [onEdit]);
  useEffect(() => { onDeleteRef.current = onDelete; }, [onDelete]);

  // Initialise map once
  useEffect(() => {
    if (mapRef.current) return;
    const map = L.map(containerRef.current, { center: [20, 0], zoom: 2 });
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      maxZoom: 19,
    }).addTo(map);
    map.on('click', (e) => onMapClickRef.current(e.latlng.lat, e.latlng.lng));
    mapRef.current = map;
    // Ensure correct size after React layout pass
    requestAnimationFrame(() => { if (mapRef.current) mapRef.current.invalidateSize(); });
    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // Re-render markers whenever pois change
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    markersRef.current.forEach(m => m.remove());
    markersRef.current = [];

    const validPOIs = pois.filter(p => p.lat != null && p.lng != null);
    validPOIs.forEach(poi => {
      const marker = L.marker([poi.lat, poi.lng], { icon: makePinIcon(poi.category) });
      const catClass = `poi-popup-cat-${escapeHtml(poi.category || 'other')}`;
      const popupHtml = `
        <div class="poi-popup">
          <div class="poi-popup-top">
            <strong class="poi-popup-name">${escapeHtml(poi.name)}</strong>
            ${poi.category
              ? `<span class="poi-popup-cat ${catClass}">${escapeHtml(poi.category)}</span>`
              : ''}
          </div>
          ${poi.description
            ? `<p class="poi-popup-desc">${escapeHtml(poi.description)}</p>`
            : ''}
          <div class="poi-popup-coords">${poi.lat.toFixed(6)}, ${poi.lng.toFixed(6)}</div>
          <div class="poi-popup-actions">
            <button class="poi-popup-btn poi-popup-edit" data-id="${escapeHtml(poi.id)}">Edit</button>
            <button class="poi-popup-btn poi-popup-del"  data-id="${escapeHtml(poi.id)}">Delete</button>
          </div>
        </div>`;

      marker.bindPopup(L.popup({ maxWidth: 280 }).setContent(popupHtml));
      marker.on('popupopen', () => {
        const eid = CSS.escape(poi.id);
        document.querySelector(`.poi-popup-edit[data-id="${eid}"]`)
          ?.addEventListener('click', (e) => {
            e.stopPropagation();
            map.closePopup();
            onEditRef.current(poi);
          });
        document.querySelector(`.poi-popup-del[data-id="${eid}"]`)
          ?.addEventListener('click', (e) => {
            e.stopPropagation();
            map.closePopup();
            onDeleteRef.current(poi);
          });
      });

      marker.addTo(map);
      markersRef.current.push(marker);
    });

    // Fit map to show all markers
    if (validPOIs.length === 1) {
      map.setView([validPOIs[0].lat, validPOIs[0].lng], 13);
    } else if (validPOIs.length > 1) {
      map.fitBounds(
        L.latLngBounds(validPOIs.map(p => [p.lat, p.lng])),
        { padding: [48, 48], maxZoom: 14 }
      );
    }
  }, [pois]);

  return (
    <div className="poi-map-wrapper">
      <div ref={containerRef} className="poi-map" />
      {pois.length === 0 && (
        <div className="poi-map-hint">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
            <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
            <circle cx="12" cy="10" r="3" />
          </svg>
          Click anywhere on the map to add a point of interest
        </div>
      )}
    </div>
  );
}
