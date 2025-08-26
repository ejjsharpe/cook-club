import convert from 'convert-units';

export interface MeasurementUnit {
  name: string;
  abbreviations: string[];
  type: 'volume' | 'weight' | 'count';
  system: 'metric' | 'imperial' | 'universal';
  convertUnit?: string; // The unit key used by convert-units
}

// Simplified unit definitions - convert-units handles the conversion factors
export const MEASUREMENT_UNITS: MeasurementUnit[] = [
  // Volume - Imperial
  {
    name: 'teaspoon',
    abbreviations: ['tsp', 'teaspoons'],
    type: 'volume',
    system: 'imperial',
    convertUnit: 'tsp',
  },
  {
    name: 'tablespoon',
    abbreviations: ['tbsp', 'tablespoons'],
    type: 'volume',
    system: 'imperial',
    convertUnit: 'Tbs',
  },
  {
    name: 'fluid ounce',
    abbreviations: ['fl oz', 'fluid ounces'],
    type: 'volume',
    system: 'imperial',
    convertUnit: 'fl-oz',
  },
  {
    name: 'cup',
    abbreviations: ['cup', 'cups', 'c'],
    type: 'volume',
    system: 'imperial',
    convertUnit: 'cup',
  },
  {
    name: 'pint',
    abbreviations: ['pt', 'pint', 'pints'],
    type: 'volume',
    system: 'imperial',
    convertUnit: 'pnt',
  },
  {
    name: 'quart',
    abbreviations: ['qt', 'quart', 'quarts'],
    type: 'volume',
    system: 'imperial',
    convertUnit: 'qt',
  },
  {
    name: 'gallon',
    abbreviations: ['gal', 'gallon', 'gallons'],
    type: 'volume',
    system: 'imperial',
    convertUnit: 'gal',
  },

  // Volume - Metric
  {
    name: 'milliliter',
    abbreviations: ['ml', 'milliliter', 'milliliters', 'millilitre', 'millilitres'],
    type: 'volume',
    system: 'metric',
    convertUnit: 'ml',
  },
  {
    name: 'liter',
    abbreviations: ['l', 'liter', 'liters', 'litre', 'litres'],
    type: 'volume',
    system: 'metric',
    convertUnit: 'l',
  },

  // Weight - Imperial
  {
    name: 'ounce',
    abbreviations: ['oz', 'ounce', 'ounces'],
    type: 'weight',
    system: 'imperial',
    convertUnit: 'oz',
  },
  {
    name: 'pound',
    abbreviations: ['lb', 'lbs', 'pound', 'pounds'],
    type: 'weight',
    system: 'imperial',
    convertUnit: 'lb',
  },

  // Weight - Metric
  {
    name: 'gram',
    abbreviations: ['g', 'gram', 'grams'],
    type: 'weight',
    system: 'metric',
    convertUnit: 'g',
  },
  {
    name: 'kilogram',
    abbreviations: ['kg', 'kilogram', 'kilograms'],
    type: 'weight',
    system: 'metric',
    convertUnit: 'kg',
  },

  // Universal/Count (no conversion needed)
  {
    name: 'piece',
    abbreviations: ['piece', 'pieces', 'pc', 'pcs'],
    type: 'count',
    system: 'universal',
  },
  {
    name: 'clove',
    abbreviations: ['clove', 'cloves'],
    type: 'count',
    system: 'universal',
  },
  {
    name: 'slice',
    abbreviations: ['slice', 'slices'],
    type: 'count',
    system: 'universal',
  },
];

export interface DetectedMeasurement {
  amount: number;
  unit: MeasurementUnit | null;
  ingredient: string;
  originalText: string;
}

