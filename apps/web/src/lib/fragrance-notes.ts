import type { FragranceFamily } from "./fragrance-families";
import { PT_SLOTS } from "./fragrance-pt-slots";

export type FragranceLayer = "top" | "heart" | "base";

export type FragranceNote = {
  id: string;
  code: string;
  symbol: string;
  name: string;
  family: FragranceFamily;
  layer: FragranceLayer;
  intensity: number;
  freshness: number;
  longevity: number;
  column: number;
  row: number;
  compatibleWith?: string[];
};

type NoteSeed = {
  symbol: string;
  name: string;
  family: FragranceFamily;
  layer: FragranceLayer;
  intensity: number;
  freshness: number;
  longevity: number;
  compatibleWith?: string[];
};

const SEEDS: NoteSeed[] = [
  // Period 1 — citrus
  { symbol: "Le", name: "Lemon", family: "Citrus", layer: "top", intensity: 8, freshness: 10, longevity: 3, compatibleWith: ["Bergamot", "Green Tea"] },
  { symbol: "Be", name: "Bergamot", family: "Citrus", layer: "top", intensity: 7, freshness: 9, longevity: 4, compatibleWith: ["Lemon", "Neroli"] },
  // Period 2 — citrus + aquatic
  { symbol: "Or", name: "Orange", family: "Citrus", layer: "top", intensity: 7, freshness: 9, longevity: 4, compatibleWith: ["Cinnamon", "Vanilla"] },
  { symbol: "Md", name: "Mandarin", family: "Citrus", layer: "top", intensity: 6, freshness: 9, longevity: 3, compatibleWith: ["Orange Blossom", "Neroli"] },
  { symbol: "Gf", name: "Grapefruit", family: "Citrus", layer: "top", intensity: 8, freshness: 10, longevity: 3, compatibleWith: ["Pink Pepper", "Vetiver"] },
  { symbol: "Lm", name: "Lime", family: "Citrus", layer: "top", intensity: 8, freshness: 10, longevity: 3, compatibleWith: ["Basil", "Rosemary"] },
  { symbol: "Yu", name: "Yuzu", family: "Citrus", layer: "top", intensity: 7, freshness: 10, longevity: 3, compatibleWith: ["Green Tea", "Lime"] },
  { symbol: "Ct", name: "Citron", family: "Citrus", layer: "top", intensity: 7, freshness: 9, longevity: 4, compatibleWith: ["Lemon", "Cedar"] },
  { symbol: "Ss", name: "Sea Salt", family: "Aquatic", layer: "top", intensity: 5, freshness: 9, longevity: 5, compatibleWith: ["Marine", "Driftwood"] },
  { symbol: "Mr", name: "Marine", family: "Aquatic", layer: "top", intensity: 6, freshness: 10, longevity: 4, compatibleWith: ["Sea Salt", "Driftwood"] },
  // Period 3 — green + aromatic
  { symbol: "Gt", name: "Green Tea", family: "Green", layer: "top", intensity: 5, freshness: 8, longevity: 5, compatibleWith: ["Lemon", "Jasmine"] },
  { symbol: "Gs", name: "Grass", family: "Green", layer: "top", intensity: 6, freshness: 8, longevity: 4, compatibleWith: ["Galbanum", "Violet Leaf"] },
  { symbol: "Fl", name: "Fig Leaf", family: "Green", layer: "heart", intensity: 6, freshness: 7, longevity: 6, compatibleWith: ["Fig", "Coconut"] },
  { symbol: "Vl", name: "Violet Leaf", family: "Green", layer: "heart", intensity: 5, freshness: 7, longevity: 6, compatibleWith: ["Violet", "Iris"] },
  { symbol: "Gb", name: "Galbanum", family: "Green", layer: "top", intensity: 8, freshness: 8, longevity: 5, compatibleWith: ["Pine", "Oakmoss"] },
  { symbol: "Ba", name: "Basil", family: "Aromatic", layer: "top", intensity: 7, freshness: 8, longevity: 4, compatibleWith: ["Lime", "Thyme"] },
  { symbol: "Rm", name: "Rosemary", family: "Aromatic", layer: "top", intensity: 7, freshness: 8, longevity: 5, compatibleWith: ["Thyme", "Cedar"] },
  { symbol: "Ty", name: "Thyme", family: "Aromatic", layer: "top", intensity: 7, freshness: 7, longevity: 5, compatibleWith: ["Basil", "Leather"] },
  // Period 4 — floral
  { symbol: "Ro", name: "Rose", family: "Floral", layer: "heart", intensity: 8, freshness: 5, longevity: 8, compatibleWith: ["Oud", "Patchouli"] },
  { symbol: "Ja", name: "Jasmine", family: "Floral", layer: "heart", intensity: 9, freshness: 4, longevity: 8, compatibleWith: ["Sandalwood", "Orange Blossom"] },
  { symbol: "Ne", name: "Neroli", family: "Floral", layer: "heart", intensity: 7, freshness: 7, longevity: 6, compatibleWith: ["Bergamot", "Orange Blossom"] },
  { symbol: "Ob", name: "Orange Blossom", family: "Floral", layer: "heart", intensity: 7, freshness: 6, longevity: 7, compatibleWith: ["Neroli", "Honey"] },
  { symbol: "Tu", name: "Tuberose", family: "Floral", layer: "heart", intensity: 9, freshness: 3, longevity: 8, compatibleWith: ["Ylang-Ylang", "Coconut"] },
  { symbol: "Yl", name: "Ylang-Ylang", family: "Floral", layer: "heart", intensity: 8, freshness: 4, longevity: 7, compatibleWith: ["Jasmine", "Mango"] },
  { symbol: "Ir", name: "Iris", family: "Floral", layer: "heart", intensity: 6, freshness: 5, longevity: 8, compatibleWith: ["Orris", "Violet"] },
  { symbol: "Vi", name: "Violet", family: "Floral", layer: "heart", intensity: 5, freshness: 6, longevity: 6, compatibleWith: ["Iris", "Violet Leaf"] },
  { symbol: "Gd", name: "Gardenia", family: "Floral", layer: "heart", intensity: 8, freshness: 4, longevity: 7, compatibleWith: ["Tuberose", "Vanilla"] },
  { symbol: "Mg", name: "Magnolia", family: "Floral", layer: "heart", intensity: 6, freshness: 6, longevity: 6, compatibleWith: ["Lemon", "White Musk"] },
  { symbol: "Pe", name: "Peony", family: "Floral", layer: "heart", intensity: 5, freshness: 6, longevity: 5, compatibleWith: ["Rose", "Lychee"] },
  { symbol: "Fr", name: "Freesia", family: "Floral", layer: "heart", intensity: 5, freshness: 7, longevity: 5, compatibleWith: ["Lily", "Pear"] },
  { symbol: "Ly", name: "Lily", family: "Floral", layer: "heart", intensity: 7, freshness: 6, longevity: 6, compatibleWith: ["Muguet", "Freesia"] },
  { symbol: "Mu", name: "Muguet", family: "Floral", layer: "heart", intensity: 6, freshness: 7, longevity: 5, compatibleWith: ["Lily", "Green Tea"] },
  { symbol: "Hn", name: "Honeysuckle", family: "Floral", layer: "heart", intensity: 6, freshness: 6, longevity: 6, compatibleWith: ["Jasmine", "Honey"] },
  { symbol: "Ge", name: "Geranium", family: "Floral", layer: "heart", intensity: 7, freshness: 6, longevity: 6, compatibleWith: ["Rose", "Basil"] },
  { symbol: "Os", name: "Osmanthus", family: "Floral", layer: "heart", intensity: 6, freshness: 5, longevity: 7, compatibleWith: ["Peach", "Leather"] },
  { symbol: "Nc", name: "Narcissus", family: "Floral", layer: "heart", intensity: 7, freshness: 4, longevity: 6, compatibleWith: ["Honeysuckle", "Honey"] },
  // Period 5 — fruity + spicy
  { symbol: "Ap", name: "Apple", family: "Fruity", layer: "top", intensity: 5, freshness: 8, longevity: 4, compatibleWith: ["Cinnamon", "Cedar"] },
  { symbol: "Pr", name: "Pear", family: "Fruity", layer: "top", intensity: 5, freshness: 8, longevity: 4, compatibleWith: ["Freesia", "Peony"] },
  { symbol: "Pc", name: "Peach", family: "Fruity", layer: "heart", intensity: 6, freshness: 7, longevity: 5, compatibleWith: ["Vanilla", "Jasmine"] },
  { symbol: "Pl", name: "Plum", family: "Fruity", layer: "heart", intensity: 6, freshness: 5, longevity: 6, compatibleWith: ["Cinnamon", "Patchouli"] },
  { symbol: "Rs", name: "Raspberry", family: "Fruity", layer: "heart", intensity: 6, freshness: 7, longevity: 5, compatibleWith: ["Rose", "Patchouli"] },
  { symbol: "St", name: "Strawberry", family: "Fruity", layer: "top", intensity: 6, freshness: 7, longevity: 4, compatibleWith: ["Vanilla", "Peach"] },
  { symbol: "Bc", name: "Blackcurrant", family: "Fruity", layer: "top", intensity: 7, freshness: 7, longevity: 5, compatibleWith: ["Rose", "Green Tea"] },
  { symbol: "Pa", name: "Pineapple", family: "Fruity", layer: "top", intensity: 7, freshness: 8, longevity: 4, compatibleWith: ["Ambergris", "Birch"] },
  { symbol: "Cc", name: "Coconut", family: "Fruity", layer: "heart", intensity: 6, freshness: 5, longevity: 7, compatibleWith: ["Tuberose", "Vanilla"] },
  { symbol: "Fg", name: "Fig", family: "Fruity", layer: "heart", intensity: 6, freshness: 6, longevity: 7, compatibleWith: ["Fig Leaf", "Coconut"] },
  { symbol: "Cy", name: "Cherry", family: "Fruity", layer: "heart", intensity: 6, freshness: 6, longevity: 5, compatibleWith: ["Almond", "Rose"] },
  { symbol: "Mo", name: "Mango", family: "Fruity", layer: "top", intensity: 7, freshness: 7, longevity: 4, compatibleWith: ["Ylang-Ylang", "Coconut"] },
  { symbol: "Lh", name: "Lychee", family: "Fruity", layer: "top", intensity: 6, freshness: 8, longevity: 4, compatibleWith: ["Peony", "Rose"] },
  { symbol: "Pp", name: "Pink Pepper", family: "Spicy", layer: "top", intensity: 7, freshness: 7, longevity: 5, compatibleWith: ["Rose", "Grapefruit"] },
  { symbol: "Bp", name: "Black Pepper", family: "Spicy", layer: "top", intensity: 8, freshness: 6, longevity: 6, compatibleWith: ["Cedar", "Leather"] },
  { symbol: "Cd", name: "Cardamom", family: "Spicy", layer: "top", intensity: 7, freshness: 6, longevity: 6, compatibleWith: ["Coffee", "Vanilla"] },
  { symbol: "Cn", name: "Cinnamon", family: "Spicy", layer: "heart", intensity: 8, freshness: 4, longevity: 7, compatibleWith: ["Orange", "Vanilla"] },
  { symbol: "Cv", name: "Clove", family: "Spicy", layer: "heart", intensity: 8, freshness: 3, longevity: 7, compatibleWith: ["Rose", "Cinnamon"] },
  // Period 6 s-block — woody
  { symbol: "Ce", name: "Cedar", family: "Woody", layer: "base", intensity: 6, freshness: 5, longevity: 8, compatibleWith: ["Vetiver", "Amber"] },
  { symbol: "Sw", name: "Sandalwood", family: "Woody", layer: "base", intensity: 6, freshness: 3, longevity: 9, compatibleWith: ["Jasmine", "Vanilla"] },
  // f-block row 9 — powdery
  { symbol: "Oi", name: "Orris", family: "Powdery", layer: "heart", intensity: 6, freshness: 4, longevity: 9, compatibleWith: ["Iris", "Violet"] },
  { symbol: "Ht", name: "Heliotrope", family: "Powdery", layer: "heart", intensity: 6, freshness: 4, longevity: 7, compatibleWith: ["Almond", "Vanilla"] },
  { symbol: "Al", name: "Almond", family: "Powdery", layer: "heart", intensity: 6, freshness: 4, longevity: 7, compatibleWith: ["Cherry", "Heliotrope"] },
  { symbol: "Ri", name: "Rice", family: "Powdery", layer: "heart", intensity: 4, freshness: 5, longevity: 6, compatibleWith: ["Fig", "Sandalwood"] },
  { symbol: "Hx", name: "Hawthorn", family: "Powdery", layer: "heart", intensity: 5, freshness: 5, longevity: 6, compatibleWith: ["Mimosa", "Honey"] },
  { symbol: "Pw", name: "Powder", family: "Powdery", layer: "heart", intensity: 4, freshness: 4, longevity: 6, compatibleWith: ["Iris", "White Musk"] },
  { symbol: "Io", name: "Ionone", family: "Powdery", layer: "heart", intensity: 5, freshness: 5, longevity: 7, compatibleWith: ["Violet", "Orris"] },
  { symbol: "Ll", name: "Lilac", family: "Powdery", layer: "heart", intensity: 5, freshness: 6, longevity: 5, compatibleWith: ["Muguet", "Heliotrope"] },
  { symbol: "Mm", name: "Mimosa", family: "Powdery", layer: "heart", intensity: 5, freshness: 5, longevity: 6, compatibleWith: ["Hawthorn", "Almond"] },
  { symbol: "Tc", name: "Talcum", family: "Powdery", layer: "heart", intensity: 3, freshness: 4, longevity: 6, compatibleWith: ["Iris", "White Musk"] },
  { symbol: "Ip", name: "Iris Pallida", family: "Powdery", layer: "base", intensity: 6, freshness: 4, longevity: 9, compatibleWith: ["Orris", "Cedar"] },
  { symbol: "Mk", name: "Musk Mallow", family: "Powdery", layer: "base", intensity: 5, freshness: 4, longevity: 8, compatibleWith: ["Ambrette", "White Musk"] },
  { symbol: "Hp", name: "Heliotropin", family: "Powdery", layer: "heart", intensity: 5, freshness: 4, longevity: 7, compatibleWith: ["Heliotrope", "Vanilla"] },
  { symbol: "Wi", name: "White Iris", family: "Powdery", layer: "heart", intensity: 5, freshness: 5, longevity: 8, compatibleWith: ["Iris", "Powder"] },
  { symbol: "Nv", name: "Niveous", family: "Powdery", layer: "heart", intensity: 4, freshness: 6, longevity: 6, compatibleWith: ["Talcum", "White Musk"] },
  // Period 6 remainder — woody, amber, gourmand, musk
  { symbol: "Ve", name: "Vetiver", family: "Woody", layer: "base", intensity: 7, freshness: 6, longevity: 9, compatibleWith: ["Grapefruit", "Smoke"] },
  { symbol: "Ph", name: "Patchouli", family: "Woody", layer: "base", intensity: 8, freshness: 2, longevity: 10, compatibleWith: ["Rose", "Chocolate"] },
  { symbol: "Om", name: "Oakmoss", family: "Woody", layer: "base", intensity: 7, freshness: 3, longevity: 9, compatibleWith: ["Galbanum", "Leather"] },
  { symbol: "Gw", name: "Guaiacwood", family: "Woody", layer: "base", intensity: 6, freshness: 3, longevity: 8, compatibleWith: ["Smoke", "Vanilla"] },
  { symbol: "Ou", name: "Oud", family: "Woody", layer: "base", intensity: 9, freshness: 1, longevity: 10, compatibleWith: ["Rose", "Saffron"] },
  { symbol: "Cx", name: "Cypress", family: "Woody", layer: "heart", intensity: 6, freshness: 6, longevity: 7, compatibleWith: ["Pine", "Cedar"] },
  { symbol: "Pi", name: "Pine", family: "Woody", layer: "heart", intensity: 6, freshness: 7, longevity: 6, compatibleWith: ["Galbanum", "Cypress"] },
  { symbol: "Bi", name: "Birch", family: "Woody", layer: "base", intensity: 7, freshness: 5, longevity: 8, compatibleWith: ["Leather", "Birch Tar"] },
  { symbol: "Am", name: "Amber", family: "Amber", layer: "base", intensity: 7, freshness: 2, longevity: 9, compatibleWith: ["Vanilla", "Labdanum"] },
  { symbol: "Lb", name: "Labdanum", family: "Amber", layer: "base", intensity: 8, freshness: 2, longevity: 9, compatibleWith: ["Amber", "Leather"] },
  { symbol: "Bz", name: "Benzoin", family: "Amber", layer: "base", intensity: 6, freshness: 2, longevity: 8, compatibleWith: ["Vanilla", "Tonka"] },
  { symbol: "Va", name: "Vanilla", family: "Gourmand", layer: "base", intensity: 7, freshness: 2, longevity: 9, compatibleWith: ["Tonka", "Sandalwood"] },
  { symbol: "Tk", name: "Tonka", family: "Gourmand", layer: "base", intensity: 7, freshness: 2, longevity: 9, compatibleWith: ["Vanilla", "Coumarin"] },
  { symbol: "Cm", name: "Coumarin", family: "Gourmand", layer: "base", intensity: 6, freshness: 3, longevity: 8, compatibleWith: ["Tonka", "Vanilla"] },
  { symbol: "Ca", name: "Cashmeran", family: "Musk", layer: "base", intensity: 5, freshness: 3, longevity: 9, compatibleWith: ["Cedar", "White Musk"] },
  // Period 7 s-block
  { symbol: "Ie", name: "Iso E Super", family: "Woody", layer: "base", intensity: 4, freshness: 4, longevity: 10, compatibleWith: ["Cedar", "Ambroxan"] },
  { symbol: "Ax", name: "Ambroxan", family: "Amber", layer: "base", intensity: 5, freshness: 4, longevity: 10, compatibleWith: ["Iso E Super", "Sea Salt"] },
  // f-block row 10 — leather, smoky, resins
  { symbol: "Lt", name: "Leather", family: "Leather", layer: "base", intensity: 8, freshness: 2, longevity: 9, compatibleWith: ["Birch", "Saffron"] },
  { symbol: "Su", name: "Suede", family: "Leather", layer: "base", intensity: 6, freshness: 3, longevity: 8, compatibleWith: ["Iris", "White Musk"] },
  { symbol: "Sf", name: "Saffron", family: "Leather", layer: "heart", intensity: 7, freshness: 3, longevity: 8, compatibleWith: ["Oud", "Rose"] },
  { symbol: "Bt", name: "Birch Tar", family: "Smoky", layer: "base", intensity: 9, freshness: 2, longevity: 8, compatibleWith: ["Leather", "Pine"] },
  { symbol: "In", name: "Incense", family: "Smoky", layer: "base", intensity: 8, freshness: 3, longevity: 9, compatibleWith: ["Frankincense", "Myrrh"] },
  { symbol: "Fk", name: "Frankincense", family: "Smoky", layer: "base", intensity: 7, freshness: 4, longevity: 8, compatibleWith: ["Myrrh", "Lemon"] },
  { symbol: "My", name: "Myrrh", family: "Smoky", layer: "base", intensity: 7, freshness: 2, longevity: 9, compatibleWith: ["Frankincense", "Vanilla"] },
  { symbol: "Ol", name: "Olibanum", family: "Smoky", layer: "base", intensity: 7, freshness: 4, longevity: 8, compatibleWith: ["Incense", "Lemon"] },
  { symbol: "De", name: "Cade", family: "Smoky", layer: "base", intensity: 8, freshness: 2, longevity: 8, compatibleWith: ["Pine", "Leather"] },
  { symbol: "Tb", name: "Tobacco", family: "Smoky", layer: "base", intensity: 7, freshness: 2, longevity: 8, compatibleWith: ["Vanilla", "Honey"] },
  { symbol: "Cf", name: "Coffee", family: "Gourmand", layer: "heart", intensity: 8, freshness: 3, longevity: 7, compatibleWith: ["Cardamom", "Chocolate"] },
  { symbol: "Co", name: "Cacao", family: "Gourmand", layer: "heart", intensity: 7, freshness: 2, longevity: 8, compatibleWith: ["Patchouli", "Vanilla"] },
  { symbol: "Lw", name: "Leatherwood", family: "Leather", layer: "base", intensity: 6, freshness: 3, longevity: 8, compatibleWith: ["Cedar", "Smoke"] },
  { symbol: "An", name: "Castoreum", family: "Leather", layer: "base", intensity: 8, freshness: 1, longevity: 9, compatibleWith: ["Leather", "Labdanum"] },
  { symbol: "Sk", name: "Smoke", family: "Smoky", layer: "base", intensity: 8, freshness: 2, longevity: 8, compatibleWith: ["Vetiver", "Guaiacwood"] },
  // Period 7 remainder — gourmand, musk, amber woods
  { symbol: "Hy", name: "Honey", family: "Gourmand", layer: "heart", intensity: 6, freshness: 3, longevity: 7, compatibleWith: ["Orange Blossom", "Tobacco"] },
  { symbol: "Ch", name: "Chocolate", family: "Gourmand", layer: "base", intensity: 7, freshness: 2, longevity: 8, compatibleWith: ["Patchouli", "Coffee"] },
  { symbol: "Cr", name: "Caramel", family: "Gourmand", layer: "base", intensity: 6, freshness: 2, longevity: 7, compatibleWith: ["Vanilla", "Sea Salt"] },
  { symbol: "Pz", name: "Praline", family: "Gourmand", layer: "base", intensity: 6, freshness: 2, longevity: 7, compatibleWith: ["Almond", "Tonka"] },
  { symbol: "Tf", name: "Toffee", family: "Gourmand", layer: "base", intensity: 6, freshness: 2, longevity: 7, compatibleWith: ["Caramel", "Vanilla"] },
  { symbol: "Wm", name: "White Musk", family: "Musk", layer: "base", intensity: 4, freshness: 5, longevity: 9, compatibleWith: ["Cashmeran", "Ambrette"] },
  { symbol: "Ab", name: "Ambrette", family: "Musk", layer: "base", intensity: 5, freshness: 4, longevity: 9, compatibleWith: ["Pear", "White Musk"] },
  { symbol: "Ci", name: "Civet", family: "Musk", layer: "base", intensity: 8, freshness: 1, longevity: 9, compatibleWith: ["Jasmine", "Honey"] },
  { symbol: "Ag", name: "Ambergris", family: "Amber", layer: "base", intensity: 5, freshness: 5, longevity: 10, compatibleWith: ["Marine", "Ambroxan"] },
  { symbol: "Ms", name: "Moss", family: "Woody", layer: "base", intensity: 6, freshness: 4, longevity: 8, compatibleWith: ["Oakmoss", "Vetiver"] },
  { symbol: "Dw", name: "Driftwood", family: "Woody", layer: "base", intensity: 5, freshness: 6, longevity: 8, compatibleWith: ["Sea Salt", "Cedar"] },
  { symbol: "Te", name: "Teak", family: "Woody", layer: "base", intensity: 6, freshness: 4, longevity: 8, compatibleWith: ["Sandalwood", "Amber"] },
  { symbol: "Mh", name: "Mahogany", family: "Woody", layer: "base", intensity: 6, freshness: 3, longevity: 8, compatibleWith: ["Vanilla", "Tobacco"] },
  { symbol: "Rw", name: "Rosewood", family: "Woody", layer: "heart", intensity: 5, freshness: 4, longevity: 7, compatibleWith: ["Rose", "Sandalwood"] },
  { symbol: "Ps", name: "Palisander", family: "Woody", layer: "base", intensity: 6, freshness: 3, longevity: 8, compatibleWith: ["Rosewood", "Cedar"] },
];

if (SEEDS.length !== PT_SLOTS.length) {
  throw new Error(`Fragrance notes (${SEEDS.length}) must match PT slots (${PT_SLOTS.length})`);
}

export const FRAGRANCE_NOTES: FragranceNote[] = SEEDS.map((seed, i) => {
  const [column, row] = PT_SLOTS[i]!;
  const n = i + 1;
  return {
    id: `fn-${String(n).padStart(3, "0")}`,
    code: `FN-${String(n).padStart(3, "0")}`,
    column,
    row,
    ...seed,
  };
});

export function noteById(id: string): FragranceNote | undefined {
  return FRAGRANCE_NOTES.find((n) => n.id === id);
}
