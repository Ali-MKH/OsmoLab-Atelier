import type { OlfactoryFamilyDef } from './types';

export const OLFACTORY_WHEEL_FAMILIES: OlfactoryFamilyDef[] = [
  {
    id: 'floral',
    name: 'Floral',
    macroFamily: 'Floral',
    color: '#E11D48',
    description:
      'Radiant fresh cut blossoms—rose, jasmine, tuberose, ylang-ylang, and lily of the valley.',
    academicNotes:
      'Anchored by phenyl ethyl alcohol, cis-jasmone, benzyl acetate, and Hedione. Forms the classic heart of fine perfumery.',
    keyMaterials: ['Hedione', 'Jasmine Sambac Absolute', 'Rose Otto', 'Phenylethyl Alcohol'],
    subFacets: ['Soliflore', 'White Floral', 'Rose', 'Transparent Floral', 'Narcotic'],
  },
  {
    id: 'soft-floral',
    name: 'Soft Floral',
    macroFamily: 'Floral',
    color: '#F472B6',
    description:
      'Sparkling aldehydes, iris butter, heliotrope, and powdery-musky petal veils.',
    academicNotes:
      'Combines aliphatic aldehydes (C-10, C-11, C-12) with ionones, orris, and clean macrocyclic musks.',
    keyMaterials: ['Aldehyde C-12 MNA', 'Orris Concrete', 'Heliotropin', 'Alpha-Isomethyl Ionone'],
    subFacets: ['Aldehydic', 'Powdery', 'Iris / Violet', 'Soft Musky', 'Cosmetic'],
  },
  {
    id: 'floral-amber',
    name: 'Floral Amber',
    macroFamily: 'Floral',
    color: '#FB7185',
    description:
      'Orange blossom, solar salicylates, and sweet spiced florals resting on warm amber.',
    academicNotes:
      'Bridges narcotic white florals (neroli, orange blossom, frangipani) into benzoin, vanillin, and benzyl salicylate.',
    keyMaterials: ['Orange Blossom Absolute', 'Benzyl Salicylate', 'Ylang-Ylang Extra', 'Aurantiol'],
    subFacets: ['Orange Blossom', 'Solar Floral', 'Spiced Blossom', 'Floriental', 'Nectar'],
  },
  {
    id: 'soft-amber',
    name: 'Soft Amber',
    macroFamily: 'Amber',
    color: '#F59E0B',
    description:
      'Translucent incense, warm skin resins, benzoin, and delicate aromatic spices.',
    academicNotes:
      'Built around olibanum, myrrh, Siam benzoin, coumarin, and velvety musks for a diffusive, non-cloying warmth.',
    keyMaterials: ['Olibanum Resinoid', 'Benzoin Siam', 'Cardamom EO', 'Ambrettolide'],
    subFacets: ['Incense', 'Warm Spicy', 'Skin Amber', 'Balsamic Veil', 'Resinous'],
  },
  {
    id: 'amber',
    name: 'Amber',
    macroFamily: 'Amber',
    color: '#EA580C',
    description:
      'Rich labdanum, vanilla bean,Peru balsam, and classic golden amber accords.',
    academicNotes:
      'The classical Ambre 83 chord—labdanum, vanillin, and patchouli/benzoin—delivering deep tenacity and opulence.',
    keyMaterials: ['Labdanum Absolute', 'Vanillin', 'Ambroxan', 'Cistus EO'],
    subFacets: ['Labdanum', 'Vanilla', 'Ambergris', 'Balsamic', 'Golden Resin'],
  },
  {
    id: 'woody-amber',
    name: 'Woody Amber',
    macroFamily: 'Amber',
    color: '#D97706',
    description:
      'Dark patchouli, sandalwood, tonka bean, cacao, and modern amber-wood molecules.',
    academicNotes:
      'Marries sesquiterpene woods (patchouli, guaiac, cedar) with gourmand lactones, maltol, and radiant amber-woods.',
    keyMaterials: ['Patchouli Oil', 'Tonka Bean Absolute', 'Iso E Super', 'Timberol'],
    subFacets: ['Patchouli', 'Gourmand', 'Tonka', 'Amber-Wood', 'Dark Sweet'],
  },
  {
    id: 'woods',
    name: 'Woods',
    macroFamily: 'Woody',
    color: '#A16207',
    description:
      'Pencil-shavings cedarwood, creamy Mysore-style sandalwood, and earthy vetiver roots.',
    academicNotes:
      'Structural backbone of modern perfumery using Virginia/Atlas cedar, santalols, vetiverol, and Iso E Super.',
    keyMaterials: ['Cedarwood Virginia', 'Vetiver Haiti', 'Javanol', 'Iso E Super'],
    subFacets: ['Cedar', 'Sandalwood', 'Vetiver', 'Creamy Wood', 'Radiant Wood'],
  },
  {
    id: 'mossy-woods',
    name: 'Mossy Woods',
    macroFamily: 'Woody',
    color: '#15803D',
    description:
      'Classic Chypre architecture—oakmoss, tree moss, bergamot, and damp forest floor.',
    academicNotes:
      'Structured on the contrast between sparkling bergamot top notes, floral-labdanum heart, and Evernia prunastri (oakmoss) base.',
    keyMaterials: ['Oakmoss Absolute (Low Atranol)', 'Evernyl (Veramoss)', 'Patchouli Fraction', 'Bergamot FCF'],
    subFacets: ['Chypre', 'Oakmoss', 'Forest Floor', 'Lichen', 'Earthy Humus'],
  },
  {
    id: 'dry-woods',
    name: 'Dry Woods',
    macroFamily: 'Woody',
    color: '#78350F',
    description:
      'Smoky birch tar, cade, cured leather, suede, tobacco leaf, and scorched vetiver.',
    academicNotes:
      'Uses isobutyl quinoline, birch tar, castoreum replacers, Safraleine, and Cashmeran to evoke smoke, saddle leather, and arid timber.',
    keyMaterials: ['Isobutyl Quinoline', 'Birch Tar Rectified', 'Cashmeran', 'Suederal'],
    subFacets: ['Leather', 'Smoky', 'Tobacco', 'Suede', 'Arid Bark'],
  },
  {
    id: 'aromatic',
    name: 'Aromatic',
    macroFamily: 'Fresh',
    color: '#4F46E5',
    description:
      'Fougère herbs—French lavender, clary sage, rosemary, thyme, mint, and coumarin.',
    academicNotes:
      'Classical Fougère skeleton pairing herbaceous lavender and linalyl acetate with geranium, oakmoss, and coumarin.',
    keyMaterials: ['Lavender Maillette', 'Clary Sage Absolute', 'Rosemary Cineole', 'Coumarin'],
    subFacets: ['Fougère', 'Lavender', 'Herbal', 'Camphoraceous', 'Minty'],
  },
  {
    id: 'citrus',
    name: 'Citrus',
    macroFamily: 'Fresh',
    color: '#EAB308',
    description:
      'Effervescent cold-pressed hesperidic peels—bergamot, lemon, mandarin, yuzu, and grapefruit.',
    academicNotes:
      'High-volatility monoterpenes (limonene, bergamotene, citral) and petitgrain/neroli providing immediate lift and sparkle.',
    keyMaterials: ['Bergamot FCF', 'Lemon Sicily Cold-Pressed', 'Mandarin Red', 'Nootkatone'],
    subFacets: ['Bergamot', 'Hesperidic', 'Bitter Peel', 'Petitgrain', 'Zesty'],
  },
  {
    id: 'water',
    name: 'Water',
    macroFamily: 'Fresh',
    color: '#0284C7',
    description:
      'Sea spray, wet stone, petrichor, ozone, and crisp aquatic breeze.',
    academicNotes:
      'Driven by Calone (methylbenzodioxepinone), Helional, floralozone, and mineral seaweed/ambroxan accords.',
    keyMaterials: ['Calone 1951', 'Helional', 'Geosmin (0.1%)', 'Seaweed Absolute'],
    subFacets: ['Marine', 'Petrichor', 'Ozonic', 'Wet Stone', 'Mineral'],
  },
  {
    id: 'green',
    name: 'Green',
    macroFamily: 'Fresh',
    color: '#10B981',
    description:
      'Crushed stems, galbanum resin, violet leaf, fig leaf, and freshly mown grass.',
    academicNotes:
      'Powered by cis-3-hexenol, Triplal, galbanum pyrazines, and methyl octine carbonate (folione) for razor-sharp botanical realism.',
    keyMaterials: ['Galbanum EO', 'Cis-3-Hexenol', 'Violet Leaf Absolute', 'Stemone'],
    subFacets: ['Crushed Leaf', 'Galbanum', 'Violet Leaf', 'Cut Grass', 'Fig Leaf'],
  },
  {
    id: 'fruity',
    name: 'Fruity',
    macroFamily: 'Fresh',
    color: '#EC4899',
    description:
      'Orchard and tropical fruit textures—blackcurrant bud (cassis), peach skin, pear, fig, and osmanthus.',
    academicNotes:
      'Constructed with gamma-undecalactone (Aldehyde C-14), damascones, hexyl acetate, and cassis mercaptans.',
    keyMaterials: ['Blackcurrant Bud Absolute', 'Aldehyde C-14 (Undecalactone)', 'Damascenone', 'Fructone'],
    subFacets: ['Cassis', 'Lactonic Peach', 'Crisp Pear', 'Ripe Fig', 'Berry'],
  },
];
