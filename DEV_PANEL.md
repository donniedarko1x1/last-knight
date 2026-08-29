# Last Knight DEV Scene Tuner + UI Layout Editor

Open the panel with the **DEV** button or **F2**.

## Environment editor

Open **EDIT ENVIRONMENT** and enable **EDIT ENV**.

- Click an existing tree / rock / grass / landmark to select it.
- Left-drag the selected object directly on the map.
- Fine tune X/Y, scale, rotation, alpha and Flip X from the panel.
- Shadows and environment colliders follow edited props.
- **DELETE SELECTED** removes the selected object from the working layout.
- Select any of the 10 Ash Fields assets in **Prop palette**.
- **PLACE ON CLICK**: next left-click on the map creates that asset there.
- **+ AT VIEW CENTER** creates the selected asset in the current camera centre.
- **Duplicate** makes a copy of the selected prop.
- Newly created objects are marked `created: true` in exported layout JSON.
- Deleted original objects are marked `deleted: true`.
- User-created props that are later deleted are omitted from the final export.
- Undo / Redo and Reset Selected / Segment / All are supported.
- **Save Local** persists the complete edited Ash Fields layout between page reloads.
- **Copy Layout** copies a JSON document that can be sent back for permanent integration.

`Save Local` uses browser localStorage key `lastKnight.dev.ashLayout.v1`.

## Camera / full-scene editing

Open **CAMERA / SCENE VIEW**.

- Zoom presets: 0.30 / 0.50 / 0.75 / 1.0 / 1.25 / 1.5 / 2.0.
- **FIT ASH** frames the complete 0–4000 Ash Fields zone in one view.
- **Free Camera · Drag / IJKL** detaches the camera from the hero.
- In Free Camera, left-drag empty scene to pan.
- In EDIT ENV, right- or middle-drag to pan without moving the selected prop.
- Mouse wheel zooms around the cursor while camera/edit mode is active.
- Follow Player restores the normal gameplay camera.

## World / combat tools

- World: pause/resume, auto spawns, 0.25x / 0.5x / 1x / 2x time.
- Enemies: spawn Skeleton/Mage/Shield, mixed groups, freeze AI, freeze movement, disable attacks, kill/delete all, clear projectiles.
- Champions: choose champion, spawn/reset/kill/delete, freeze, disable movement/attacks/skills, clear hazards, set 10/50/100% HP.
- Player: God Mode, One Hit, No Collision, Infinite Mana, HP presets, level/XP, sword damage/speed/radius tuning, reset sword/relics.
- Travel: Start, x900, x1900, Broken Sword, x2900, Altar, Boss Gate, or exact X.
- Scene: toggle props/trees/rocks/grass/landmarks/shadows, Ground Only, segment visibility, collision-test mode.
- Overlays: hitboxes, enemy/champion range, melee radius, prop colliders, safe lane, camera bounds, mobile/desktop reference frames.
- Scenarios: empty, skeletons, mages, mixed horde, champion only, heavy combat, critical HP, low HP + horde.
- Stress: 50 / 100 enemies.
- Screenshot: hides game UI + DEV overlay, freezes the world, captures PNG, then restores the previous state.

## UI Layout Editor

Open **EDIT INTERFACE / UI LAYOUT**.

- **EDIT UI** pauses gameplay and makes HUD blocks selectable on the game canvas.
- Drag selected HUD blocks with mouse or finger.
- Fine tune X/Y by 1 or 10 px; Snap 1 / 5 / 10 px.
- **Scale** changes the whole UI block uniformly.
- **Width / Height** reshape panel artwork without stretching text horizontally/vertically.
- Text size is controlled separately by **Font Scale**.
- Adjust Alpha and Depth.
- Lock an element to prevent accidental edits.
- Align to safe-area Left / Center / Right and Top / Center / Bottom.
- Copy/Paste position between UI blocks.
- Safe Area, Grid and selection Bounds overlays are available.
- Separate **Desktop** and **Mobile Landscape** profiles; `Auto (device)` selects the active profile.
- Undo / Redo, Reset Selected / Profile / All UI.
- **Save Local / Load Local** persists UI adjustments under `lastKnightDevUiLayoutV1`.
- **Copy UI JSON** copies the complete two-profile document.
- **Download JSON** saves it as a file for permanent integration.

Editable HUD nodes: hero shell, level badge, HP bar, XP bar, mana, wave panel/title/region, champion panel/name/HP, Quake/Lift/Spin, joystick and fullscreen button.

The fullscreen button's normal base position is now the **lower-left** utility area. On touch devices it is placed directly above the joystick so the controls do not overlap.

## Render / DPI test build

This build replaces the obsolete Phaser 3 `resolution` config approach with an explicit high-DPI backing-canvas experiment.

Open **RENDER / DPI TEST** in the DEV panel.

- **1×** renders one backing pixel per CSS pixel (old-style baseline).
- **1.5×** renders 1.5× in both dimensions.
- **2×** renders 2× in both dimensions (4× as many pixels total).
- **AUTO DPR** uses `min(devicePixelRatio, 2)`.
- The selected render scale is stored in localStorage key `lastKnight.dev.renderScale.v2`.
- The panel shows device DPR, CSS viewport, real canvas backing size, CSS canvas size, backing/CSS ratio, renderer type and HUD text resolution.
- Phaser Text objects in active scenes are refreshed to high-DPI text resolution (capped at 2×).
- HUD uses a dedicated compensating camera zoom, so UI positions and apparent sizes should stay approximately unchanged while render density changes.
- Main gameplay camera keeps the same world coverage because its existing height-derived camera zoom scales with the larger backing canvas.

### Mobile A/B test

1. Open the game on the phone and enter the same scene.
2. Open DEV → **RENDER / DPI TEST**.
3. Take a screenshot at **1×**.
4. Switch to **2×** and wait a second for resize/layout.
5. Take the same screenshot at **2×**.
6. Send both screenshots plus the diagnostic text shown in the panel.

Expected proof of the original blur hypothesis: at 2×, Phaser-rendered HUD/world should become visibly sharper while the HTML DEV button changes little or not at all.


## Render scale baseline

Mobile default render scale is **1.75×**. DEV still allows 1× / 1.5× / 1.75× / 2× / Auto DPR (capped at 2×).

## Regional combat progression (Build 1.0.5)

Ash Fields remains the original combat baseline. Later regions add pressure without replacing the existing wave/enemy formulas.

| Region | Ordinary population | Spawn rate | Hero max HP | Regional melee bonus |
| --- | ---: | ---: | ---: | ---: |
| Ash Fields | 1.00× | 1.00× | 100 | +0 |
| Ruined Kingdom | 1.15× | 1.05× | 108 | +1 |
| Cursed Graveyard | 1.30× | 1.10× | 117 | +2 |
| Hollow Forest | 1.45× | 1.15× | 126 | +3 |
| Spider Territory | 1.60× | 1.20× | 136 | +4 |

- Existing wave-based enemy HP/speed scaling is unchanged.
- Champion waves still reduce ordinary-enemy pressure by 30%, then apply the current region multiplier.
- Regional melee bonus is added after normal sword upgrades and also feeds skills/relic effects that already scale from melee damage.
- Regional HP/melee growth is applied on the official biome transition. DEV Travel teleports apply the destination balance immediately for testing.
- DEV → ENEMIES includes **REGION POPULATION TEST** buttons (AUTO / 1.00× / 1.15× / 1.30× / 1.45× / 1.60×). They recalculate the current wave without changing enemy HP.
