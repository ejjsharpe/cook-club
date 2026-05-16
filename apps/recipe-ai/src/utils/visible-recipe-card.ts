import * as cheerio from "cheerio";
import type { Element } from "domhandler";

import type {
  IngredientSection,
  Instruction,
  InstructionSection,
  ParsedRecipe,
} from "../schema";
import { parseIngredientText } from "./ingredient-parser";

function normalizeText(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function parseMinutes(text: string, label: string): number | null {
  const match = text.match(
    new RegExp(
      `${label}\\s+(?:(\\d+)\\s+hours?\\s*)?(?:(\\d+)\\s+minutes?)?`,
      "i",
    ),
  );
  if (!match) return null;

  const hours = Number(match[1] ?? 0);
  const minutes = Number(match[2] ?? 0);
  const total = hours * 60 + minutes;
  return total > 0 ? total : null;
}

function parseServings(text: string): number | null {
  const range = text.match(/serves?\s+(\d+)\s+to\s+(\d+)/i);
  if (range) {
    return Math.round((Number(range[1]) + Number(range[2])) / 2);
  }

  const single = text.match(/serves?\s+(\d+)/i);
  return single ? Number(single[1]) : null;
}

function isHeading($: cheerio.CheerioAPI, el: Element): boolean {
  return /^h[1-6]$/i.test(el.tagName) || $(el).attr("role") === "heading";
}

function headingText($: cheerio.CheerioAPI, el: Element): string {
  return normalizeText($(el).text()).replace(/:$/, "");
}

function extractRecipeTitle($: cheerio.CheerioAPI): string {
  return normalizeText($("h1").first().text());
}

function extractRecipeDescription(
  $: cheerio.CheerioAPI,
  title: string,
): string | null {
  const recipeHeading = $("h1, h2, h3")
    .filter(
      (_, el) =>
        headingText($, el).toLowerCase() === `${title} recipe`.toLowerCase(),
    )
    .first();

  if (recipeHeading.length) {
    const nextText = normalizeText(recipeHeading.nextAll("p").first().text());
    return nextText || null;
  }

  const firstParagraph = normalizeText($("article p").first().text());
  return firstParagraph || null;
}

function extractIngredientSections(
  $: cheerio.CheerioAPI,
  ingredientsHeading: Element,
  instructionsHeading: Element,
): IngredientSection[] {
  const sections: IngredientSection[] = [];
  let currentSection: { name: string | null; items: string[] } = {
    name: null,
    items: [],
  };

  const elements = $(ingredientsHeading)
    .nextUntil(instructionsHeading)
    .toArray();
  for (const el of elements) {
    if (isHeading($, el)) {
      if (currentSection.items.length > 0) {
        sections.push({
          name: currentSection.name,
          ingredients: currentSection.items.map((item, index) => ({
            index,
            ...parseIngredientText(item),
          })),
        });
      }
      currentSection = { name: headingText($, el), items: [] };
      continue;
    }

    if (el.tagName === "li") {
      const item = normalizeText($(el).text());
      if (item) currentSection.items.push(item);
      continue;
    }

    $(el)
      .find("li")
      .each((_, li) => {
        const item = normalizeText($(li).text());
        if (item) currentSection.items.push(item);
      });
  }

  if (currentSection.items.length > 0) {
    sections.push({
      name: currentSection.name,
      ingredients: currentSection.items.map((item, index) => ({
        index,
        ...parseIngredientText(item),
      })),
    });
  }

  return sections;
}

function extractInstructionSections(
  $: cheerio.CheerioAPI,
  instructionsHeading: Element,
): InstructionSection[] {
  const sections: InstructionSection[] = [];
  let currentSection: { name: string | null; items: string[] } = {
    name: null,
    items: [],
  };

  const stopHeadings = new Set([
    "recipe notes",
    "reviews",
    "filed in",
    "more to love from the kitchn",
  ]);

  const elements = $(instructionsHeading).nextAll().toArray();
  for (const el of elements) {
    if (isHeading($, el)) {
      const title = headingText($, el);
      if (stopHeadings.has(title.toLowerCase())) break;

      if (currentSection.items.length > 0) {
        sections.push({
          name: currentSection.name,
          instructions: currentSection.items.map<Instruction>(
            (item, index) => ({
              index,
              instruction: item,
              imageUrl: null,
            }),
          ),
        });
      }
      currentSection = { name: title, items: [] };
      continue;
    }

    if (el.tagName === "li") {
      const item = normalizeText($(el).text());
      if (item) currentSection.items.push(item);
      continue;
    }

    $(el)
      .find("li")
      .each((_, li) => {
        const item = normalizeText($(li).text());
        if (item) currentSection.items.push(item);
      });
  }

  if (currentSection.items.length > 0) {
    sections.push({
      name: currentSection.name,
      instructions: currentSection.items.map<Instruction>((item, index) => ({
        index,
        instruction: item,
        imageUrl: null,
      })),
    });
  }

  return sections;
}

export function extractVisibleRecipeCard(
  html: string,
  sourceUrl: string,
): ParsedRecipe | null {
  const $ = cheerio.load(html);
  const allText = normalizeText($.root().text());
  const title = extractRecipeTitle($);
  if (!title) return null;

  const ingredientsHeading = $("h1, h2, h3")
    .filter((_, el) => headingText($, el).toLowerCase() === "ingredients")
    .first();
  const instructionsHeading = $("h1, h2, h3")
    .filter((_, el) => headingText($, el).toLowerCase() === "instructions")
    .first();

  if (!ingredientsHeading.length || !instructionsHeading.length) {
    return null;
  }

  const ingredientSections = extractIngredientSections(
    $,
    ingredientsHeading[0]!,
    instructionsHeading[0]!,
  );
  const instructionSections = extractInstructionSections(
    $,
    instructionsHeading[0]!,
  );

  if (ingredientSections.length === 0 || instructionSections.length === 0) {
    return null;
  }

  return {
    name: title,
    description: extractRecipeDescription($, title),
    prepTime: parseMinutes(allText, "prep(?:\\s+time)?"),
    cookTime: parseMinutes(allText, "cook(?:\\s+time)?"),
    totalTime: null,
    servings: parseServings(allText),
    sourceUrl,
    sourceType: "url",
    ingredientSections,
    instructionSections,
    images: [],
    suggestedTags: [],
  };
}

function titleFromSourceUrl(sourceUrl: string): string {
  try {
    const pathname = new URL(sourceUrl).pathname;
    const slug = pathname.split("/").filter(Boolean).at(-1) ?? "";
    return slug
      .replace(/-\d+$/, "")
      .replace(/-recipe$/, "")
      .split("-")
      .filter(Boolean)
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(" ");
  } catch {
    return "";
  }
}

function descriptionFromMarkdown(markdown: string): string | null {
  const content = markdown.split("Markdown Content:").at(1) ?? markdown;
  const ingredientsIndex = content.toLowerCase().indexOf("### ingredients");
  const preRecipeContent =
    ingredientsIndex === -1 ? content : content.slice(0, ingredientsIndex);
  const lines = content
    .split("\n")
    .map((line) =>
      normalizeText(
        line
          .replace(/\[\]\([^)]+\)/g, "")
          .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1"),
      ),
    )
    .filter(Boolean);

  const rawRecipeLines = preRecipeContent
    .split("\n")
    .map((line) =>
      normalizeText(
        line
          .replace(/\[\]\([^)]+\)/g, "")
          .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1"),
      ),
    )
    .filter(Boolean);

  const metricIndex = rawRecipeLines.findIndex((line) =>
    /\b(serves?\s+\d+|prep(?:\s+time)?\s+\d+|cook(?:\s+time)?\s+\d+)/i.test(
      line,
    ),
  );
  const recipeLines =
    metricIndex === -1 ? rawRecipeLines : rawRecipeLines.slice(0, metricIndex);

  const isUsefulDescription = (line: string) => {
    const lower = line.toLowerCase();
    return (
      !line.startsWith("*") &&
      !line.startsWith("#") &&
      !line.startsWith("!") &&
      !line.startsWith("Title:") &&
      !lower.includes("read more") &&
      !lower.includes("follow") &&
      !lower.startsWith("published ") &&
      !lower.startsWith("prep time") &&
      !lower.startsWith("cook time") &&
      !lower.startsWith("serves ") &&
      !lower.includes("nutritional info") &&
      line.length > 40
    );
  };

  return (
    [...recipeLines].reverse().find(isUsefulDescription) ??
    lines.find(isUsefulDescription) ??
    null
  );
}