export function detectMeasurement(ingredientText: string): DetectedMeasurement {
  const text = ingredientText.trim();

  // Regex to match common patterns: number + unit + ingredient
  const patterns = [
    // "100g flour" or "300ml milk" (no space between number and unit)
    /^(\d+(?:[.,]\d+)?)([a-zA-Z]+)\s+(.+)$/,
    // "2 cups flour" or "1.5 tbsp olive oil"
    /^(\d+(?:[.,]\d+)?)\s+([a-zA-Z\s]+?)\s+(.+)$/,
    // "2 1/2 cups flour" (mixed numbers)
    /^(\d+)\s+(\d+\/\d+)\s+([a-zA-Z\s]+?)\s+(.+)$/,
    // "1/2 cup flour" (fractions)
    /^(\d+\/\d+)\s+([a-zA-Z\s]+?)\s+(.+)$/,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match && match.length >= 4) {
      let amount: number;
      let unitText: string;
      let ingredient: string;

      if (match.length === 4 && match[1] && match[2] && match[3]) {
        // Simple number pattern
        amount = parseFloat(match[1].replace(',', '.'));
        unitText = match[2].toLowerCase().trim();
        ingredient = match[3];
      } else if (match.length === 5 && match[1] && match[2] && match[3] && match[4]) {
        // Mixed number pattern (e.g., "2 1/2")
        const wholeNumber = parseInt(match[1]);
        const fractionParts = match[2].split('/');
        const fractionValue = parseInt(fractionParts[0]!) / parseInt(fractionParts[1]!);
        amount = wholeNumber + fractionValue;
        unitText = match[3].toLowerCase().trim();
        ingredient = match[4];
      } else {
        continue;
      }

      // Find matching unit
      const unit = MEASUREMENT_UNITS.find((u) =>
        u.abbreviations.some((abbr) => abbr.toLowerCase() === unitText)
      );

      return {
        amount,
        unit: unit || null,
        ingredient: ingredient.trim(),
        originalText: text,
      };
    }
  }

  // No measurement detected, return whole string as ingredient
  return {
    amount: 0,
    unit: null,
    ingredient: text,
    originalText: text,
  };
}

export function convertMeasurement(
  amount: number,
  fromUnit: MeasurementUnit,
  toUnit: MeasurementUnit
): number | null {
  // Can only convert within the same measurement type
  if (fromUnit.type !== toUnit.type) {
    return null;
  }

  // Count units don't convert
  if (fromUnit.type === 'count') {
    return amount;
  }

  // Use convert-units for conversion
  if (!fromUnit.convertUnit || !toUnit.convertUnit) {
    return null;
  }

  try {
    return convert(amount).from(fromUnit.convertUnit as any).to(toUnit.convertUnit as any);
  } catch (error) {
    console.warn('Conversion error:', error);
    return null;
  }
}

export function formatMeasurement(amount: number, unit: MeasurementUnit): string {
  // Handle fractions for common measurements
  if (unit.system === 'imperial' && unit.type === 'volume') {
    const fractions = [
      { decimal: 0.125, fraction: '1/8' },
      { decimal: 0.25, fraction: '1/4' },
      { decimal: 0.33, fraction: '1/3' },
      { decimal: 0.5, fraction: '1/2' },
      { decimal: 0.66, fraction: '2/3' },
      { decimal: 0.75, fraction: '3/4' },
    ];

    const wholeNumber = Math.floor(amount);
    const decimal = amount - wholeNumber;

    const closestFraction = fractions.find((f) => Math.abs(f.decimal - decimal) < 0.05);

    if (closestFraction && wholeNumber > 0) {
      return `${wholeNumber} ${closestFraction.fraction} ${unit.abbreviations[1] || unit.abbreviations[0]}`;
    } else if (closestFraction && wholeNumber === 0) {
      return `${closestFraction.fraction} ${unit.abbreviations[1] || unit.abbreviations[0]}`;
    }
  }

  // Default formatting
  const unitName = amount === 1 ? unit.name : unit.abbreviations[1] || unit.abbreviations[0];
  return `${amount} ${unitName}`;
}

