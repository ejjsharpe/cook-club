import { useState, useEffect } from 'react';
import {
  getMeasurementPreference,
  setMeasurementPreference,
  MeasurementSystem,
} from '@/lib/measurementPreferences';
import {
  detectSystemFromIngredients,
  convertIngredientText,
  convertMethodText,
} from '@/utils/measurementUtils';

export interface UseRecipeMeasurementConversionProps {
  ingredients: string[];
  method: string[];
}

export function useRecipeMeasurementConversion({
  ingredients,
  method,
}: UseRecipeMeasurementConversionProps) {
  const [measurementSystem, setMeasurementSystem] = useState<MeasurementSystem>(
    getMeasurementPreference() || 'auto'
  );
  const [convertedIngredients, setConvertedIngredients] = useState<string[]>([]);
  const [convertedMethod, setConvertedMethod] = useState<string[]>([]);

  // Update converted ingredients when measurement system or ingredients change
  useEffect(() => {
    if (ingredients.length > 0) {
      updateConvertedIngredients(ingredients, measurementSystem);
    }
  }, [measurementSystem, ingredients]);

  // Update converted method when measurement system or method changes
  useEffect(() => {
    if (method.length > 0) {
      updateConvertedMethod(method, measurementSystem);
    }
  }, [measurementSystem, method]);

  const updateConvertedIngredients = (ingredientList: string[], system: MeasurementSystem) => {
    if (system === 'auto') {
      setConvertedIngredients(ingredientList);
      return;
    }

    const converted = ingredientList.map((ingredient) => {
      if (!ingredient.trim()) return ingredient;
      return convertIngredientText(ingredient, system);
    });

    setConvertedIngredients(converted);
  };

  const updateConvertedMethod = (methodList: string[], system: MeasurementSystem) => {
    if (system === 'auto') {
      setConvertedMethod(methodList);
      return;
    }

    const converted = methodList.map((methodStep) => {
      if (!methodStep.trim()) return methodStep;
      return convertMethodText(methodStep, system);
    });

    setConvertedMethod(converted);
  };

  const handleMeasurementSystemChange = (system: MeasurementSystem) => {
    setMeasurementSystem(system);
    setMeasurementPreference(system);
  };

  const getDisplayIngredients = () => {
    return measurementSystem === 'auto' ? ingredients : convertedIngredients;
  };

  const getDisplayMethod = () => {
    return measurementSystem === 'auto' ? method : convertedMethod;
  };

  const getDetectedSystem = () => {
    return detectSystemFromIngredients(ingredients);
  };

  return {
    measurementSystem,
    convertedIngredients,
    convertedMethod,
    displayIngredients: getDisplayIngredients(),
    displayMethod: getDisplayMethod(),
    detectedSystem: getDetectedSystem(),
    handleMeasurementSystemChange,
  };
}
