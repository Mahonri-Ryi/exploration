import { City, type SerializedCity } from "./city";

const KEY = "aetheris.save.v1";

export function saveCity(city: City): void {
  localStorage.setItem(KEY, JSON.stringify(city.serialize()));
}

export function loadCity(): City | null {
  const raw = localStorage.getItem(KEY);
  if (!raw) return null;
  try {
    const data = JSON.parse(raw) as SerializedCity;
    if (data.version !== 1 || !data.tiles) return null;
    return City.deserialize(data);
  } catch {
    return null;
  }
}

export function hasSave(): boolean {
  return Boolean(localStorage.getItem(KEY));
}

export function clearSave(): void {
  localStorage.removeItem(KEY);
}