export function convertIngredientText(
  ingredientText: string,
  targetSystem: 'metric' | 'imperial'
): string {
  const detected = detectMeasurement(ingredientText);

  if (
    !detected.unit ||
    detected.unit.system === targetSystem ||
    detected.unit.system === 'universal'
  ) {
    return ingredientText;
  }

  // Find equivalent unit in target system
  const targetUnits = MEASUREMENT_UNITS.filter(
    (u) => u.system === targetSystem && u.type === detected.unit!.type
  );

  if (targetUnits.length === 0) {
    return ingredientText;
  }

  // Choose appropriate target unit based on amount and type
  let targetUnit = targetUnits[0];
  if (detected.unit.type === 'volume') {
    if (targetSystem === 'metric') {
      // Convert to base unit (ml) to determine appropriate target
      const mlUnit = MEASUREMENT_UNITS.find(u => u.convertUnit === 'ml');
      if (!mlUnit) return ingredientText;
      const mlAmount = convertMeasurement(detected.amount, detected.unit, mlUnit);
      if (mlAmount && mlAmount >= 1000) {
        targetUnit = MEASUREMENT_UNITS.find(u => u.convertUnit === 'l') || targetUnit;
      } else {
        targetUnit = MEASUREMENT_UNITS.find(u => u.convertUnit === 'ml') || targetUnit;
      }
    } else {
      // Imperial - choose based on amount
      if (detected.amount >= 0.25) {
        targetUnit = MEASUREMENT_UNITS.find(u => u.convertUnit === 'cup') || targetUnit;
      } else {
        targetUnit = MEASUREMENT_UNITS.find(u => u.convertUnit === 'Tbs') || targetUnit;
      }
    }
  } else if (detected.unit.type === 'weight') {
    if (targetSystem === 'metric') {
      // Convert to base unit (g) to determine appropriate target
      const gUnit = MEASUREMENT_UNITS.find(u => u.convertUnit === 'g');
      if (!gUnit) return ingredientText;
      const gAmount = convertMeasurement(detected.amount, detected.unit, gUnit);
      if (gAmount && gAmount >= 1000) {
        targetUnit = MEASUREMENT_UNITS.find(u => u.convertUnit === 'kg') || targetUnit;
      } else {
        targetUnit = MEASUREMENT_UNITS.find(u => u.convertUnit === 'g') || targetUnit;
      }
    } else {
      // Imperial - choose based on amount
      if (detected.amount >= 1) {
        targetUnit = MEASUREMENT_UNITS.find(u => u.convertUnit === 'lb') || targetUnit;
      } else {
        targetUnit = MEASUREMENT_UNITS.find(u => u.convertUnit === 'oz') || targetUnit;
      }
    }
  }

  if (!detected.unit || !targetUnit) return ingredientText;
  const convertedAmount = convertMeasurement(detected.amount, detected.unit, targetUnit);

  if (convertedAmount === null || !targetUnit?.abbreviations[0]) {
    return ingredientText;
  }

  const formattedAmount = Math.round(convertedAmount * 100) / 100;
  return `${formattedAmount} ${targetUnit.abbreviations[0]!} ${detected.ingredient}`;
}

