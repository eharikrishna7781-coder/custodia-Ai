'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Navigation, MapPin, LocateFixed } from 'lucide-react';

export default function MapComponent({ userLocation, clinics, selectedClinic, trackingData }) {
  const mapRef = useRef(null);
  const mapInstance = useRef(null);
  const markersRef = useRef([]);
  const [isClient, setIsClient] = useState(false);
  const [isNavigating, setIsNavigating] = useState(false);
  const [mapError, setMapError] = useState(null);

  useEffect(() => { setIsClient(true); }, []);

  // Initialize map
  useEffect(() => {
    if (!isClient || !mapRef.current) return;

    try {
      delete L.Icon.Default.prototype._getIconUrl;
      L.Icon.Default.mergeOptions({
        iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
        iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
        shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
      });

      if (!mapInstance.current) {
        mapInstance.current = L.map(mapRef.current, {
          center: [userLocation.lat, userLocation.lng],
          zoom: 13,
          zoomControl: false,
        });
        L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
          attribution: '&copy; OpenStreetMap contributors &copy; CARTO',
          maxZoom: 19,
        }).addTo(mapInstance.current);
        L.control.zoom({ position: 'bottomright' }).addTo(mapInstance.current);
      }
    } catch (err) {
      console.error('Map initialization error:', err);
      setMapError('Failed to load map');
    }

    return () => {
      // Only cleanup on unmount, not on re-renders
    };
  }, [isClient]);

  // Update markers and view
  useEffect(() => {
    const map = mapInstance.current;
    if (!map) return;

    try {
      // Clear previous markers
      markersRef.current.forEach(marker => map.removeLayer(marker));
      markersRef.current = [];

      // User location marker with pulse effect
      const userIcon = L.divIcon({
        html: `<div style="position:relative;">
          <div style="position:absolute; top:50%; left:50%; transform:translate(-50%,-50%); width:28px; height:28px; background:rgba(13,148,136,0.2); border-radius:50%; animation:pulse-ring 2s ease-out infinite;"></div>
          <div style="background:#0D9488; width:16px; height:16px; border-radius:50%; border:3px solid white; box-shadow:0 2px 8px rgba(0,0,0,0.2); position:relative; z-index:1;"></div>
        </div>`,
        iconSize: [28, 28],
        iconAnchor: [14, 14],
        className: '',
      });
      const userMarker = L.marker([userLocation.lat, userLocation.lng], { icon: userIcon })
        .addTo(map)
        .bindPopup('<b>You are here</b>');
      markersRef.current.push(userMarker);

      // Clinic markers
      const clinicIcon = L.divIcon({
        html: `<div style="background:#3B82F6; width:18px; height:18px; border-radius:50%; border:2.5px solid white; box-shadow:0 2px 6px rgba(0,0,0,0.2); display:flex; align-items:center; justify-content:center;">
          <span style="color:white; font-size:10px; font-weight:bold;">+</span>
        </div>`,
        iconSize: [18, 18],
        iconAnchor: [9, 9],
        className: '',
      });

      const selectedClinicIcon = L.divIcon({
        html: `<div style="background:#0D9488; width:22px; height:22px; border-radius:50%; border:3px solid white; box-shadow:0 2px 10px rgba(13,148,136,0.4); display:flex; align-items:center; justify-content:center;">
          <span style="color:white; font-size:12px;">★</span>
        </div>`,
        iconSize: [22, 22],
        iconAnchor: [11, 11],
        className: '',
      });

      clinics?.forEach((c) => {
        const isSelected = selectedClinic?.id === c.id;
        const marker = L.marker([c.lat, c.lng], { icon: isSelected ? selectedClinicIcon : clinicIcon })
          .addTo(map)
          .bindPopup(`<div style="font-family:Inter,sans-serif; min-width:150px;">
            <b style="color:${isSelected ? '#0D9488' : '#3B82F6'}; font-size:14px;">${c.name}</b><br/>
            <span style="color:#64748B; font-size:12px;">${c.distance_km} km away</span><br/>
            <span style="color:#64748B; font-size:12px;">Stock: ${c.stock}%</span><br/>
            <span style="color:#64748B; font-size:12px;">${c.specialists} specialist(s)</span>
          </div>`);
        markersRef.current.push(marker);
      });

      // Route line when navigating
      if (selectedClinic && isNavigating) {
        const routeLine = L.polyline(
          [[userLocation.lat, userLocation.lng], [selectedClinic.lat, selectedClinic.lng]],
          { color: '#0D9488', weight: 4, opacity: 0.7, dashArray: '8,6', lineCap: 'round' }
        ).addTo(map);
        markersRef.current.push(routeLine);

        // Add distance label
        const midLat = (userLocation.lat + selectedClinic.lat) / 2;
        const midLng = (userLocation.lng + selectedClinic.lng) / 2;
        const distance = calculateDistance(userLocation.lat, userLocation.lng, selectedClinic.lat, selectedClinic.lng);
        const distanceIcon = L.divIcon({
          html: `<div style="background:#0D9488; color:white; padding:4px 10px; border-radius:12px; font-size:11px; font-weight:600; white-space:nowrap; box-shadow:0 2px 6px rgba(0,0,0,0.15);">${distance.toFixed(1)} km</div>`,
          iconSize: [60, 20],
          iconAnchor: [30, 10],
          className: '',
        });
        const distanceMarker = L.marker([midLat, midLng], { icon: distanceIcon }).addTo(map);
        markersRef.current.push(distanceMarker);
      }

      // Vehicle tracking marker
      if (trackingData?.vehicle_lat && trackingData?.vehicle_lng) {
        const vehicleIcon = L.divIcon({
          html: `<div style="position:relative;">
            <div style="position:absolute; top:50%; left:50%; transform:translate(-50%,-50%); width:24px; height:24px; background:rgba(245,158,11,0.3); border-radius:50%; animation:pulse-ring 1.5s ease-out infinite;"></div>
            <div style="background:#F59E0B; width:14px; height:14px; border-radius:50%; border:2.5px solid white; box-shadow:0 0 12px rgba(245,158,11,0.5); position:relative; z-index:1;"></div>
          </div>`,
          iconSize: [24, 24],
          iconAnchor: [12, 12],
          className: '',
        });
        const vehicleMarker = L.marker([trackingData.vehicle_lat, trackingData.vehicle_lng], { icon: vehicleIcon })
          .addTo(map)
          .bindPopup('<b>🚑 Vehicle</b><br/>En route to pickup');
        markersRef.current.push(vehicleMarker);
      }

      // Fit bounds to show all markers
      const group = L.featureGroup();
      markersRef.current.forEach(layer => {
        if (layer instanceof L.Marker || layer instanceof L.Polyline) {
          group.addLayer(layer);
        }
      });
      if (group.getLayers().length > 0) {
        map.fitBounds(group.getBounds(), { padding: [40, 40], maxZoom: 15 });
      }
    } catch (err) {
      console.error('Map update error:', err);
    }
  }, [clinics, selectedClinic, trackingData, userLocation, isNavigating]);

  const calculateDistance = (lat1, lng1, lat2, lng2) => {
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;
    const a = Math.sin(dLat/2) ** 2 + Math.cos(lat1 * Math.PI/180) * Math.cos(lat2 * Math.PI/180) * Math.sin(dLng/2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  };

  const recenterMap = useCallback(() => {
    const map = mapInstance.current;
    if (map) {
      map.setView([userLocation.lat, userLocation.lng], 14, { animate: true, duration: 0.5 });
    }
  }, [userLocation]);

  if (!isClient) {
    return (
      <div className="h-full w-full bg-slate-100 rounded-2xl flex items-center justify-center text-slate-400">
        <div className="flex flex-col items-center gap-2">
          <div className="w-8 h-8 border-3 border-slate-300 border-t-primary-600 rounded-full animate-spin" />
          <span className="text-sm">Loading map...</span>
        </div>
      </div>
    );
  }

  if (mapError) {
    return (
      <div className="h-full w-full bg-red-50 rounded-2xl flex items-center justify-center text-red-500">
        <div className="text-center">
          <MapPin className="w-8 h-8 mx-auto mb-2 opacity-50" />
          <p className="text-sm">{mapError}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative h-full w-full">
      <div ref={mapRef} className="h-full w-full min-h-[200px] rounded-2xl" />

      {/* Recenter button */}
      <button
        onClick={recenterMap}
        className="absolute top-3 right-3 z-[400] bg-white shadow-md rounded-xl p-2.5 text-slate-600 hover:bg-slate-50 transition-all border border-slate-200"
        title="Recenter to my location"
      >
        <LocateFixed size={18} />
      </button>

      {/* Navigation toggle */}
      {selectedClinic && (
        <button
          onClick={() => setIsNavigating(!isNavigating)}
          className={`absolute bottom-3 left-3 z-[400] shadow-md rounded-xl px-4 py-2.5 text-sm font-medium transition-all flex items-center gap-2 border ${
            isNavigating
              ? 'bg-primary-600 text-white border-primary-600'
              : 'bg-white text-primary-600 hover:bg-primary-50 border-slate-200'
          }`}
        >
          {isNavigating ? <Navigation size={16} /> : <MapPin size={16} />}
          {isNavigating ? 'Hide Route' : 'Show Route'}
        </button>
      )}

      {/* Clinic info overlay */}
      {selectedClinic && (
        <div className="absolute top-3 left-3 z-[400] bg-white/90 backdrop-blur-sm rounded-xl px-3 py-2 shadow-sm border border-slate-200 max-w-[200px]">
          <p className="text-xs font-semibold text-slate-800 truncate">{selectedClinic.name}</p>
          <p className="text-[10px] text-slate-500">{selectedClinic.distance_km} km · {selectedClinic.specialists} specialists</p>
        </div>
      )}
    </div>
  );
}
