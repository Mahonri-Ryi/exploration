#!/usr/bin/env node
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const root = join(process.cwd(), "Unreal", "Aetheris");
const fails = [];

function need(rel) {
  const p = join(root, rel);
  if (!existsSync(p)) fails.push(`missing ${rel}`);
  return p;
}

const projectPath = need("Aetheris.uproject");
need("Config/DefaultEngine.ini");
need("Config/DefaultInput.ini");
need("Source/Aetheris/AetherisWorld.cpp");
need("Source/Aetheris/CitySim.cpp");
need("Source/Aetheris/Catalog.cpp");
need("Source/Aetheris/AetherisGameMode.cpp");
need("Source/Aetheris/AetherisPawn.cpp");
need("Source/Aetheris/AetherisAssets.cpp");
need("Source/Aetheris/AetherisAudio.cpp");
need("README.md");

const runtime = [
  "Content/Runtime/Textures/brick.png",
  "Content/Runtime/Textures/plaster.png",
  "Content/Runtime/Textures/stone.png",
  "Content/Runtime/Textures/roof.png",
  "Content/Runtime/Textures/asphalt.png",
  "Content/Runtime/Textures/grass.png",
  "Content/Runtime/Textures/sand.png",
  "Content/Runtime/Textures/water.png",
  "Content/Runtime/Textures/windows.png",
  "Content/Runtime/Textures/photo_grass.jpg",
  "Content/Runtime/Textures/photo_asphalt.jpg",
  "Content/Runtime/Audio/ui_click.wav",
  "Content/Runtime/Audio/place.wav",
  "Content/Runtime/Audio/construction.wav",
  "Content/Runtime/Audio/demolish.wav",
  "Content/Runtime/Audio/ambient_day.wav",
  "Content/Runtime/Audio/ambient_night.wav",
];
for (const rel of runtime) need(rel);

if (existsSync(projectPath)) {
  const project = JSON.parse(readFileSync(projectPath, "utf8"));
  if (project.EngineAssociation !== "5.5" && project.EngineAssociation !== "5.4") {
    fails.push(`EngineAssociation ${project.EngineAssociation}`);
  }
  if (!project.Modules?.some((m) => m.Name === "Aetheris")) fails.push("Aetheris module missing");
}

const engine = readFileSync(join(root, "Config/DefaultEngine.ini"), "utf8");
for (const key of [
  "r.DynamicGlobalIlluminationMethod=1",
  "r.ReflectionMethod=1",
  "r.Shadow.Virtual.Enable=1",
  "r.SkyAtmosphere=1",
  "r.VolumetricCloud=1",
  "AetherisGameMode",
]) {
  if (!engine.includes(key)) fails.push(`DefaultEngine.ini missing ${key}`);
}

const input = readFileSync(join(root, "Config/DefaultInput.ini"), "utf8");
for (const key of ["RotateLeft", "RotateRight", "ResetCamera", "RazeHotkey", "CaptureDuringMouseDown"]) {
  if (!input.includes(key)) fails.push(`DefaultInput.ini missing ${key}`);
}

const world = readFileSync(join(root, "Source/Aetheris/AetherisWorld.cpp"), "utf8");
for (const key of ["ASkyAtmosphere", "AVolumetricCloud", "ASkyLight", "APostProcessVolume", "TryPlaceAt", "UpdateHover", "bRazeMode", "RefreshRoadNeighbors"]) {
  if (!world.includes(key)) fails.push(`AetherisWorld.cpp missing ${key}`);
}

const pawn = readFileSync(join(root, "Source/Aetheris/AetherisPawn.cpp"), "utf8");
for (const key of ["EdgeScroll", "RotateLeft", "bPainting"]) {
  if (!pawn.includes(key)) fails.push(`AetherisPawn.cpp missing ${key}`);
}

const hud = readFileSync(join(root, "Source/Aetheris/AetherisHUD.cpp"), "utf8");
for (const key of ["ConsumeClick", "OpenCategory"]) {
  if (!hud.includes(key)) fails.push(`AetherisHUD.cpp missing ${key}`);
}

const catalog = readFileSync(join(root, "Source/Aetheris/Catalog.cpp"), "utf8");
for (const id of ["cottage", "mill", "water", "road", "shop", "park", "bulldoze"]) {
  if (!catalog.includes(id)) fails.push(`catalog missing ${id}`);
}

if (fails.length) {
  console.error(fails.map((f) => `FAIL ${f}`).join("\n"));
  process.exit(1);
}
console.log("ok  unreal project is UE5-ready (Lumen, city-builder camera, runtime assets)");
