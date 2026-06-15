// ============================================================
//  osm.ts  —  データ層（3入口で共有）
//  施設データを3ソースから集めて1つに合体する:
//    ① Googleスプレッドシート（君が手で足す本命データ / CSV公開）
//    ② OpenStreetMap（dog=yes/leashed/outside の素データ）
//    ③ サンプル（①②が両方ダメな時の保険）
//  マップ / 条件 / チャットの3入口は、すべてこの結果を使う。
// ============================================================

export type CatKey = "food" | "hospital" | "hotel" | "park" | "shop" | "other";
export type CondKey = "go" | "leash" | "warn";

export type Place = {
  id: string;
  name: string;
  cat: CatKey;
  cond: CondKey;
  condText: string;
  lat: number;
  lon: number;
  area: string;
  note: string;
  link: string;
  source: "sheet" | "osm" | "sample";
};

export const CATS: { key: CatKey; label: string; color: string; emoji: string }[] = [
  { key: "food", label: "飲食", color: "#C0563E", emoji: "🍴" },
  { key: "park", label: "公園・ラン", color: "#2E8B57", emoji: "🌳" },
  { key: "hotel", label: "宿泊", color: "#7A4FA3", emoji: "🏨" },
  { key: "hospital", label: "動物病院", color: "#3A5B8C", emoji: "🏥" },
  { key: "shop", label: "ショップ", color: "#B8893A", emoji: "🛍" },
  { key: "other", label: "その他", color: "#7A7268", emoji: "📍" },
];

export const CONDS: { key: CondKey; label: string }[] = [
  { key: "go", label: "店内OK" },
  { key: "leash", label: "リード必須" },
  { key: "warn", label: "テラス/要確認" },
];

export function catColor(key: CatKey): string {
  return CATS.find((c) => c.key === key)?.color ?? "#7A7268";
}
export function catLabel(key: CatKey): string {
  return CATS.find((c) => c.key === key)?.label ?? "その他";
}
export function catEmoji(key: CatKey): string {
  return CATS.find((c) => c.key === key)?.emoji ?? "📍";
}

// ---- ① Googleスプレッドシート（CSV公開URL）----
// 「ファイル→共有→ウェブに公開」で取得した pub URL の output=csv 版。
const SHEET_CSV_URL =
  "https://docs.google.com/spreadsheets/d/e/2PACX-1vQTkgEKPUfy8XKETN_Dn1Wr0cwpvOM6vYAZCR-itL2T1nZGsIDkjmOYkud49Wa-YD0HvbjqO01iYCf1/pub?output=csv";

// ---- 同伴条件の正規化（スプシの cond 列 / OSMの dog タグ 両対応）----
function normalizeCond(raw?: string): { cond: CondKey; text: string } {
  const v = (raw ?? "").trim().toLowerCase();
  if (["yes", "go", "ok", "店内ok", "店内"].includes(v)) return { cond: "go", text: "店内OK" };
  if (["leashed", "leash", "リード", "リード必須"].includes(v))
    return { cond: "leash", text: "リード必須" };
  if (["outside", "terrace", "テラス"].includes(v))
    return { cond: "warn", text: "テラス/屋外のみ" };
  return { cond: "warn", text: "要確認" };
}

// ---- 軽量CSVパーサ（ダブルクオート/カンマ内包に対応）----
function parseCSV(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else inQuotes = false;
      } else field += c;
    } else {
      if (c === '"') inQuotes = true;
      else if (c === ",") {
        row.push(field);
        field = "";
      } else if (c === "\n") {
        row.push(field);
        rows.push(row);
        row = [];
        field = "";
      } else if (c === "\r") {
        // ignore
      } else field += c;
    }
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

async function fetchSheet(): Promise<Place[]> {
  try {
    const r = await fetch(SHEET_CSV_URL);
    if (!r.ok) return [];
    const text = await r.text();
    const rows = parseCSV(text).filter((r) => r.length > 1);
    if (rows.length < 2) return [];

    // 1行目をヘッダーとして列位置を特定（順序が変わっても動くように）
    const header = rows[0].map((h) => h.trim().toLowerCase());
    const idx = (name: string) => header.indexOf(name);
    const iName = idx("name"),
      iCat = idx("cat"),
      iCond = idx("cond"),
      iLat = idx("lat"),
      iLon = idx("lon"),
      iArea = idx("area"),
      iNote = idx("note"),
      iLink = idx("link");

    const out: Place[] = [];
    for (let r = 1; r < rows.length; r++) {
      const cols = rows[r];
      const name = (cols[iName] ?? "").trim();
      const lat = parseFloat(cols[iLat] ?? "");
      const lon = parseFloat(cols[iLon] ?? "");
      if (!name || isNaN(lat) || isNaN(lon)) continue;
      const rawCat = (cols[iCat] ?? "").trim().toLowerCase();
      const cat: CatKey = (["food", "hospital", "hotel", "park", "shop", "other"].includes(
        rawCat
      )
        ? rawCat
        : "other") as CatKey;
      const cnd = normalizeCond(cols[iCond]);
      out.push({
        id: `sheet-${r}`,
        name,
        cat,
        cond: cnd.cond,
        condText: cnd.text,
        lat,
        lon,
        area: (cols[iArea] ?? "").trim(),
        note: (cols[iNote] ?? "").trim(),
        link: (cols[iLink] ?? "").trim(),
        source: "sheet",
      });
    }
    return out;
  } catch {
    return [];
  }
}

