import type { PlantInfo } from "./types";

/** Skróty z edytowalnych zakresów, wspólne dla karty i PDF. */
export function careSummary(info: PlantInfo) {
  const light = (info.lightFrom + info.lightTo) / 2;
  const water = (info.waterFrom + info.waterTo) / 2;
  return {
    light: light >= 4 ? "Słońce" : light >= 2.5 ? "Półcień" : "Cień",
    water: water <= 2 ? "Rzadko" : water >= 4 ? "Obficie" : "Umiarkowanie",
  };
}
