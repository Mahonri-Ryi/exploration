import type { City } from "./city";

export interface Mission {
  id: string;
  title: string;
  detail: string;
  reward: number;
  check: (city: City) => boolean;
}

export const MISSIONS: Mission[] = [
  {
    id: "avenue",
    title: "Lay the first avenue",
    detail: "Paint a road so the city can breathe.",
    reward: 400,
    check: (c) => c.tiles.some((t) => t.road),
  },
  {
    id: "light",
    title: "Kindle the grid",
    detail: "Raise a power plant.",
    reward: 700,
    check: (c) => c.tiles.some((t) => t.buildingId === "power"),
  },
  {
    id: "cistern",
    title: "Draw water",
    detail: "Raise a water tower.",
    reward: 700,
    check: (c) => c.tiles.some((t) => t.buildingId === "water"),
  },
  {
    id: "hearth",
    title: "Shelter twenty souls",
    detail: "Fill cottages until twenty citizens call this home.",
    reward: 1500,
    check: (c) => c.population() >= 20,
  },
  {
    id: "green",
    title: "Plant a park",
    detail: "Give the city a place to wander.",
    reward: 500,
    check: (c) => c.tiles.some((t) => t.buildingId === "park" || t.buildingId === "plaza"),
  },
  {
    id: "span",
    title: "Span the river",
    detail: "Carry an avenue across the water as a bridge.",
    reward: 1800,
    check: (c) => c.tiles.some((t) => t.water && t.road),
  },
  {
    id: "harbor",
    title: "Open a dock",
    detail: "Face the river and take the traders' coin.",
    reward: 1200,
    check: (c) => c.tiles.some((t) => t.buildingId === "dock"),
  },
  {
    id: "hall",
    title: "Raise City Hall",
    detail: "Give the charter a house of stone.",
    reward: 4000,
    check: (c) => c.hasUnique("cityhall"),
  },
  {
    id: "skyline",
    title: "A city of one hundred",
    detail: "Reach one hundred souls.",
    reward: 5000,
    check: (c) => c.population() >= 100,
  },
  {
    id: "wind",
    title: "Catch the wind",
    detail: "Raise a windmill for clean power.",
    reward: 800,
    check: (c) => c.tiles.some((t) => t.buildingId === "mill"),
  },
  {
    id: "hearthinn",
    title: "Keep a hearth",
    detail: "Open an inn so travelers stay the night.",
    reward: 900,
    check: (c) => c.tiles.some((t) => t.buildingId === "inn"),
  },
  {
    id: "brigade",
    title: "Raise a fire hall",
    detail: "Keep watch against the dry wind.",
    reward: 1100,
    check: (c) => c.tiles.some((t) => t.buildingId === "fire"),
  },
  {
    id: "lamp",
    title: "Light the river",
    detail: "Raise the unique River Beacon on the shore.",
    reward: 3500,
    check: (c) => c.hasUnique("beacon"),
  },
  {
    id: "stars",
    title: "Read the heavens",
    detail: "Raise the Observatory.",
    reward: 4500,
    check: (c) => c.hasUnique("observatory"),
  },
  {
    id: "borough",
    title: "A city of two hundred fifty",
    detail: "Fill the vale until two hundred fifty souls remain.",
    reward: 8000,
    check: (c) => c.population() >= 250,
  },
];

export const UPGRADE_OF: Record<string, string> = {
  cottage: "villa",
  villa: "apartments",
  apartments: "tower",
  shop: "market",
  market: "offices",
  workshop: "factory",
  factory: "plant",
  park: "plaza",
};

export const BRIDGE_COST = 90;

export function upgradeCost(fromCost: number, toCost: number): number {
  return Math.max(80, toCost - Math.floor(fromCost * 0.5));
}
