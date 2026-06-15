// ============================================================
//  osm.ts  —  OpenStreetMap から「犬と行ける場所」を取得する層
//  - 23区＋横浜のbbox内の dog=yes / leashed / outside を取得
//  - カテゴリ分類・同伴条件の判定・取得失敗時のサンプルを提供
// ============================================================

export type CatKey = "food" | "hospital" | "hotel" | "park" | "shop" | "other";

export type Condition = {
  cls: "go" | "leash" | "warn";
  text: string;
};

export type Place = {
  id: string;
  name: string;
  cat: CatKey;
  cond: Condition;
  lat: number;
  lon: number;
  addr: string;
};

export const CATS: { key: CatKey; label: string; color: string }[] = [
  { key: "food", label: "飲食", color: "#C0563E" },
  { key: "hospital", label: "動物病院", color: "#3A5B8C" },
  { key: "hotel", label: "宿泊", color: "#7A4FA3" },
  { key: "park", label: "公園・ラン", color: "#2E8B57" },
  { key: "shop", label: "ショップ", color: "#B8893A" },
  { key: "other", label: "その他", color: "#7A7268" },
];

export function catColor(key: CatKey): string {
  return CATS.find((c) => c.key === key)?.color ?? "#7A7268";
}
export function catLabel(key: CatKey): string {
  return CATS.find((c) => c.key === key)?.label ?? "その他";
}

// 23区＋横浜をざっくり覆う bbox: south, west, north, east
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

function condition(dog?: string): Condition {
  if (dog === "yes") return { cls: "go", text: "店内OK" };
  if (dog === "leashed") return { cls: "leash", text: "リード必須" };
  if (dog === "outside") return { cls: "warn", text: "テラス/屋外のみ" };
  return { cls: "warn", text: "要確認" };
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

function toPlaces(elements: OsmElement[]): Place[] {
  const out: Place[] = [];
  for (const el of elements) {
    const t = el.tags ?? {};
    if (!t.name) continue; // 名前なしは信頼のため出さない
    const lat = el.lat ?? el.center?.lat;
    const lon = el.lon ?? el.center?.lon;
    if (lat == null || lon == null) continue;
    out.push({
      id: `${el.type}/${el.id}`,
      name: t.name,
      cat: classify(t),
      cond: condition(t.dog),
      lat,
      lon,
      addr: [t["addr:city"], t["addr:suburb"], t["addr:neighbourhood"]]
        .filter(Boolean)
        .join(" "),
    });
  }
  return out;
}

// 取得失敗時にUIを必ず動かすためのサンプル
export const SAMPLE: Place[] = [
  { id: "s1", name: "代々木公園 ドッグラン", cat: "park", cond: condition("yes"), lat: 35.6716, lon: 139.6949, addr: "渋谷区" },
  { id: "s2", name: "駒沢オリンピック公園", cat: "park", cond: condition("leashed"), lat: 35.6256, lon: 139.662, addr: "世田谷区" },
  { id: "s3", name: "山下公園", cat: "park", cond: condition("leashed"), lat: 35.4449, lon: 139.6503, addr: "横浜市中区" },
  { id: "s4", name: "テラス併設カフェ（例）", cat: "food", cond: condition("outside"), lat: 35.6595, lon: 139.7005, addr: "渋谷区" },
  { id: "s5", name: "わんこOKレストラン（例）", cat: "food", cond: condition("yes"), lat: 35.67, lon: 139.76, addr: "港区" },
  { id: "s6", name: "動物病院（例）", cat: "hospital", cond: condition("yes"), lat: 35.467, lon: 139.623, addr: "横浜市西区" },
  { id: "s7", name: "ペット同伴ホテル（例）", cat: "hotel", cond: condition("yes"), lat: 35.628, lon: 139.738, addr: "品川区" },
  { id: "s8", name: "ペットショップ（例）", cat: "shop", cond: condition("leashed"), lat: 35.71, lon: 139.796, addr: "台東区" },
];

export type FetchResult = { places: Place[]; usingSample: boolean };

export async function fetchDogPlaces(): Promise<FetchResult> {
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
      if (j.elements) {
        const places = toPlaces(j.elements);
        if (places.length > 0) return { places, usingSample: false };
      }
    } catch {
      // 次のエンドポイントへ
    }
  }
  return { places: SAMPLE, usingSample: true };
}
