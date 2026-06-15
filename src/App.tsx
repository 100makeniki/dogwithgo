import "leaflet/dist/leaflet.css";
import DogMap from "./DogMap";

export default function App() {
  return (
    <>
      <header className="app-header">
        <span className="mark">
          <span className="paw" />
          Dog With Go
        </span>
        <span className="tag">BETA</span>
        <span className="area">東京23区 ＋ 横浜市</span>
      </header>
      <DogMap />
    </>
  );
}
