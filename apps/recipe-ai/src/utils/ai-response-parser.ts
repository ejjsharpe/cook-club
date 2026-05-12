/**
 * Parse JSON from AI response, handling potential markdown code blocks
 * or JSON embedded in other text (e.g., from reasoning models)
 */
export function parseAiJsonResponse<T>(response: string): T {
  let jsonStr = response.trim();

  // Remove markdown code blocks if present
  if (jsonStr.startsWith("```json")) {
    jsonStr = jsonStr.slice(7);
  } else if (jsonStr.startsWith("```")) {
    jsonStr = jsonStr.slice(3);
  }

  if (jsonStr.endsWith("```")) {
    jsonStr = jsonStr.slice(0, -3);
  }

  jsonStr = jsonStr.trim();

  // Try direct parse first
  try {
    return JSON.parse(jsonStr);
  } catch {
    // Try to find the last complete JSON object (reasoning models often output JSON at the end)
    // Look for JSON starting with { "suggestions" or { "ingredients" etc.
    const jsonPatterns = [
      /\{\s*"suggestions"\s*:\s*\[[\s\S]*\]\s*\}/,
      /\{\s*"ingredients"\s*:\s*\[[\s\S]*\]\s*\}/,
      /\{\s*"name"\s*:[\s\S]*\}/,
    ];

    for (const pattern of jsonPatterns) {
      const match = jsonStr.match(pattern);
      if (match) {
        try {
          return JSON.parse(match[0]);
        } catch {
          // Continue to next pattern
        }
      }
    }

    // Last resort: find any JSON object
    const jsonMatch = jsonStr.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      try {
        return JSON.parse(jsonMatch[0]);
      } catch {
        // Fall through to error
      }
    }

    throw new Error(
      `Failed to parse AI response as JSON: ${jsonStr.slice(0, 500)}`,
    );
  }
}
