"use client";
import { useEffect } from "react";
import { MapContainer, TileLayer, Polyline, CircleMarker, Marker, Tooltip, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { CITIES, type CityId } from "@/lib/content";
import { pos, type Bus } from "@/lib/bus";

const arc = (from: CityId, to: CityId) => Array.from({ length: 30 }, (_, i) => pos({ from, to, p: i / 29 }));

const busIcon = (on: boolean, label: string) => L.divIcon({
  className: "",
  html: `<div class="bus-pin${on ? " on" : ""}"><span></span><b>${label}</b></div>`,
  iconSize: [0, 0],
});

function Fly({ to }: { to: [number, number] | null }) {
  const map = useMap();
  useEffect(() => { if (to) map.flyTo(to, 9, { duration: 1.4 }); }, [to, map]);
  return null;
}

export default function TrackMap({ buses, active, dark, onPick, focus }: { buses: Bus[]; active: string; dark: boolean; onPick: (id: string) => void; focus: [number, number] | null }) {
  const tiles = dark ? "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png" : "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png";
  return (
    <MapContainer center={[18.95, -69.75]} zoom={8} scrollWheelZoom={false} className="tmap" attributionControl>
      <TileLayer key={tiles} url={tiles} attribution='&copy; OpenStreetMap &copy; CARTO' />
      {buses.map((b) => <Polyline key={"l" + b.id} positions={arc(b.from, b.to)} pathOptions={{ color: b.id === active ? "#ff6a47" : dark ? "#66d2e8" : "#13839c", weight: b.id === active ? 4 : 2, dashArray: b.id === active ? undefined : "6 8", opacity: 0.9 }} />)}
      {(Object.keys(CITIES) as CityId[]).map((c) => (
        <CircleMarker key={c} center={[CITIES[c].lat, CITIES[c].lng]} radius={c === "sdq" ? 8 : 5} pathOptions={{ color: dark ? "#e8f1ee" : "#0b2027", fillColor: c === "sdq" ? "#ff6a47" : dark ? "#071419" : "#fff", fillOpacity: 1, weight: 2 }}>
          <Tooltip direction="top" offset={[0, -6]}>{CITIES[c].name}</Tooltip>
        </CircleMarker>
      ))}
      {buses.map((b) => <Marker key={b.id} position={pos(b)} icon={busIcon(b.id === active, b.id)} eventHandlers={{ click: () => onPick(b.id) }} />)}
      <Fly to={focus} />
    </MapContainer>
  );
}
