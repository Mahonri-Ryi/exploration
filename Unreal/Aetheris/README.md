# Aetheris for Unreal Engine 5

This is the **native** city builder. The browser prototype cannot do Lumen, Nanite, virtual shadow maps, or a real sky atmosphere. This project can.

The editor is not in the cloud agent environment (UE5 is a large local install). Open this folder on a machine that has **Unreal Engine 5.4 or 5.5**.

## Open and play

1. Install [Unreal Engine 5.5](https://www.unrealengine.com/download) (5.4 works if you change `EngineAssociation` in `Aetheris.uproject` and `IncludeOrderVersion` in the two `*.Target.cs` files to `Unreal5_4`).
2. Double-click `Unreal/Aetheris/Aetheris.uproject`.
3. If asked to rebuild modules, click **Yes**.
4. Press **Play**. The vale, river, sky, and lighting spawn from C++ — you do not need a cooked Content map first.
5. Optional: **File → New Level → Open World**, save as `Content/Maps/Vale`, then set it as the editor startup map. GameMode still builds the city on BeginPlay.

## Controls

| Input | Action |
| --- | --- |
| WASD | Pan |
| Middle mouse | Orbit |
| Wheel | Zoom |
| Left click | Place current tool |
| Right click | Raze |
| Space | Pause sim |
| 1–7 | Avenue, Cottage, Windmill, Water Tower, Boutique, Park, Workshop |

## What is using the UE5 stack

- Lumen global illumination and reflections (`r.DynamicGlobalIlluminationMethod=1`)
- Virtual shadow maps
- Sky atmosphere + real-time sky light + volumetric clouds and fog
- Auto-exposure, bloom, and a cinematic post volume
- Procedural terrain and water, lit materials, moving sun

Buildings are runtime meshes so the project compiles without binary `.uasset` art. Replace them with Nanite Megascans or Kitbash kits in the editor when you want film meshes — the sim and placement stay the same.

## Web prototype

The Three.js game at the repo root is still there for a quick browser sketch. It is not the graphics target anymore.
