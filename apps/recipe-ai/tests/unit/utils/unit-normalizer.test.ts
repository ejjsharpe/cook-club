import { describe, it, expect } from "vitest";

import {
  normalizeUnit,
  isRecognizedUnit,
  getCanonicalUnits,
  getUnitVariations,
} from "../../../src/utils/unit-normalizer";

describe("normalizeUnit", () => {
  describe("volume units", () => {
    it("normalizes cup variations", () => {
      expect(normalizeUnit("cup")).toBe("cup");
      expect(normalizeUnit("cups")).toBe("cup");
      expect(normalizeUnit("c")).toBe("cup");
      expect(normalizeUnit("CUP")).toBe("cup");
      expect(normalizeUnit("CUPS")).toBe("cup");
    });

    it("normalizes tablespoon variations", () => {
      expect(normalizeUnit("tablespoon")).toBe("tablespoon");
      expect(normalizeUnit("tablespoons")).toBe("tablespoon");
      expect(normalizeUnit("tbsp")).toBe("tablespoon");
      expect(normalizeUnit("tbs")).toBe("tablespoon");
      expect(normalizeUnit("T")).toBe("tablespoon");
    });

    it("normalizes teaspoon variations", () => {
      expect(normalizeUnit("teaspoon")).toBe("teaspoon");
      expect(normalizeUnit("teaspoons")).toBe("teaspoon");
      expect(normalizeUnit("tsp")).toBe("teaspoon");
      expect(normalizeUnit("ts")).toBe("teaspoon");
      expect(normalizeUnit("t")).toBe("teaspoon");
    });

    it("normalizes metric volume", () => {
      expect(normalizeUnit("liter")).toBe("liter");
      expect(normalizeUnit("liters")).toBe("liter");
      expect(normalizeUnit("litre")).toBe("liter");
      expect(normalizeUnit("l")).toBe("liter");
      expect(normalizeUnit("ml")).toBe("milliliter");
      expect(normalizeUnit("milliliters")).toBe("milliliter");
    });

    it("normalizes other volume units", () => {
      expect(normalizeUnit("gallon")).toBe("gallon");
      expect(normalizeUnit("gal")).toBe("gallon");
      expect(normalizeUnit("quart")).toBe("quart");
      expect(normalizeUnit("qt")).toBe("quart");
      expect(normalizeUnit("pint")).toBe("pint");
      expect(normalizeUnit("pt")).toBe("pint");
    });
  });

  describe("weight units", () => {
    it("normalizes imperial weight", () => {
      expect(normalizeUnit("pound")).toBe("pound");
      expect(normalizeUnit("pounds")).toBe("pound");
      expect(normalizeUnit("lb")).toBe("pound");
      expect(normalizeUnit("lbs")).toBe("pound");
      expect(normalizeUnit("ounce")).toBe("ounce");
      expect(normalizeUnit("oz")).toBe("ounce");
    });

    it("normalizes metric weight", () => {
      expect(normalizeUnit("gram")).toBe("gram");
      expect(normalizeUnit("grams")).toBe("gram");
      expect(normalizeUnit("g")).toBe("gram");
      expect(normalizeUnit("gm")).toBe("gram");
      expect(normalizeUnit("kg")).toBe("kilogram");
      expect(normalizeUnit("mg")).toBe("milligram");
    });
  });

  describe("other units", () => {
    it("normalizes common cooking units", () => {
      expect(normalizeUnit("pinch")).toBe("pinch");
      expect(normalizeUnit("pinches")).toBe("pinch");
      expect(normalizeUnit("dash")).toBe("dash");
      expect(normalizeUnit("clove")).toBe("clove");
      expect(normalizeUnit("cloves")).toBe("clove");
    });

    it("normalizes container units", () => {
      expect(normalizeUnit("can")).toBe("can");
      expect(normalizeUnit("cans")).toBe("can");
      expect(normalizeUnit("jar")).toBe("jar");
      expect(normalizeUnit("package")).toBe("package");
      expect(normalizeUnit("pkg")).toBe("package");
    });

    it("normalizes count units", () => {
      expect(normalizeUnit("slice")).toBe("slice");
      expect(normalizeUnit("slices")).toBe("slice");
      expect(normalizeUnit("piece")).toBe("piece");
      expect(normalizeUnit("bunch")).toBe("bunch");
      expect(normalizeUnit("head")).toBe("head");
      expect(normalizeUnit("stick")).toBe("stick");
    });
  });

  describe("edge cases", () => {
    it("returns null for null input", () => {
      expect(normalizeUnit(null)).toBeNull();
    });

    it("returns unknown units as-is (lowercased)", () => {
      expect(normalizeUnit("sprig")).toBe("sprig");
      expect(normalizeUnit("SPRIG")).toBe("sprig");
    });

    it("handles whitespace", () => {
      expect(normalizeUnit("  cup  ")).toBe("cup");
      expect(normalizeUnit("  tbsp  ")).toBe("tablespoon");
    });
  });
});

describe("isRecognizedUnit", () => {
  it("returns true for recognized units", () => {
    expect(isRecognizedUnit("cup")).toBe(true);
    expect(isRecognizedUnit("cups")).toBe(true);
    expect(isRecognizedUnit("tbsp")).toBe(true);
    expect(isRecognizedUnit("gram")).toBe(true);
  });

  it("returns false for unrecognized units", () => {
    expect(isRecognizedUnit("sprig")).toBe(false);
    expect(isRecognizedUnit("handful")).toBe(false);
  });

  it("returns false for null", () => {
    expect(isRecognizedUnit(null)).toBe(false);
  });
});

describe("getCanonicalUnits", () => {
  it("returns array of canonical units", () => {
    const units = getCanonicalUnits();
    expect(units).toContain("cup");
    expect(units).toContain("tablespoon");
    expect(units).toContain("teaspoon");
    expect(units).toContain("gram");
    expect(units).toContain("pound");
  });
});

describe("getUnitVariations", () => {
  it("returns variations for canonical units", () => {
    const cupVariations = getUnitVariations("cup");
    expect(cupVariations).toContain("cup");
    expect(cupVariations).toContain("cups");
    expect(cupVariations).toContain("c");
  });

  it("returns empty array for unknown units", () => {
    expect(getUnitVariations("unknown")).toEqual([]);
  });
});
