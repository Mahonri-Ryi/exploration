import type { ToolId } from "./catalog";
import type { City } from "./city";

export interface TutorialStep {
  id: string;
  title: string;
  body: string;
  /** Toolbar tool to pulse while this step is active. */
  tool?: ToolId;
  /** When set, the primer waits until this is true, then advances. */
  wait?: (city: City) => boolean;
}

export const TUTORIAL: TutorialStep[] = [
  {
    id: "welcome",
    title: "The vale is yours",
    body: "On a phone: tap to build, two fingers to orbit and pinch to zoom, or tap Look to drag the view. On a computer: right-drag to orbit, scroll to zoom, WASD to travel. The blue ribbon is the river — do not build on it yet.",
  },
  {
    id: "avenue",
    title: "Lay an avenue",
    body: "Select Avenue in the toolbar (or press 2). Tap or click and drag on the grass to paint a short road. Buildings need an avenue beside them to operate.",
    tool: "road",
    wait: (c) => c.tiles.some((t) => t.road && !t.water),
  },
  {
    id: "mill",
    title: "Kindle clean power",
    body: "Select Windmill and place it beside the avenue. Windmills feed the grid and need no water main. A Power Plant also works, but it drinks water and fouls the air.",
    tool: "mill",
    wait: (c) => c.tiles.some((t) => t.buildingId === "mill" || t.buildingId === "power"),
  },
  {
    id: "water",
    title: "Draw water",
    body: "Place a Water Tower near the road. Power and water travel along avenues and a short radius around the plants.",
    tool: "water",
    wait: (c) => c.tiles.some((t) => t.buildingId === "water"),
  },
  {
    id: "cottage",
    title: "Raise a cottage",
    body: "Place a Cottage next to the avenue. Homes sit idle without road, power, and water — watch the toasts if a plot is dark or dry.",
    tool: "cottage",
    wait: (c) => c.tiles.some((t) => t.buildingId === "cottage" || t.buildingId === "villa"),
  },
  {
    id: "souls",
    title: "Wait for souls",
    body: "Let the clock run (1×). Families move in once the cottage is serviced. Watch Souls in the top bar — that is your population.",
    wait: (c) => c.population() > 0,
  },
  {
    id: "survey",
    title: "Survey a plot",
    body: "Select Survey (1 or I) and tap the cottage. The inspect panel shows road, power, water, residents, and smoke. You will need this to upgrade.",
    tool: "inspect",
    wait: (c) => c.flags.surveyed,
  },
  {
    id: "shop",
    title: "Give them work",
    body: "Place a Boutique beside the avenue. Labor is employed / jobs. Empty shops still cost upkeep, so match homes to workplaces.",
    tool: "shop",
    wait: (c) => c.tiles.some((t) => t.buildingId === "shop" || t.buildingId === "market"),
  },
  {
    id: "park",
    title: "Lift their spirit",
    body: "Place a Park near the cottage. Parks, inns, schools, and services raise Spirit. Industry pays well and fouls nearby air.",
    tool: "park",
    wait: (c) => c.tiles.some((t) => t.buildingId === "park" || t.buildingId === "plaza"),
  },
  {
    id: "meters",
    title: "Read the city",
    body: "R / C / I bars are residential, commercial, and industrial demand. The Levy slider trades treasury income for happiness. High taxes fray tempers.",
  },
  {
    id: "upgrade",
    title: "Raise the roof",
    body: "Survey the cottage and tap Raise, or press U, to upgrade it to a Villa. Cottages climb to towers; shops and workshops have their own chains.",
    tool: "inspect",
    wait: (c) => c.flags.upgraded,
  },
  {
    id: "river",
    title: "The watercourse",
    body: "Paint Avenue from shore onto the river to raise a gold bridge ($90). Docks must face water. A unique River Beacon on the quay doubles trader dues.",
    tool: "road",
  },
  {
    id: "charter",
    title: "Keep the charter",
    body: "The Charter panel pays gold for first-hour goals. On a phone, tap Charter to open it. Complete them as you grow. Larger tools unlock from the toolbar as Souls rise.",
  },
  {
    id: "fire",
    title: "Watch the dry wind",
    body: "Monthly events can bless the city — or start a fire. A live Fire Hall quells nearby blazes. Unguarded plots burn down. Pause with Space if you need a breath.",
    tool: "fire",
  },
  {
    id: "wonders",
    title: "Later wonders",
    body: "City Hall, the Beacon, and the Observatory are unique. Inns lift nearby homes. Press H anytime for field notes.",
  },
  {
    id: "laurels",
    title: "Laurels",
    body: "Press A, or Laurels in the top bar, to open achievements. You have already earned a few for this primer.",
    wait: (c) => c.flags.laurels,
  },
];

export function tutorialStep(city: City): TutorialStep | null {
  if (city.tutorialDone) return null;
  return TUTORIAL[city.tutorialIndex] ?? null;
}
