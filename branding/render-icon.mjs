import { Resvg } from "@resvg/resvg-js";
import { readFileSync, writeFileSync } from "node:fs";

const svg = readFileSync(new URL("./app-icon.svg", import.meta.url), "utf8");

const resvg = new Resvg(svg, {
  fitTo: { mode: "width", value: 1200 },
  background: "#0a2a20",
  font: { loadSystemFonts: true, defaultFontFamily: "Yu Mincho" },
});

const png = resvg.render().asPng();
writeFileSync(new URL("./app-icon-1200.png", import.meta.url), png);
console.log("Wrote app-icon-1200.png", png.length, "bytes");
