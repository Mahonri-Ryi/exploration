import type { City } from "./city";

export type LaurelCategory = "foundations" | "systems" | "civic" | "growth";

export interface Achievement {
  id: string;
  title: string;
  detail: string;
  category: LaurelCategory;
  check: (city: City) => boolean;
}

const has = (city: City, id: string): boolean => city.tiles.some((t) => t.buildingId === id);

export const ACHIEVEMENTS: Achievement[] = [
  {
    id: "first_road",
    title: "First stones",
    detail: "Lay an avenue.",
    category: "foundations",
    check: (c) => c.tiles.some((t) => t.road),
  },
  {
    id: "first_mill",
    title: "Catch the wind",
    detail: "Raise a windmill.",
    category: "foundations",
    check: (c) => has(c, "mill"),
  },
  {
    id: "first_water",
    title: "Cistern",
    detail: "Raise a water tower.",
    category: "foundations",
    check: (c) => has(c, "water"),
  },
  {
    id: "first_home",
    title: "Hearth smoke",
    detail: "Shelter the first family.",
    category: "foundations",
    check: (c) => c.population() > 0,
  },
  {
    id: "first_shop",
    title: "Open sign",
    detail: "Place a boutique or galleria.",
    category: "foundations",
    check: (c) => has(c, "shop") || has(c, "market") || has(c, "offices"),
  },
  {
    id: "first_park",
    title: "Green shade",
    detail: "Plant a park or plaza.",
    category: "foundations",
    check: (c) => has(c, "park") || has(c, "plaza"),
  },
  {
    id: "surveyor",
    title: "Surveyor",
    detail: "Inspect a plot.",
    category: "systems",
    check: (c) => c.flags.surveyed,
  },
  {
    id: "mason",
    title: "Mason",
    detail: "Upgrade a building in place.",
    category: "systems",
    check: (c) => c.flags.upgraded,
  },
  {
    id: "salvage",
    title: "Salvage",
    detail: "Raze a structure.",
    category: "systems",
    check: (c) => c.flags.razed,
  },
  {
    id: "primer",
    title: "Field primer",
    detail: "Finish or skip the new-mayor primer.",
    category: "systems",
    check: (c) => c.tutorialDone,
  },
  {
    id: "notes",
    title: "Field notes",
    detail: "Open the help sheet (H).",
    category: "systems",
    check: (c) => c.flags.helpOpened,
  },
  {
    id: "ledger",
    title: "Closed ledger",
    detail: "Collect a monthly tax.",
    category: "systems",
    check: (c) => c.flags.taxed,
  },
  {
    id: "brigade",
    title: "Brigade",
    detail: "Quench a blaze with a fire hall.",
    category: "systems",
    check: (c) => c.flags.quenched,
  },
  {
    id: "span",
    title: "Span",
    detail: "Carry an avenue across the river.",
    category: "systems",
    check: (c) => c.tiles.some((t) => t.water && t.road),
  },
  {
    id: "harbor",
    title: "Harbor dues",
    detail: "Open a river dock.",
    category: "civic",
    check: (c) => has(c, "dock"),
  },
  {
    id: "inn",
    title: "Keep a hearth",
    detail: "Open an inn.",
    category: "civic",
    check: (c) => has(c, "inn"),
  },
  {
    id: "school",
    title: "Letters",
    detail: "Raise an academy.",
    category: "civic",
    check: (c) => has(c, "school"),
  },
  {
    id: "hall",
    title: "Charter house",
    detail: "Raise City Hall.",
    category: "civic",
    check: (c) => has(c, "cityhall"),
  },
  {
    id: "beacon",
    title: "River lamp",
    detail: "Raise the unique River Beacon.",
    category: "civic",
    check: (c) => has(c, "beacon"),
  },
  {
    id: "stars",
    title: "Night glass",
    detail: "Raise the Observatory.",
    category: "civic",
    check: (c) => has(c, "observatory"),
  },
  {
    id: "souls50",
    title: "Hamlet no more",
    detail: "Shelter fifty souls.",
    category: "growth",
    check: (c) => c.population() >= 50,
  },
  {
    id: "village",
    title: "Village",
    detail: "Reach the Village era (40 souls).",
    category: "growth",
    check: (c) => c.population() >= 40,
  },
  {
    id: "town",
    title: "Town",
    detail: "Reach the Town era (120 souls).",
    category: "growth",
    check: (c) => c.population() >= 120,
  },
  {
    id: "tower",
    title: "Skyline",
    detail: "Raise a Sky Tower.",
    category: "growth",
    check: (c) => has(c, "tower"),
  },
  {
    id: "wonders",
    title: "Three wonders",
    detail: "Hold City Hall, the Beacon, and the Observatory at once.",
    category: "growth",
    check: (c) => has(c, "cityhall") && has(c, "beacon") && has(c, "observatory"),
  },
];

export const LAUREL_CATEGORIES: Array<{ id: LaurelCategory; title: string }> = [
  { id: "foundations", title: "Foundations" },
  { id: "systems", title: "Systems" },
  { id: "civic", title: "Civic" },
  { id: "growth", title: "Growth" },
];
