import ky from 'ky';
import * as cheerio from 'cheerio';
import { URL } from 'url';

export interface Recipe {
  name: string;
  description: string;
  image: string | string[];
  author: string;
  datePublished: string;
  prepTime: string;
  cookTime: string;
  totalTime: string;
  recipeYield: string;
  recipeCategory: string;
  recipeCuisine: string;
  keywords: string;
  nutrition: Record<string, string>;
  recipeIngredient: string[];
  recipeInstructions: string[];
}

const USER_AGENTS = [
  'Mozilla/5.0 (iPhone17,2; CPU iPhone OS 18_3_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Resorts/4.5.2',
  'Mozilla/5.0 (iPhone16,2; CPU iPhone OS 17_5_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Resorts/4.7.5',
  'Mozilla/5.0 (iPhone12,1; U; CPU iPhone OS 13_0 like Mac OS X) AppleWebKit/602.1.50 (KHTML, like Gecko) Version/10.0 Mobile/15E148 Safari/602.1',
  'Mozilla/5.0 (Linux; Android 14; Pixel 9 Pro Build/AD1A.240418.003; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/124.0.6367.54 Mobile Safari/537.36',
  'Mozilla/5.0 (Linux; Android 13; SM-S908B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/112.0.0.0 Mobile Safari/537.36',
  'Mozila/5.0 (Linux; Android 14; SM-S928B/DS) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.6099.230 Mobile Safari/537.36',
  'Mozilla/5.0 (Linux; Android 13; 23129RAA4G Build/TKQ1.221114.001; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/116.0.0.0 Mobile Safari/537.36'
];

function getRandomUserAgent(): string {
  const randomIndex = Math.floor(Math.random() * USER_AGENTS.length);
  return USER_AGENTS[randomIndex] as string;
}

export async function fetchHTMLContent(
  url: string,
  timeout = 10000
): Promise<string> {
  const response = await ky.get(url, {
    headers: { 'User-Agent': getRandomUserAgent() },
    timeout,
    retry: { limit: 2, statusCodes: [408, 429, 500, 502, 503, 504] }
  });
  return response.text();
}

function resolveUrl(baseUrl: string, relativePath: string): string {
  try {
    return new URL(relativePath, baseUrl).href;
  } catch {
    return relativePath;
  }
}

function parseJsonLd($: cheerio.CheerioAPI, baseUrl: string): Partial<Recipe> {
  const result: Partial<Recipe> = {};

  $('script[type="application/ld+json"]').each((_idx, element) => {
    let data;
    try {
      data = JSON.parse($(element).text());
    } catch {
      return;
    }

    const entries = Array.isArray(data)
      ? data
      : data['@graph'] || [data];

    for (const item of entries) {
      const types = Array.isArray(item['@type']) ? item['@type'] : [item['@type']];
      if (!types.includes('Recipe')) continue;

      Object.assign(result, item);

      if (typeof result.image === 'string') {
        result.image = resolveUrl(baseUrl, result.image);
      } else if (Array.isArray(result.image)) {
        result.image = result.image.map(src => resolveUrl(baseUrl, src));
      }

      if (Array.isArray(item.recipeInstructions)) {
        result.recipeInstructions = item.recipeInstructions
          .map((step: any) => (typeof step === 'string' ? step : step.text || ''))
          .filter((text: string) => text.trim() !== '');
      }

      return false;
    }
  });

  return result;
}

function parseMicrodata($: cheerio.CheerioAPI, baseUrl: string): Partial<Recipe> {
  const root = $('[itemtype*="Recipe"]').first();
  if (!root.length) return {};

  function getContent(property: string): string {
    const element = root.find(`[itemprop="${property}"]`).first();
    if (!element.length) return '';
    if (element.is('img')) {
      return resolveUrl(baseUrl, element.attr('src') || '');
    }
    return (element.attr('content') || element.text()).trim();
  }

  function getAllContents(property: string): string[] {
    return root
      .find(`[itemprop="${property}"]`)
      .toArray()
      .map(el => {
        const $el = $(el);
        return ( $el.attr('content') || $el.text() ).trim();
      })
      .filter(text => text !== '');
  }

  const microdata: Partial<Recipe> = {
    name: getContent('name'),
    description: getContent('description'),
    image: getContent('image'),
    author: getContent('author'),
    datePublished: getContent('datePublished'),
    prepTime: getContent('prepTime'),
    cookTime: getContent('cookTime'),
    totalTime: getContent('totalTime'),
    recipeYield: getContent('recipeYield'),
    recipeCategory: getContent('recipeCategory'),
    recipeCuisine: getContent('recipeCuisine'),
    keywords: getContent('keywords'),
    recipeIngredient: getAllContents('recipeIngredient'),
    recipeInstructions: getAllContents('recipeInstructions'),
  };

  const nutritionRoot = root.find('[itemprop="nutrition"]').first();
  if (nutritionRoot.length) {
    const nutrition: Record<string, string> = {};
    nutritionRoot.find('[itemprop]').each((_idx, el) => {
      const $el = $(el);
      const key = $el.attr('itemprop')!;
      const value = ( $el.attr('content') || $el.text() ).trim();
      nutrition[key] = value;
    });
    microdata.nutrition = nutrition;
  }

  return microdata;
}

function chooseValue<K extends keyof Recipe>(
  key: K,
  jsonLd: Partial<Recipe>,
  microdata: Partial<Recipe>,
  defaultValue: Recipe[K]
): Recipe[K] {
  if (jsonLd[key] != null) return jsonLd[key] as Recipe[K];
  if (microdata[key] != null) return microdata[key] as Recipe[K];
  return defaultValue;
}

export async function scrapeRecipe(url: string): Promise<Recipe> {
  const htmlContent = await fetchHTMLContent(url);
  const $ = cheerio.load(htmlContent);

  const jsonLdData = parseJsonLd($, url);
  const microdata = parseMicrodata($, url);

  return {
    name: chooseValue('name', jsonLdData, microdata, ''),
    description: chooseValue('description', jsonLdData, microdata, ''),
    image: chooseValue('image', jsonLdData, microdata, ''),
    author: chooseValue('author', jsonLdData, microdata, ''),
    datePublished: chooseValue('datePublished', jsonLdData, microdata, ''),
    prepTime: chooseValue('prepTime', jsonLdData, microdata, ''),
    cookTime: chooseValue('cookTime', jsonLdData, microdata, ''),
    totalTime: chooseValue('totalTime', jsonLdData, microdata, ''),
    recipeYield: chooseValue('recipeYield', jsonLdData, microdata, ''),
    recipeCategory: chooseValue('recipeCategory', jsonLdData, microdata, ''),
    recipeCuisine: chooseValue('recipeCuisine', jsonLdData, microdata, ''),
    keywords: chooseValue('keywords', jsonLdData, microdata, ''),
    nutrition: { ...(microdata.nutrition || {}), ...(jsonLdData.nutrition || {}) },
    recipeIngredient: chooseValue('recipeIngredient', jsonLdData, microdata, []),
    recipeInstructions: chooseValue('recipeInstructions', jsonLdData, microdata, []),
  };
}