function imageUrlsFromMarkdown(markdown: string): string[] {
  const recipeNotesIndex = markdown.search(/^###\s+Recipe Notes/im);
  const relevantMarkdown =
    recipeNotesIndex === -1 ? markdown : markdown.slice(0, recipeNotesIndex);

  return [...relevantMarkdown.matchAll(/!\[([^\]]*)\]\(([^)]+)\)/g)]
    .map((match) => ({
      alt: normalizeText(match[1] ?? ""),
      url: normalizeText(match[2] ?? ""),
    }))
    .filter(({ url }) => /^https?:\/\//i.test(url))
    .filter(({ alt, url }) => {
      const lowerAlt = alt.toLowerCase();
      const lowerUrl = url.toLowerCase();
      return (
        !lowerAlt.includes("powered by") &&
        !lowerAlt.includes("author") &&
        !lowerUrl.includes("/api/v1/") &&
        !lowerUrl.includes("ad.gt") &&
        !lowerUrl.includes("adnxs") &&
        !lowerUrl.includes("pubmatic") &&
        !lowerUrl.includes("rubiconproject") &&
        !lowerUrl.includes("adsrvr") &&
        !lowerUrl.includes("avatar") &&
        !lowerUrl.includes("logo")
      );
    })
    .map(({ url }) => url);
}

