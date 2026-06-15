import { useEffect, useMemo, useRef, useState } from "react";
import { MapContainer, TileLayer, CircleMarker, Popup, useMap } from "react-leaflet";
import { CATS, catColor, catLabel, type CatKey, type Place } from "./osm";

function FlyTo({ target }: { target: { lat: number; lon: number; key: number } | null }) {
  const map = useMap();
  useEffect(() => {
    if (target) map.setView([target.lat, target.lon], 16, { animate: true });
  }, [target, map]);
  return null;
}

export default function MapView({ places }: { places: Place[] }) {
  const [active, setActive] = useState<Set<CatKey>>(new Set(CATS.map((c) => c.key)));
  const [flyTarget, setFlyTarget] = useState<{ lat: number; lon: number; key: number } | null>(null);
  const flyKey = useRef(0);

  const shown = useMemo(() => places.filter((p) => active.has(p.cat)), [places, active]);

  function toggle(key: CatKey) {
    setActive((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }
  function focus(p: Place) {
    flyKey.current += 1;
    setFlyTarget({ lat: p.lat, lon: p.lon, key: flyKey.current });
  }

  return (
    <div className="map-wrap">
      <aside className="map-panel">
        <div className="filters">
          <div className="lead">カテゴリで絞る</div>
          <div className="chips">
            {CATS.map((c) => {
              const on = active.has(c.key);
              return (
                <button key={c.key} className="chip" aria-pressed={on} style={{ color: c.color }} onClick={() => toggle(c.key)}>
                  <span className="dot" />
                  {c.label}
                </button>
              );
            })}
          </div>
        </div>
        <div className="status">
          <span style={{ color: "var(--go)", fontWeight: 800 }}>●</span>
          <span><span className="count">{shown.length}</span> 件表示中</span>
        </div>
        <div className="list">
          {shown.length === 0 && <div className="empty">この条件に合う施設がありません。</div>}
          {shown.slice(0, 400).map((p) => (
            <div key={p.id} className="item" onClick={() => focus(p)}>
              <div className="top">
                <div className="name">{p.name}</div>
                <div className="cat" style={{ color: catColor(p.cat) }}>{catLabel(p.cat)}</div>
              </div>
              <span className={`badge b-${p.cond}`}>{p.condText}</span>
              {p.note && <div className="note">{p.note}</div>}
              {p.area && <div className="addr">{p.area}</div>}
            </div>
          ))}
        </div>
      </aside>

      <div className="map-area">
        <MapContainer center={[35.66, 139.73]} zoom={11} className="leaflet-root">
          <TileLayer attribution="© OpenStreetMap" url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
          {shown.map((p) => (
            <CircleMarker
              key={p.id}
              center={[p.lat, p.lon]}
              radius={7}
              pathOptions={{ color: "#fff", weight: 2, fillColor: catColor(p.cat), fillOpacity: 0.95 }}
            >
              <Popup>
                <div className="pop-name">{p.name}</div>
                <span className={`badge b-${p.cond}`}>{p.condText}</span>
                <div style={{ fontSize: 12, color: "#8B8377", marginTop: 5 }}>
                  {catLabel(p.cat)}{p.area ? " ・ " + p.area : ""}
                </div>
                {p.note && <div style={{ fontSize: 12.5, marginTop: 5 }}>{p.note}</div>}
                {p.link && (
                  <div style={{ marginTop: 6 }}>
                    <a href={p.link} target="_blank" rel="noreferrer">公式ページ →</a>
                  </div>
                )}
              </Popup>
            </CircleMarker>
          ))}
          <FlyTo target={flyTarget} />
        </MapContainer>
      </div>
    </div>
  );
}
