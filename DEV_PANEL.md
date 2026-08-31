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

<<<<<<< HEAD
## Performance diagnostics v2
=======
## Performance diagnostics v3
>>>>>>> c550486 (new changes)

Open **PERFORMANCE TRACE** in the DEV panel and press **START TRACE** before reproducing a slowdown. The v2 tracer samples four times per second and records browser/page lifecycle transitions immediately. Repeated unchanged pause/orientation states are deduplicated, so the logger no longer floods the JSON every frame.

Each sample now includes CPU timing buckets for **story**, **worldStreaming**, **enemyAI**, **navigation**, **melee**, **projectiles**, **vignette**, and **HUD**. The timings are intended for relative diagnosis inside one build; nested work such as navigation can also be included inside the broader enemyAI total.

Browser diagnostics still include visibility/focus, page hide/show/freeze/resume, Phaser pause/resume, WebGL context state, memory when available, camera effects, game/story state, active objects, tweens, physics bodies, sounds and HiDPI backing dimensions.

<<<<<<< HEAD
## Render / DPI test

Render scale can be changed live without restarting the scene. The presets are **1.00× / 1.25× / 1.50× / 1.75×**. Default remains **1.50×** and the DEV maximum is now **1.75×**. **AUTO DPR** uses `min(devicePixelRatio, 1.75)`. The selected manual render scale is stored in localStorage key `lastKnight.dev.renderScale.v2`.

The panel shows device DPR, CSS viewport, real canvas backing size, CSS canvas size, backing/CSS ratio, renderer type and HUD text resolution. HUD/world layout is reapplied after a live scale change so world coverage and UI size remain approximately stable while backing density changes.

### Automatic four-scale benchmark

Press **RUN 4-SCALE BENCHMARK** while standing in the gameplay situation you want to compare. The benchmark automatically starts Performance Trace if needed, then tests **1.00×, 1.25×, 1.50× and 1.75×**. Each stage gets 1 second to settle after resize and then 10 seconds of measurement. It records average/min/max FPS, average/max real frame gap and counts of frames slower than 33/50/100 ms. When finished it restores the render scale that was active before the benchmark and stores the results in the exported trace JSON.

=======
## Render / DPI test + Adaptive Quality

Render scale can be changed live without restarting the scene. The manual presets remain **1.00× / 1.25× / 1.50× / 1.75×**; the default scale and maximum are unchanged. Pressing any manual preset switches quality mode to **MANUAL**, stores the chosen scale under `lastKnight.dev.renderScale.v2`, and prevents automatic quality changes.

**AUTO QUALITY** enables the adaptive controller. On a fresh/main-scene start it waits for stable gameplay, gathers **10 seconds of valid active-frame samples**, and can move at most **one render-scale step** from the current profile. Browser-hidden time, pauses, menus, story focus, vignette/camera transitions, resize settling, and benchmark runs are excluded from the probe.

After the initial probe, AUTO monitors a rolling **15-second** window. Sustained frame pressure can queue only a one-step downgrade. The actual resize is delayed until a safe gameplay moment with no ordinary enemies, champion, attack, story focus, or camera transition. After a change the controller settles and observes again rather than cascading through profiles.

If a downgrade produces almost no median-FPS or p95-frame-time improvement, a **CPU-bound guard** blocks further automatic render-scale reductions for one minute. This prevents a CPU-limited device from sacrificing image quality when lowering backing resolution is not helping.

Automatic upgrades after long headroom are conservative: AUTO records and displays the next higher profile as available, but does not silently raise quality during gameplay. AUTO mode and its learned scale are stored separately under `lastKnight.quality.mode.v1` and `lastKnight.quality.autoScale.v1`.

The panel shows device DPR, CSS viewport, real canvas backing size, CSS canvas size, backing/CSS ratio, renderer type, HUD text resolution, current quality mode/phase, pending safe-point changes, probe metrics, and CPU-bound guard state. Performance Trace v3 also exports adaptive-quality history and `quality_*` events.

### Automatic four-scale benchmark

Press **RUN 4-SCALE BENCHMARK** while standing in the gameplay situation you want to compare. The benchmark automatically starts Performance Trace if needed, then tests **1.00×, 1.25×, 1.50× and 1.75×**. Each stage gets 1 second to settle after resize and then 10 seconds of measurement. It records average/min/max FPS, average/max real frame gap and counts of frames slower than 33/50/100 ms. When finished it restores the render scale that was active before the benchmark and stores the results in the exported trace JSON.

>>>>>>> c550486 (new changes)
## Proximity-gated hero auto-melee

The hero no longer starts sword spin animation, attack-ring FX or sword SFX when there is no living enemy inside the real melee radius. `HeroMelee` still tracks a slightly wider nearby radius (+26 px) for stable combat-state diagnostics, but that wider radius does not permit empty swings. After the last close target disappears, the current attack presentation can finish and the hero returns to normal 8-direction idle/walk animation.

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

## v10.8 browser-resume + fixed story UI sizing

Phaser's default post-panic timing cooldown is 120 frames, which is especially noticeable after switching browser tabs on machines already running near 30 FPS. v10.8 keeps delta smoothing enabled but sets `fps.panicMax` to **10 frames**, so focus/visibility recovery settles quickly instead of dragging for several seconds. Performance Trace records `browser_resume_recovery` with the active cooldown and pause duration.

World-space story UI now compensates for both camera zoom and the real canvas backing/CSS ratio. Wounded-knight interaction prompts, wounded-knight dialogue panels, and anomalous-skeleton thought text therefore keep the same perceived CSS size when switching live render scale between **1.00× / 1.25× / 1.50× / 1.75×**. Their world anchors still follow the actors normally.

