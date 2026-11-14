// public/coffee.json (tools/build_coffee_data.py) → the Quán cà phê page (event 一日店长).
// Only customer names have Vietnamese (owner 2026-11-14); recipes and ingredients are Chinese only.
export type CoffeeCustomer = { id: string; name_cn: string; name_vi: string; slug: string; avatar: string }; // avatar: NPCs only
export type CoffeeIngredient = { id: string; slot: 1 | 2 | 3; lv: number; name_cn: string; icon: string; tag: string; desc_cn: string };
export type CoffeeRecipe = { id: string; lv: number; name_cn: string; hint_cn: string; tags: string[]; mats: string[]; customer: CoffeeCustomer };
export type CoffeeDoc = { version: string; ingredients: CoffeeIngredient[]; recipes: CoffeeRecipe[]; shop: { lv: number; need: number; name_cn: string }[] };

// ponytail: one copy per page load, like music.json; a failed load is not kept.
let cached: CoffeeDoc | null = null;
export const cachedCoffee = () => cached;
export async function loadCoffeeCached(fetchImpl: typeof fetch = fetch): Promise<CoffeeDoc | null> {
  if (cached) return cached;
  try {
    const res = await fetchImpl('/coffee.json');
    const doc = res.ok ? await res.json() : null;
    return (cached = Array.isArray(doc?.recipes) ? (doc as CoffeeDoc) : null);
  } catch {
    return null;
  }
}

/** Every space-separated word must appear in the hint, the recipe, an ingredient or the customer (CN or VI, accents ignored). */
const fold = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd');
export function filterRecipes(doc: CoffeeDoc, query: string): CoffeeRecipe[] {
  const words = fold(query).split(/\s+/).filter(Boolean);
  if (!words.length) return doc.recipes;
  const mat = new Map(doc.ingredients.map((m) => [m.id, m]));
  return doc.recipes.filter((r) => {
    const hay = fold([r.hint_cn, r.name_cn, r.customer.name_cn, r.customer.name_vi, ...r.mats.map((id) => mat.get(id)?.name_cn ?? '')].join(' '));
    return words.every((w) => hay.includes(w));
  });
}
