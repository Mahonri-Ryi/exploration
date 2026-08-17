# Aetheris for Unreal Engine 5

This is the **native** city builder. Open `Aetheris.uproject` in Unreal 5.5, compile, and press **Play**. The vale, lighting, HUD, textures, and sound load at runtime — you do not need to import `.uasset` art first.

The editor is not in the cloud agent environment. Play this on the machine where you are installing Unreal.

## Open and play

1. Install [Unreal Engine 5.5](https://www.unrealengine.com/download). 5.4 or 5.6 also work if you change `EngineAssociation` in `Aetheris.uproject` and `IncludeOrderVersion` in the two `*.Target.cs` files (`Unreal5_4` / `Unreal5_5` / `Unreal5_6`).
2. Double-click `Unreal/Aetheris/Aetheris.uproject`.
3. If asked to rebuild modules, click **Yes**.
4. Press **Play**. GameMode spawns the vale on BeginPlay, so any empty level works.
5. Optional: **File → New Level → Open World**, save as `Content/Maps/Vale`, then set it as the editor startup map.

## Controls (Cities-style)

| Input | Action |
| --- | --- |
| WASD / arrows | Pan |
| Mouse at screen edge | Edge scroll |
| Q / E | Rotate 45° |
| Right mouse | Orbit (yaw + pitch/zoom) |
| Middle mouse | Drag-pan |
| Wheel | Zoom (distance, pitch, FOV) |
| R or Home | Reset camera |
| Left click / drag | Place or paint the current tool |
| Dock tabs + cards | Pick category and building |
| 1–7 | Avenue, Cottage, Windmill, Water Tower, Boutique, Park, Workshop |
| X | Raze tool |
| Space | Pause sim |

Click a card on the construction dock, then click-drag across tiles. Roads snap markings to neighbors. Hover ghost turns teal when the plot is legal and red when it is not.

## Look and sound

- Lumen GI + reflections, virtual shadow maps, sky atmosphere, volumetric clouds and fog
- Runtime PBR-ish textures in `Content/Runtime/Textures` (photo grass/asphalt plus brick, plaster, stone, roof, water, windows)
- 48 kHz stereo WAV SFX and looping day/night beds in `Content/Runtime/Audio`
- Distinct silhouettes for homes, shops, works, civic, and wonders

Rebuild those files after changing the web library:

```bash
npm run ue-assets
```

Replace the runtime meshes with Nanite Megascans or Kitbash kits in the editor when you want film assets — the sim and placement stay the same.

## Web prototype

The Three.js game at the repo root is still there for a quick browser sketch. It is not the graphics target.