// ---- ② OpenStreetMap ----
const BBOX: [number, number, number, number] = [35.3, 139.45, 35.82, 139.95];
const ENDPOINTS = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
  "https://maps.mail.ru/osm/tools/overpass/api/interpreter",
];

type OsmTags = Record<string, string>;
type OsmElement = {
  type: string;
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: OsmTags;
};

function classify(t: OsmTags): CatKey {
  const a = t.amenity,
    s = t.shop,
    to = t.tourism,
    l = t.leisure;
  if (a && ["cafe", "restaurant", "fast_food", "bar", "pub", "biergarten", "food_court"].includes(a))
    return "food";
  if (a === "veterinary") return "hospital";
  if (to && ["hotel", "guest_house", "motel", "hostel", "apartment", "chalet"].includes(to))
    return "hotel";
  if (l && ["park", "dog_park", "garden"].includes(l)) return "park";
  if (a === "dog_park" || to === "camp_site") return "park";
  if (s) return "shop";
  return "other";
}

function buildQuery(): string {
  const [s, w, n, e] = BBOX;
  const bb = `(${s},${w},${n},${e})`;
  return `[out:json][timeout:60];
(
  nwr["dog"="yes"]${bb};
  nwr["dog"="leashed"]${bb};
  nwr["dog"="outside"]${bb};
);
out tags center 600;`;
}

async function fetchOsm(): Promise<Place[]> {
  const q = buildQuery();
  for (const ep of ENDPOINTS) {
    try {
      const r = await fetch(ep, {
        method: "POST",
        body: "data=" + encodeURIComponent(q),
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
      });
      if (!r.ok) continue;
      const j = (await r.json()) as { elements?: OsmElement[] };
      if (!j.elements) continue;
      const out: Place[] = [];
      for (const el of j.elements) {
        const t = el.tags ?? {};
        if (!t.name) continue;
        const lat = el.lat ?? el.center?.lat;
        const lon = el.lon ?? el.center?.lon;
        if (lat == null || lon == null) continue;
        const cnd = normalizeCond(t.dog);
        out.push({
          id: `osm-${el.type}/${el.id}`,
          name: t.name,
          cat: classify(t),
          cond: cnd.cond,
          condText: cnd.text,
          lat,
          lon,
          area: [t["addr:city"], t["addr:suburb"], t["addr:neighbourhood"]]
            .filter(Boolean)
            .join(" "),
          note: "",
          link: t.website ?? "",
          source: "osm",
        });
      }
      if (out.length > 0) return out;
    } catch {
      // 次のendpointへ
    }
  }
  return [];
}

// ---- ③ サンプル（保険）----
const SAMPLE: Place[] = [
  { id: "sample-1", name: "代々木公園 ドッグラン", cat: "park", cond: "go", condText: "店内OK", lat: 35.6716, lon: 139.6949, area: "渋谷区", note: "広い芝のドッグラン", link: "", source: "sample" },
  { id: "sample-2", name: "わんこOKカフェ（例）", cat: "food", cond: "warn", condText: "テラスのみ", lat: 35.6595, lon: 139.7005, area: "渋谷区", note: "テラス席のみ同伴可", link: "", source: "sample" },
  { id: "sample-3", name: "山下公園", cat: "park", cond: "leash", condText: "リード必須", lat: 35.4449, lon: 139.6503, area: "横浜市中区", note: "海沿いの散歩道", link: "", source: "sample" },
  { id: "sample-4", name: "ペット同伴ホテル（例）", cat: "hotel", cond: "go", condText: "店内OK", lat: 35.628, lon: 139.738, area: "品川区", note: "", link: "", source: "sample" },
];

export type LoadResult = {
  places: Place[];
  counts: { sheet: number; osm: number; sample: number };
  usingSampleOnly: boolean;
};

// 重複の簡易除去（名前＋座標が近いもの。スプシ優先）
function dedupe(places: Place[]): Place[] {
  const seen = new Map<string, Place>();
  for (const p of places) {
    const key = `${p.name}|${p.lat.toFixed(3)}|${p.lon.toFixed(3)}`;
    const existing = seen.get(key);
    if (!existing) seen.set(key, p);
    else if (existing.source === "osm" && p.source === "sheet") seen.set(key, p); // スプシで上書き
  }
  return [...seen.values()];
}

export async function loadPlaces(): Promise<LoadResult> {
  const [sheet, osm] = await Promise.all([fetchSheet(), fetchOsm()]);
  let places = dedupe([...sheet, ...osm]);
  let usingSampleOnly = false;
  if (places.length === 0) {
    places = SAMPLE;
    usingSampleOnly = true;
  }
  return {
    places,
    counts: { sheet: sheet.length, osm: osm.length, sample: usingSampleOnly ? SAMPLE.length : 0 },
    usingSampleOnly,
  };
}
