import { useEffect, useMemo, useRef, useState } from "react";
import { MapContainer, TileLayer, CircleMarker, Popup, useMap } from "react-leaflet";
import {
  CATS,
  catColor,
  catLabel,
  fetchDogPlaces,
  type CatKey,
  type Place,
} from "./osm";

// 地図を任意の座標へ飛ばすための小コンポーネント
function FlyTo({ target }: { target: { lat: number; lon: number; key: number } | null }) {
  const map = useMap();
  useEffect(() => {
    if (target) map.setView([target.lat, target.lon], 16, { animate: true });
  }, [target, map]);
  return null;
}

export default function DogMap() {
  const [places, setPlaces] = useState<Place[]>([]);
  const [loading, setLoading] = useState(true);
  const [usingSample, setUsingSample] = useState(false);
  const [active, setActive] = useState<Set<CatKey>>(new Set(CATS.map((c) => c.key)));
  const [flyTarget, setFlyTarget] = useState<{ lat: number; lon: number; key: number } | null>(null);
  const flyKey = useRef(0);

  useEffect(() => {
    let alive = true;
    (async () => {
      const res = await fetchDogPlaces();
      if (!alive) return;
      setPlaces(res.places);
      setUsingSample(res.usingSample);
      setLoading(false);
    })();
    return () => {
      alive = false;
    };
  }, []);

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
    <div className="wrap">
      <aside className="panel">
        <div className="filters">
          <div className="lead">カテゴリで絞る</div>
          <div className="chips">
            {CATS.map((c) => {
              const on = active.has(c.key);
              return (
                <button
                  key={c.key}
                  className="chip"
                  aria-pressed={on}
                  style={{ color: c.color }}
                  onClick={() => toggle(c.key)}
                >
                  <span className="dot" />
                  {c.label}
                </button>
              );
            })}
          </div>
        </div>

        <div className="status">
          {loading ? (
            <>
              <span className="spinner" />
              <span>犬と行ける場所を読み込み中…</span>
            </>
          ) : usingSample ? (
            <>
              <span style={{ color: "var(--warn)", fontWeight: 800 }}>●</span>
              <span>
                サンプル表示中（この画面ではOSMに接続できないため）— <span className="count">{shown.length}</span>件
              </span>
            </>
          ) : (
            <>
              <span style={{ color: "var(--go)", fontWeight: 800 }}>●</span>
              <span>
                <span className="count">{shown.length}</span> 件の「犬と行ける場所」
              </span>
            </>
          )}
        </div>

        {usingSample && !loading && (
          <div className="banner">
            いまこの環境からはOSMサーバーに接続できなかったため、<b>サンプルデータ</b>を表示しています。
            公開後（GitHub Pages上）は実データが自動で読み込まれます。
          </div>
        )}

        <div className="list">
          {!loading && shown.length === 0 && (
            <div className="empty">
              この条件に合う施設が見つかりませんでした。
              <br />
              カテゴリの絞り込みを広げてみてください。
            </div>
          )}
          {shown.slice(0, 300).map((p) => (
            <div key={p.id} className="item" onClick={() => focus(p)}>
              <div className="top">
                <div className="name">{p.name}</div>
                <div className="cat" style={{ color: catColor(p.cat) }}>
                  {catLabel(p.cat)}
                </div>
              </div>
              <span className={`badge b-${p.cond.cls}`}>{p.cond.text}</span>
              {p.addr && <div className="addr">{p.addr}</div>}
            </div>
          ))}
        </div>

        <div className="footer-note">
          データ出典：OpenStreetMap（dog=yes / leashed タグ）。「同伴条件」はタグからの自動判定のため、
          来店前に各施設へご確認ください。
        </div>
      </aside>

      <div className="map-area">
        <MapContainer center={[35.66, 139.73]} zoom={11} className="leaflet-root">
          <TileLayer
            attribution="© OpenStreetMap"
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          {shown.map((p) => (
            <CircleMarker
              key={p.id}
              center={[p.lat, p.lon]}
              radius={7}
              pathOptions={{ color: "#fff", weight: 2, fillColor: catColor(p.cat), fillOpacity: 0.95 }}
            >
              <Popup>
                <div className="pop-name">{p.name}</div>
                <span className={`badge b-${p.cond.cls}`}>{p.cond.text}</span>
                <div style={{ fontSize: 12, color: "#8B8377", marginTop: 5 }}>
                  {catLabel(p.cat)}
                  {p.addr ? " ・ " + p.addr : ""}
                </div>
              </Popup>
            </CircleMarker>
          ))}
          <FlyTo target={flyTarget} />
        </MapContainer>
      </div>
    </div>
  );
}
