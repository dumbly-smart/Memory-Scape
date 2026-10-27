'use client';

import { useEffect } from 'react';
import L from 'leaflet';
import { Marker, useMap } from 'react-leaflet';

type Point = [latitude: number, longitude: number];

const currentLocationIcon = L.divIcon({
  className: 'current-location-marker',
  html: '<span></span>',
  iconSize: [24, 24],
  iconAnchor: [12, 12],
});

export function CurrentLocationLayer({ position, request, onCentered }: {
  position: Point | null;
  request: number;
  onCentered: () => void;
}) {
  const map = useMap();

  useEffect(() => {
    if (!position) return;
    const target = L.latLng(position[0], position[1]);
    if (map.getCenter().distanceTo(target) < 18 && map.getZoom() >= 15) {
      onCentered();
      return;
    }
    const finish = () => onCentered();
    map.once('moveend', finish);
    map.flyTo(position, Math.max(16, map.getZoom()), { duration: 0.75 });
    return () => { map.off('moveend', finish); };
  }, [map, onCentered, position, request]);

  return position
    ? <Marker position={position} icon={currentLocationIcon} keyboard title="Your current location" />
    : null;
}
