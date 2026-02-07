export type MeasurementSystem = "metric" | "imperial" | "auto";

export function getMeasurementDisplayName(system: MeasurementSystem): string {
  switch (system) {
    case "metric":
      return "Metric (g, ml, °C)";
    case "imperial":
      return "Imperial (oz, cups, °F)";
    case "auto":
      return "Use recipe original";
    default:
      return "Use recipe original";
  }
}
