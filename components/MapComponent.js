'use client';

import { useEffect, useState, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Navigation, MapPin } from 'lucide-react';

export default function MapComponent({ userLocation, clinics, selectedClinic, trackingData }) {
  const mapRef = useRef(null);
  const mapInstance = useRef(null);
  const [isClient, setIsClient] = useState(false);
  const [isNavigating, setIsNavigating] = useState(false);

  useEffect(() => { setIsClient(true); }, []);

  useEffect(() => {
    if (!isClient) return;
    delete L.Icon.Default.prototype._getIconUrl;
    L.Icon.Default.mergeOptions({
      iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
      iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
      shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
    });

    if (!mapInstance.current && mapRef.current) {
      mapInstance.current = L.map(mapRef.current, {
        center: [userLocation.lat, userLocation.lng],
        zoom: 13,
        zoomControl: false,
      });
      L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
        attribution: '&copy; OpenStreetMap',
      }).addTo(mapInstance.current);
    }
    return () => {
      if (mapInstance.current) {
        mapInstance.current.remove();
        mapInstance.current = null;
      }
    };
  }, [isClient, userLocation]);

  useEffect(() => {
    const map = mapInstance.current;
    if (!map) return;

    map.eachLayer((layer) => {
      if (layer instanceof L.Marker || layer instanceof L.Polyline) {
        map.removeLayer(layer);
      }
    });

    const userIcon = L.divIcon({
      html: `<div style="background:#0D9488; width:18px; height:18px; border-radius:50%; border:3px solid white; box-shadow:0 2px 8px rgba(0,0,0,0.2);"></div>`,
      iconSize: [18, 18],
      iconAnchor: [9, 9],
    });
    L.marker([userLocation.lat, userLocation.lng], { icon: userIcon }).addTo(map).bindPopup('You');

    const clinicIcon = L.divIcon({
      html: `<div style="background:#3B82F6; width:16px; height:16px; border-radius:50%; border:2px solid white; box-shadow:0 2px 6px rgba(0,0,0,0.15);"></div>`,
      iconSize: [16, 16],
      iconAnchor: [8, 8],
    });
    clinics?.forEach((c) => {
      L.marker([c.lat, c.lng], { icon: clinicIcon }).addTo(map).bindPopup(`<b>${c.name}</b><br>${c.distance_km} km · ${c.stock}% stock`);
    });

    if (selectedClinic && isNavigating) {
      L.polyline([[userLocation.lat, userLocation.lng], [selectedClinic.lat, selectedClinic.lng]], {
        color: '#0D9488', weight: 3, opacity: 0.6, dashArray: '6,5',
      }).addTo(map);
    }

    if (trackingData) {
      const vehicleIcon = L.divIcon({
        html: `<div style="background:#F59E0B; width:14px; height:14px; border-radius:50%; border:2px solid white; box-shadow:0 0 12px rgba(245,158,11,0.5);"></div>`,
        iconSize: [14, 14],
        iconAnchor: [7, 7],
      });
      L.marker([trackingData.vehicle_lat, trackingData.vehicle_lng], { icon: vehicleIcon }).addTo(map).bindPopup('Vehicle');
    }

    const group = L.featureGroup();
    map.eachLayer((layer) => { if (layer instanceof L.Marker || layer instanceof L.Polyline) group.addLayer(layer); });
    if (group.getLayers().length > 0) map.fitBounds(group.getBounds(), { padding: [30, 30] });
  }, [clinics, selectedClinic, trackingData, userLocation, isNavigating]);

  if (!isClient) return <div className="h-full w-full bg-slate-100 rounded-2xl flex items-center justify-center text-slate-400">Loading map...</div>;

  return (
    <div className="relative h-full w-full">
      <div ref={mapRef} className="h-full w-full min-h-[200px]" />
      {selectedClinic && (
        <button
          onClick={() => setIsNavigating(!isNavigating)}
          className="absolute bottom-3 left-3 z-10 bg-white shadow-md rounded-xl px-4 py-2 text-sm font-medium text-primary-600 hover:bg-primary-50 transition-all flex items-center gap-2 border border-slate-200"
        >
          {isNavigating ? <Navigation size={16} /> : <MapPin size={16} />}
          {isNavigating ? 'Hide Directions' : 'Start Navigation'}
        </button>
      )}
    </div>
  );
}