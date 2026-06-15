import { useMemo, useState } from "react";
import { catColor, catLabel, catEmoji, type CatKey, type CondKey, type Place } from "./osm";

// API課金ゼロの「選択肢ボタン対話」。本物のLLMは使わず、
// 質問を順に出して条件を集め、最後に該当施設を提示する。

type Step = "cat" | "cond" | "result";

const CAT_CHOICES: { key: CatKey; label: string }[] = [
  { key: "food", label: "🍴 ごはん・カフェ" },
  { key: "park", label: "🌳 公園・ドッグラン" },
  { key: "hotel", label: "🏨 泊まりたい" },
  { key: "shop", label: "🛍 買い物" },
  { key: "hospital", label: "🏥 動物病院" },
];
const COND_CHOICES: { key: CondKey | "any"; label: string }[] = [
  { key: "go", label: "店内に入れる方がいい" },
  { key: "warn", label: "テラス・屋外でもOK" },
  { key: "any", label: "どっちでもいい" },
];

type Bubble = { who: "bot" | "me"; text: string };

export default function ChatView({ places }: { places: Place[] }) {
  const [step, setStep] = useState<Step>("cat");
  const [cat, setCat] = useState<CatKey | null>(null);
  const [cond, setCond] = useState<CondKey | "any" | null>(null);
  const [log, setLog] = useState<Bubble[]>([
    { who: "bot", text: "こんにちは！🐶 ワンちゃんと、今日はどこへ行きたい？" },
  ]);

  const results = useMemo(() => {
    if (step !== "result" || !cat) return [];
    return places.filter((p) => {
      if (p.cat !== cat) return false;
      if (cond && cond !== "any" && p.cond !== cond) return false;
      return true;
    });
  }, [step, cat, cond, places]);

  function pickCat(c: { key: CatKey; label: string }) {
    setCat(c.key);
    setLog((l) => [...l, { who: "me", text: c.label }, { who: "bot", text: "いいね！お店の中まで入りたい？それともテラスでも大丈夫？" }]);
    setStep("cond");
  }
  function pickCond(c: { key: CondKey | "any"; label: string }) {
    setCond(c.key);
    setLog((l) => [...l, { who: "me", text: c.label }, { who: "bot", text: "ありがとう！条件に合う場所を探したよ👇" }]);
    setStep("result");
  }
  function restart() {
    setStep("cat");
    setCat(null);
    setCond(null);
    setLog([{ who: "bot", text: "もう一回探そう！🐶 今日はどこへ行きたい？" }]);
  }

  return (
    <div className="chat-wrap">
      <div className="chat-log">
        {log.map((b, i) => (
          <div key={i} className={`bubble ${b.who}`}>{b.text}</div>
        ))}

        {step === "result" && (
          <div className="chat-results">
            {results.length === 0 ? (
              <div className="empty">
                ごめんね、その条件の場所がまだ見つからなかった🙇
                <br />条件を変えてもう一度試してみて。
              </div>
            ) : (
              results.slice(0, 30).map((p) => (
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
              ))
            )}
          </div>
        )}
      </div>

      <div className="chat-choices">
        {step === "cat" && CAT_CHOICES.map((c) => (
          <button key={c.key} className="choice" onClick={() => pickCat(c)}>{c.label}</button>
        ))}
        {step === "cond" && COND_CHOICES.map((c) => (
          <button key={String(c.key)} className="choice" onClick={() => pickCond(c)}>{c.label}</button>
        ))}
        {step === "result" && (
          <button className="choice restart" onClick={restart}>↺ もう一度さがす</button>
        )}
      </div>
    </div>
  );
}