function stripMarkdownFormatting(value: string): string {
  return normalizeText(
    value
      .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
      .replace(/\*\*([^*]+)\*\*/g, "$1")
      .replace(/^[#*\s-]+/, "")
      .replace(/:$/, ""),
  );
}

function parseMarkdownRecipeBlocks(markdown: string): {
  ingredientSections: IngredientSection[];
  instructionSections: InstructionSection[];
} {
  const ingredientsIndex = markdown.toLowerCase().indexOf("### ingredients");
  if (ingredientsIndex === -1) {
    return { ingredientSections: [], instructionSections: [] };
  }

  const recipeMarkdown = markdown.slice(ingredientsIndex);
  const lines = recipeMarkdown.split("\n");
  const ingredientSections: { name: string | null; items: string[] }[] = [];
  const instructionSections: { name: string | null; items: string[] }[] = [];
  let currentKind: "ingredients" | "instructions" = "ingredients";
  let currentIngredientSection: { name: string | null; items: string[] } = {
    name: null,
    items: [],
  };
  let currentInstructionSection: { name: string | null; items: string[] } = {
    name: null,
    items: [],
  };
  let currentListItem: {
    kind: "ingredient" | "instruction";
    value: string;
  } | null = null;

  const flushListItem = () => {
    if (!currentListItem) return;
    const value = stripMarkdownFormatting(currentListItem.value);
    if (value) {
      if (currentListItem.kind === "ingredient") {
        currentIngredientSection.items.push(value);
      } else {
        currentInstructionSection.items.push(value);
      }
    }
    currentListItem = null;
  };

  const flushIngredientSection = () => {
    flushListItem();
    if (currentIngredientSection.items.length > 0) {
      ingredientSections.push(currentIngredientSection);
    }
  };

  const flushInstructionSection = () => {
    flushListItem();
    if (currentInstructionSection.items.length > 0) {
      instructionSections.push(currentInstructionSection);
    }
  };

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;

    if (/^###\s+(recipe notes|reviews|filed in|more to love)/i.test(line)) {
      break;
    }

    if (/^###\s+instructions/i.test(line)) {
      flushIngredientSection();
      currentKind = "instructions";
      currentInstructionSection = { name: null, items: [] };
      continue;
    }

    const heading = line.match(/^#{4,6}\s+(.+)$/);
    if (heading) {
      flushListItem();
      const headingName = stripMarkdownFormatting(heading[1]!);
      const isIngredientHeading =
        currentKind === "ingredients" && /^for\b/i.test(headingName);

      if (isIngredientHeading) {
        flushIngredientSection();
        currentIngredientSection = { name: headingName, items: [] };
      } else {
        if (currentKind === "ingredients") {
          flushIngredientSection();
          currentKind = "instructions";
        } else {
          flushInstructionSection();
        }
        currentInstructionSection = { name: headingName, items: [] };
      }
      continue;
    }

    const bullet = line.match(/^\*\s+(.+)$/);
    if (bullet && currentKind === "ingredients") {
      flushListItem();
      currentListItem = { kind: "ingredient", value: bullet[1]! };
      continue;
    }

    const numbered = line.match(/^\d+\.\s+(.+)$/);
    if (numbered) {
      if (currentKind === "ingredients") {
        flushIngredientSection();
        currentKind = "instructions";
      }
      flushListItem();
      currentListItem = { kind: "instruction", value: numbered[1]! };
      continue;
    }

    if (currentListItem) {
      currentListItem.value = `${currentListItem.value} ${line}`;
    }
  }

  if (currentKind === "ingredients") {
    flushIngredientSection();
  } else {
    flushInstructionSection();
  }

  return {
    ingredientSections: ingredientSections.map((section) => ({
      name: section.name,
      ingredients: section.items.map((item, index) => ({
        index,
        ...parseIngredientText(item),
      })),
    })),
    instructionSections: instructionSections.map((section) => ({
      name: section.name,
      instructions: section.items.map((item, index) => ({
        index,
        instruction: item,
        imageUrl: null,
      })),
    })),
  };
}

export function extractMarkdownRecipeCard(
  markdown: string,
  sourceUrl: string,
): ParsedRecipe | null {
  const { ingredientSections, instructionSections } =
    parseMarkdownRecipeBlocks(markdown);

  if (ingredientSections.length === 0 || instructionSections.length === 0) {
    return null;
  }

  const allText = normalizeText(markdown);

  return {
    name: titleFromSourceUrl(sourceUrl),
    description: descriptionFromMarkdown(markdown),
    prepTime: parseMinutes(allText, "prep(?:\\s+time)?"),
    cookTime: parseMinutes(allText, "cook(?:\\s+time)?"),
    totalTime: null,
    servings: parseServings(allText),
    sourceUrl,
    sourceType: "url",
    ingredientSections,
    instructionSections,
    images: imageUrlsFromMarkdown(markdown),
    suggestedTags: [],
  };
}
