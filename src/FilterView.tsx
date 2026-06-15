import { useMemo, useState } from "react";
import { CATS, CONDS, catColor, catLabel, catEmoji, type CatKey, type CondKey, type Place } from "./osm";

export default function FilterView({ places }: { places: Place[] }) {
  const [cats, setCats] = useState<Set<CatKey>>(new Set());
  const [conds, setConds] = useState<Set<CondKey>>(new Set());
  const [area, setArea] = useState("");

  function toggleCat(k: CatKey) {
    setCats((p) => { const n = new Set(p); n.has(k) ? n.delete(k) : n.add(k); return n; });
  }
  function toggleCond(k: CondKey) {
    setConds((p) => { const n = new Set(p); n.has(k) ? n.delete(k) : n.add(k); return n; });
  }

  const shown = useMemo(() => {
    return places.filter((p) => {
      if (cats.size > 0 && !cats.has(p.cat)) return false;
      if (conds.size > 0 && !conds.has(p.cond)) return false;
      if (area.trim() && !p.area.includes(area.trim())) return false;
      return true;
    });
  }, [places, cats, conds, area]);

  const noFilter = cats.size === 0 && conds.size === 0 && !area.trim();

  return (
    <div className="filter-wrap">
      <div className="filter-controls">
        <div className="fc-block">
          <div className="lead">カテゴリ</div>
          <div className="chips">
            {CATS.map((c) => (
              <button key={c.key} className="chip" aria-pressed={cats.has(c.key)} style={{ color: c.color }} onClick={() => toggleCat(c.key)}>
                <span>{c.emoji}</span>{c.label}
              </button>
            ))}
          </div>
        </div>
        <div className="fc-block">
          <div className="lead">同伴条件</div>
          <div className="chips">
            {CONDS.map((c) => (
              <button key={c.key} className="chip cond" aria-pressed={conds.has(c.key)} onClick={() => toggleCond(c.key)}>
                {c.label}
              </button>
            ))}
          </div>
        </div>
        <div className="fc-block">
          <div className="lead">エリア（区市名で絞る）</div>
          <input className="area-input" placeholder="例：渋谷区" value={area} onChange={(e) => setArea(e.target.value)} />
        </div>
        <div className="fc-result">
          <span className="count">{shown.length}</span> 件
          {!noFilter && <button className="clear" onClick={() => { setCats(new Set()); setConds(new Set()); setArea(""); }}>条件をクリア</button>}
        </div>
      </div>

      <div className="cards">
        {shown.length === 0 && <div className="empty">条件に合う施設が見つかりませんでした。<br />条件を緩めてみてください。</div>}
        {shown.slice(0, 400).map((p) => (
          <div key={p.id} className="card">
            <div className="card-top">
              <span className="card-emoji" style={{ background: catColor(p.cat) + "22", color: catColor(p.cat) }}>{catEmoji(p.cat)}</span>
              <div className="card-main">
                <div className="card-name">{p.name}</div>
                <div className="card-sub">{catLabel(p.cat)}{p.area ? " ・ " + p.area : ""}</div>
              </div>
              <span className={`badge b-${p.cond}`}>{p.condText}</span>
            </div>
            {p.note && <div className="card-note">{p.note}</div>}
            {p.link && <a className="card-link" href={p.link} target="_blank" rel="noreferrer">詳細・公式ページ →</a>}
          </div>
        ))}
      </div>
    </div>
  );
}
