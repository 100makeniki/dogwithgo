import "leaflet/dist/leaflet.css";
import { useEffect, useState } from "react";
import { loadPlaces, type LoadResult } from "./osm";
import MapView from "./MapView";
import FilterView from "./FilterView";
import ChatView from "./ChatView";

type Tab = "chat" | "filter" | "map";

export default function App() {
  const [tab, setTab] = useState<Tab>("chat");
  const [data, setData] = useState<LoadResult | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    (async () => {
      const res = await loadPlaces();
      if (!alive) return;
      setData(res);
      setLoading(false);
    })();
    return () => { alive = false; };
  }, []);

  const places = data?.places ?? [];

  return (
    <>
      <header className="app-header">
        <span className="mark"><span className="paw" />Dog With Go</span>
        <span className="tag">BETA</span>
        <span className="area">東京23区 ＋ 横浜市</span>
      </header>

      <nav className="tabs">
        <button className={tab === "chat" ? "on" : ""} onClick={() => setTab("chat")}>💬 チャットで探す</button>
        <button className={tab === "filter" ? "on" : ""} onClick={() => setTab("filter")}>🔎 条件で探す</button>
        <button className={tab === "map" ? "on" : ""} onClick={() => setTab("map")}>🗺 地図で探す</button>
      </nav>

      {loading && <div className="loading"><span className="spinner" />犬と行ける場所を読み込み中…</div>}

      {!loading && data?.usingSampleOnly && (
        <div className="banner">
          いまこの環境からはデータ取得元に接続できず、<b>サンプル</b>を表示しています。
          公開後（本番URL）はスプレッドシート＋OSMの実データが読み込まれます。
        </div>
      )}

      {!loading && !data?.usingSampleOnly && (
        <div className="source-note">
          スプシ {data?.counts.sheet ?? 0} 件 ＋ OSM {data?.counts.osm ?? 0} 件 を表示中
        </div>
      )}

      {!loading && (
        <main className="content">
          {tab === "chat" && <ChatView places={places} />}
          {tab === "filter" && <FilterView places={places} />}
          {tab === "map" && <MapView places={places} />}
        </main>
      )}

      <footer className="footer-note">
        データ出典：OpenStreetMap ＋ 編集部スプレッドシート。「同伴条件」は目安です。
        サイズ別の可否や最新情報は、来店前に各施設へ直接ご確認ください。
      </footer>
    </>
  );
}
