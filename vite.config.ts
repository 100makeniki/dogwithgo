import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// GitHub Pages のプロジェクトサイトは https://<user>.github.io/dogwithgo/ に出るため、
// base を "/dogwithgo/" にしておかないと、ビルド後にCSS/JSのパスがずれて真っ白になる。
export default defineConfig({
  plugins: [react()],
  base: "/dogwithgo/",
});
