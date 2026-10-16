# Bitmap Clips

Turn Bitcoin bitmaps into animated videos with 3D scenes, text overlays and music, all composed on a timeline and rendered in your browser.

Developed by **bitlodo**, Bitmap Clips is an experiment built with **Codex / GPT Sol**. Anyone can clone it, add features or use it as a reference with an LLM: describe what you want, and the repository's agent instructions guide implementation using shared components and typed contracts.

The app uses Bitcoin blockchain data through the [ordinals.com API](https://ordinals.com) and the [bitmap on-chain index developed by boppleton](https://x.com/boppleton/status/2106709819440722286).

## Run and validate

```sh
bun install --frozen-lockfile
bun run dev
```

The default address is http://localhost:3001. `HOST` and `PORT` override the optional local static server settings; see `.env.example`. Development builds use `.tmp/dev-dist/`, rebuild on source changes and reload after a successful build. Build with `bun run build` and publish the contents of `dist/` to any static HTTPS host. `bun run start` is an optional local static preview.

```sh
bun test
bun run typecheck
bun run build
bun run contracts
```

| Command | Purpose |
| --- | --- |
| `bun run dev` | Build and serve at http://localhost:3001; changes in `src/` and `public/` trigger a rebuild and full browser reload after success. |
| `bun run build` | Generate the complete static site in `dist/`, including discovered JSON templates. |
| `bun run start` | Serve the existing `dist/` build locally at http://localhost:3001; run the build first. No watching or automatic reload. |
| `bun test` | Run the automated tests; build first because static deployment checks inspect `dist/`. |
| `bun run typecheck` | Check TypeScript without emitting files. |
| `bun run templates` | Refresh the template catalog before standalone checks after adding or removing template JSON files. |
| `bun run contracts` | Regenerate scene, text and shared-module contract documentation. |

Development uses a full page reload, so in-memory UI state can reset; it does not replace individual modules in place.

To preview a production build locally:

```sh
bun run build
bun run start
```

Type checking includes unused local and parameter checks. `contracts` exports the registered scene manifests to `docs/contracts/`.

## Editing and storage

The current scene library exposes **Reveal** and **Display**. Transaction remains registered for compatibility with saved projects. Reveal includes Build, Wave, Radial, Scale & Rotate and Gravity. Each scene owns its duration, fades, camera settings and optional style override. Text templates have independent timing, settings and style overrides; adding or duplicating scenes does not automatically add text.

New projects offer **Blank timeline**, **Dynamic** and **Futuristic** templates. Template modules live in `src/project-templates/`; see [extending the app](#extend-the-app-with-an-ai-coding-assistant). Blank starts with no scenes, texts or soundtrack. Dynamic and Futuristic load exported project JSON files from `src/project-templates/projects/`, preserving the saved film configuration while using the selected bitmap. Their displayed names come from the JSON `name` field. Exporting a project includes the name you gave it, alongside `film` and `data`. To add a template, export your project with the desired name and copy its JSON into `src/project-templates/projects/`. Development and production builds discover it automatically; the filename is its stable template ID and `name` is its card title. No TypeScript module or manual registration is needed. Run `bun run templates` to refresh the generated catalog before standalone tests or type checking.

Projects use film document **version 8**. Import supports film versions 5–7 and earlier scene identifiers. These migrations are compatibility code and remain necessary for saved projects. The older engine `Project` model remains in use by scene builders and the renderer; it is distinct from the saved film contract.

IndexedDB stores projects and complete bitmap datasets locally. A localStorage recovery document protects recent edits. Projects can be reopened, renamed, cloned, imported and downloaded as JSON. There is no cross-browser synchronization. Undo holds up to 80 serialized film states without copying bitmap geometry.

Bitmap loading completes only after both block and inscription data arrive. **Refetch from blockchain** bypasses local and HTTP caches and validates the replacement before changing the current project. Cancellation and lookup failures preserve the current edit.

## Camera, style and timeline controls

Default Scene Settings and Default Text Style provide shared defaults; individual items can override them. Apply commits draft changes and Cancel discards them. Camera editing opens at the selected scene time and stores position, target and field of view only on Apply.

Camera modes are **Match previous camera**, **Default view** and **Custom view**. The first scene has no previous-camera option. Inheritance samples the preceding scene's actual final rendered frame, including procedural camera motion and gaps.

Space plays or pauses; P previews the selected item once. Arrow keys seek one frame, or ten with Shift; Home/End seek the film boundaries. Ctrl/Cmd+C/X/V uses the internal bitmap-specific clipboard, Ctrl/Cmd+D duplicates, and Ctrl/Cmd+Z or Ctrl/Cmd+Shift+Z undo/redo. Editing shortcuts preserve input fields and button activation. Right-click menus, Shift+F10 and inspector actions expose contextual commands; `?` opens shortcut help.

Camera and scene-default previews share view navigation: drag to rotate, right drag to pan, wheel to zoom; touch supports rotation, pan and pinch. With the canvas focused, arrows orbit, R resets, F fits and 1/2/3 select standard views. Navigation itself does not persist camera edits.

## Generative music

The audio inspector offers four original, locally synthesized soundtracks:

| Track | Tempo | Arrangement |
| --- | --- | --- |
| Liquid Drum & Bass | 172 BPM | Breakbeat drums, detuned Reese bass, suspended pads and a glassy melody |
| Chiptune | 128 BPM | Pulse-wave arpeggios, melodic hooks, bass and noise percussion |
| Jazz Fusion | 108 BPM | Syncopated electric bass, FM electric piano, extended ii-V-I chords, ride cymbal and a reed-like lead |
| Ambient Electronica | 96 BPM | Slow air pads, evolving overtones and deep drones, without drums |

Scores include chord changes, phrase variations, fills or breakdowns, tempo-synced echoes and boundary fades. Synthesis is deterministic and shared by preview, waveform and export. No external audio downloads are required. Existing score identifiers remain supported. Removed Brazilian Phonk and Future Garage selections resolve to Jazz Fusion when opening saved projects. Imported music is unchanged.

## Rendering and export

Preview and export have independent quality profiles: Standard, High and Custom. Supersampling, antialiasing and shadow resolution obey GPU and render-buffer limits. Preview resolution is separate from final video resolution. Export produces 720p or 1080p video at 30 fps in 1:1, 9:16 or 16:9.

WebCodecs export uses Mediabunny with H.264/AAC where available and VP9/VP8 with Opus otherwise. The AAC encoder can provide a WASM fallback. MediaRecorder is the real-time fallback and requires the tab to remain visible. Format availability is detected at runtime. Cancellation restores preview time and does not download a partial file.

Gravity uses deterministic Rapier physics in a worker, with versioned caches and continuation checkpoints shared by preview and export. Reusing simulation settings preserves cached frames; extending a simulation retains its prefix. The physics cache enforces its memory budget.

## Data and architecture

- `src/client.ts`: DOM editor orchestration, project lifecycle and UI bindings.
- `src/clips/` and `src/texts/`: typed definitions, registries, film validation and scene/text plans.
- `src/film-renderer.ts` and `src/clips/renderer.ts`: Three.js rendering and film composition.
- `src/drop-physics.ts`, `src/physics-worker.ts`, `src/physics-cache.ts`: simulation, worker scheduling and cache lifecycle.
- `src/lib/`: Bitcoin/Ordinals loading, decoding and validation.
- `src/vendor/`: reference parsers and layout implementation with preserved attribution.
- `tests/`: timeline, migration, camera, physics, import, rendering and HTTP contract checks.

### Bitmap on-chain index attribution

Bitmap inscription discovery uses the **on-chain bitmap index implemented by boppleton**. See [boppleton's announcement](https://x.com/boppleton/status/2106709819440722286) and the related on-chain resources: [index reference inscription](https://ordinals.com/content/bbbb2172ebca174579884df1ad7487196c39e860b3aacdf4e052a33bf5ec31fai0) and [additional index reference inscription](https://ordinals.com/content/0c18b83ca6aa6f5653bb57dafb491ac786b7fa738b6c5190f4542d1d7f15c43ai0).

The app's integration lives in [oci.ts](src/lib/oci.ts) and [bitmap.ts](src/lib/bitmap.ts). For bitmap numbers below 942000, it reads the configured on-chain index pages, resolves the indexed sat to an inscription through the Ordinals recursive API, and verifies that the inscription content exactly matches `<block-number>.bitmap`. For bitmap numbers at or above 942000, it scans blocks through the recursive API instead. The two reference inscriptions above provide attribution and context; the index page IDs actually fetched by the app are listed in `OCI_PAGES`.

The current integration treats the index below 942000 as experimental: content verification alone does not establish that an inscription is the first valid claim or prove ownership.

The bundled snapshot comes from block 970170. Transaction order and exact output sums are preserved. Parcel side length uses `max(1, ceil(log10(totalSats)) - 5)` and cube extrusion uses `size - 0.5`.

**Output sums include change and coinbase; they are not NFT trading volume.** Inscription lookup does not prove ownership. The browser queries Ordinals directly through CORS; no application backend or proxy is required. Rendering runs in the browser; automated contracts do not establish GPU performance or browser/device compatibility.

Historical design documents in `docs/reference/` describe earlier editors and may use superseded names or contracts. Use the TypeScript definitions and current registries as the source of truth.


## Extend the app with an AI coding assistant

Open this repository in an AI coding assistant that reads [AGENTS.md](AGENTS.md), then describe what you want in ordinary language. You do not need to specify implementation files or know the internal contracts. For example:

> Create a new timeline item that makes the cubes pulse with the music.

> Create a Matrix-style text display using this bitmap's transactions.

> Create a project template with a slow reveal, transaction captions and a final wide view.

Describe the visual result, how it should behave, and any controls you want. The assistant should use the existing contracts, reuse shared components, integrate the feature into the editor, and validate it. Internal implementation guidance lives in `AGENTS.md`.

Scenes and text items use typed contracts for settings, timing, controls and rendering. Shared camera, style and fade modules keep behavior consistent across items. New features can build on these components while preserving saved projects and matching preview and export behavior.

## Create a project template

1. Create or open a project in the app and configure its scenes, texts, cameras, styles and soundtrack.
2. Give the project the name you want displayed on its template card.
3. Export the project as JSON. The export includes the project `name`, complete `film` configuration and source bitmap `data`.
4. Save or copy the exported JSON into `src/project-templates/projects/`, for example `src/project-templates/projects/my-template.json`.
5. Run `bun run dev` or `bun run build`. Templates are discovered automatically; no TypeScript changes or manual registration are required. If the development server is already running, adding the file triggers a rebuild and browser reload.
6. Create a new project, choose a bitmap, and select your template on the starting-point screen.

The card title comes from the JSON `name` field. The filename without `.json` is the template's stable ID; use a unique filename and keep it when updating an existing template. The `blank` ID is reserved for the built-in blank timeline.

The saved film configuration is preserved while data-driven content uses the chosen bitmap. Transaction references that do not exist in that bitmap are redirected to its largest parcel. Custom text remains as written in the exported project.

To update a template, export the revised project and replace its JSON file. Rebuild and republish `dist/` to update the hosted site. Existing projects remain unchanged. Before running standalone tests or type checking after adding or removing templates, run `bun run templates` to refresh the generated catalog.

## Privacy and project files

Projects and imported audio are stored locally in the browser using IndexedDB, with a localStorage recovery document for recent edits. The app does not include analytics, account authentication, wallet connections or private-key handling. Blockchain lookups make direct requests to Ordinals, which receives the requested block/inscription identifiers and the network information normally associated with an HTTP request.

Exported project JSON includes the project name, custom text, full film settings, bitmap data and any imported audio as embedded base64. These files are not encrypted. A JSON file placed in `src/project-templates/projects/` becomes public source and is bundled into the published site. Review its contents before sharing it. The bundled templates contain public blockchain data and no imported audio.

## Publishing and deployment

Commit source code, `public/` assets and their licenses, tests and fixtures, `bun.lock`, `.env.example`, and generated contract documentation. The ignore rules exclude dependencies, builds, temporary files, local environment files and machine-specific configuration. Review `git status --short` and the staged diff before publishing; ignore rules do not remove files already tracked by Git.

For production:

```sh
bun install --frozen-lockfile
bun run build
```

Publish the contents of `dist/` to GitHub Pages or another static HTTPS host. All templates, JavaScript, workers, styles and fonts are included; no Bun runtime, API routes or environment variables are needed on the host. Relative asset paths support project subdirectories such as `/bitmap-clips/`. Use `bun run start` only if you want a local static preview.

### Deploy with GitHub Pages

The included [GitHub Actions workflow](.github/workflows/pages.yml) installs Bun 1.4.2, builds the site, runs TypeScript checks and tests, and publishes only `dist/`.

1. Commit and push the source files, `bun.lock` and `.github/workflows/pages.yml` to your repository's `main` branch. Keep `dist/` ignored.
2. In the GitHub repository, open **Settings → Pages** and set **Build and deployment → Source** to **GitHub Actions**.
3. Open **Actions → Build and deploy to GitHub Pages**. If needed, choose **Run workflow** on `main` after enabling Pages, or push another commit.
4. Wait for the build and deployment jobs to succeed. Open the URL shown by the deployment, normally `https://<username>.github.io/<repository>/`.

Future pushes to `main` rebuild and publish automatically. No custom domain, separate server or deployment secret is required. If you rename the deployment branch, update the workflow's `push.branches` setting. Forks should enable Pages in their own repository settings.

Editing, rendering, audio, video export and project storage run entirely in the browser. Blockchain lookups go directly to `https://ordinals.com` and require its availability and CORS support. The HTML includes the Content Security Policy, including permission for Ordinals requests and local WebAssembly/workers. Serve through HTTPS (or localhost for development), rather than opening `index.html` with `file://`, for browser APIs such as workers and video encoding. Project storage remains local to each browser and origin.

The repository is distributed under the [MIT License](LICENSE). Preserve the separate licenses and attribution bundled with vendor code and fonts.