// Convert measurements in method/instruction text
export function convertMethodText(methodText: string, targetSystem: 'metric' | 'imperial'): string {
  // Create a pattern that matches known measurement units
  const unitAbbreviations = MEASUREMENT_UNITS.flatMap((unit) => unit.abbreviations);
  const unitPattern = unitAbbreviations
    .map((abbr) => abbr.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
    .join('|');

  // Multiple patterns to catch different measurement formats using known units
  const patterns = [
    // Pattern 1: "100g plain flour" or "300ml milk" - number directly followed by unit
    new RegExp(`(\\d+(?:[.,]\\d+)?)\\s*(${unitPattern})(?=\\s|$|[,.!?;])`, 'gi'),
    // Pattern 2: "1 cup water" - number space unit
    new RegExp(`(\\d+(?:[.,]\\d+)?)\\s+(${unitPattern})(?=\\s|$|[,.!?;])`, 'gi'),
    // Pattern 3: "1/2 tsp salt" - fractions with units
    new RegExp(`(\\d+/\\d+)\\s+(${unitPattern})(?=\\s|$|[,.!?;])`, 'gi'),
    // Pattern 4: "2 1/2 cups flour" - mixed numbers
    new RegExp(`(\\d+\\s+\\d+/\\d+)\\s+(${unitPattern})(?=\\s|$|[,.!?;])`, 'gi'),
  ];

  let result = methodText;

  // Apply each pattern
  patterns.forEach((pattern) => {
    result = result.replace(pattern, (match, amountStr, unitStr) => {
      // Clean up the unit string and find matching unit
      const cleanUnitStr = unitStr.toLowerCase().trim();
      const unit = MEASUREMENT_UNITS.find((u) =>
        u.abbreviations.some((abbr) => abbr.toLowerCase() === cleanUnitStr)
      );

      if (!unit || unit.system === targetSystem || unit.system === 'universal') {
        return match;
      }

      // Parse amount (handle fractions and mixed numbers)
      let amount: number;
      if (amountStr.includes('/')) {
        if (amountStr.includes(' ')) {
          // Mixed number like "2 1/2"
          const parts = amountStr.split(' ');
          const whole = parseInt(parts[0]);
          const fractionParts = parts[1].split('/');
          amount = whole + parseInt(fractionParts[0]) / parseInt(fractionParts[1]);
        } else {
          // Simple fraction like "1/2"
          const fractionParts = amountStr.split('/');
          amount = parseInt(fractionParts[0]) / parseInt(fractionParts[1]);
        }
      } else {
        amount = parseFloat(amountStr.replace(',', '.'));
      }

      // Find target unit
      const targetUnits = MEASUREMENT_UNITS.filter(
        (u) => u.system === targetSystem && u.type === unit.type
      );

      if (targetUnits.length === 0) {
        return match;
      }

      // Choose appropriate target unit (similar logic to convertIngredientText)
      let targetUnit = targetUnits[0];
      if (unit.type === 'volume') {
        if (targetSystem === 'metric') {
          const mlUnit = MEASUREMENT_UNITS.find(u => u.convertUnit === 'ml');
          if (!mlUnit) return match;
          const mlAmount = convertMeasurement(amount, unit, mlUnit);
          if (mlAmount && mlAmount >= 1000) {
            targetUnit = MEASUREMENT_UNITS.find(u => u.convertUnit === 'l') || targetUnit;
          } else {
            targetUnit = MEASUREMENT_UNITS.find(u => u.convertUnit === 'ml') || targetUnit;
          }
        } else {
          if (amount >= 0.25) {
            targetUnit = MEASUREMENT_UNITS.find(u => u.convertUnit === 'cup') || targetUnit;
          } else {
            targetUnit = MEASUREMENT_UNITS.find(u => u.convertUnit === 'Tbs') || targetUnit;
          }
        }
      } else if (unit.type === 'weight') {
        if (targetSystem === 'metric') {
          const gUnit = MEASUREMENT_UNITS.find(u => u.convertUnit === 'g');
          if (!gUnit) return match;
          const gAmount = convertMeasurement(amount, unit, gUnit);
          if (gAmount && gAmount >= 1000) {
            targetUnit = MEASUREMENT_UNITS.find(u => u.convertUnit === 'kg') || targetUnit;
          } else {
            targetUnit = MEASUREMENT_UNITS.find(u => u.convertUnit === 'g') || targetUnit;
          }
        } else {
          if (amount >= 1) {
            targetUnit = MEASUREMENT_UNITS.find(u => u.convertUnit === 'lb') || targetUnit;
          } else {
            targetUnit = MEASUREMENT_UNITS.find(u => u.convertUnit === 'oz') || targetUnit;
          }
        }
      }

      if (!unit || !targetUnit) return match;
      const convertedAmount = convertMeasurement(amount, unit, targetUnit);

      if (convertedAmount === null || !targetUnit) {
        return match;
      }

      const formattedAmount = Math.round(convertedAmount * 100) / 100;
      return `${formattedAmount} ${targetUnit.abbreviations[0]!}`;
    });
  });

  return result;
}

export function detectSystemFromIngredients(ingredients: string[]): 'metric' | 'imperial' | 'mixed' {
  const detectedSystems = ingredients
    .map((ing) => detectMeasurement(ing))
    .filter((det) => det.unit && det.unit.system !== 'universal')
    .map((det) => det.unit!.system);

  if (detectedSystems.length === 0) return 'imperial'; // default

  const metricCount = detectedSystems.filter((s) => s === 'metric').length;
  const imperialCount = detectedSystems.filter((s) => s === 'imperial').length;

  if (metricCount > imperialCount * 2) return 'metric';
  if (imperialCount > metricCount * 2) return 'imperial';
  return 'mixed';
}