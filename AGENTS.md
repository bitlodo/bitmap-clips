# Project instructions

## Language

All text implemented in this software must be in English, even when the user gives instructions in another language.

- Use English for UI labels, buttons, menus, tooltips, placeholders, notifications, validation messages, errors, accessibility text, and default or example content.
- Write new code identifiers, comments, documentation, and tests in English.
- Keep shared components and generated contracts consistent with the English UI.
- Preserve user-entered content in its original language.
- Conversation replies may follow the user's language; this does not change the software's English-only requirement.

## Implementing natural-language feature requests

Users describe the result they want in ordinary language. Translate that intent into the app's architecture yourself; do not require users to name contracts, files, registries, settings keys or validation commands. Implement and validate the complete feature rather than returning a technical prompt for the user to submit again.

- Infer whether the request needs a scene, a text item, a shared module, a project template, or changes across those layers. Extend existing behavior when that matches the request; create a separate library item when the user asks for one.
- Inspect the current definitions and rendering paths before choosing the implementation. Use the contracts below as the source of truth and reuse existing components and helpers.
- Choose sensible bounded settings, defaults and concise English controls from the requested behavior. Ask for clarification only when a material product decision cannot reasonably be inferred; otherwise proceed and report assumptions.
- Preserve unrelated work, existing item behavior, stable saved-project contracts and migrations. Do not commit or publish unless the user requests it.

### Choose scene or text from the requested behavior

Classify each requested timeline item yourself before implementation. Users may say "item", "effect", "display" or "component" without referring to an internal item type.

- Use a **scene** when the primary behavior changes the bitmap's cubes, geometry, assembly, spatial animation, camera or overall 3D presentation. Cubes pulsing with music belong to a scene.
- Use a **text item** when the primary behavior presents or animates readable content, captions, labels, transaction values or typographic effects. A Matrix-style display of the bitmap's transactions belongs to a text item, even if it uses animated positioning or needs additional renderer support.
- A visual style or the word "display" alone does not determine the type. Classify by what the item controls and the output it produces, then use the corresponding definition, registry and rendering contract.
- If the request combines independently timed scene and text behavior, compose both item types and reuse shared modules where appropriate. Ask only when the intended result leaves a material ambiguity that cannot reasonably be resolved from context.

### Interpret creative requests end to end

For a request such as "Create a new item that makes the cubes pulse with the music", inspect the audio model, soundtrack timing, scene plan and render/export paths. Implement actual audio-driven behavior using the applicable soundtrack data, including imported audio if supported by the feature's scope. Define predictable behavior for silence or missing audio. Sample the same timeline-aligned analysis in preview, seeking and export; do not substitute an unrelated looping pulse or rely only on a live audio playback clock. Persist the configuration needed to reproduce the result and test synchronization and fallback behavior.

For a request such as "Create a Matrix-style text display using this bitmap's transactions", inspect SceneData and the text layout/rendering contracts. Build the effect from the current bitmap's transaction data, reuse shared text-style/fade behavior, and add renderer support if existing title plans cannot represent the requested effect. Keep generated motion deterministic for the same saved settings and frame. Handle empty or large transaction sets, keep text timing independent of scenes, and verify preview/export consistency. Do not substitute unrelated example transactions.

These are routing examples, not requests to implement those effects automatically.

### Understand the contracts first

A timeline item is a validated data instance, not an independent UI widget. Its definition supplies metadata, a Zod settings schema, declarative property controls and a `build` function. The registry connects definitions to the editor and runtime builders. Controls reference schema keys and may use `when` to show a field conditionally without discarding its value.

| Contract | Source | Responsibility |
| --- | --- | --- |
| Visual timeline timing | [timeline-contract.ts](src/timeline-contract.ts) | `startFrame`, `durationFrames`, fades and alpha sampling |
| Scene definition | [clips/types.ts](src/clips/types.ts) | `defineClip`, scene controls, common instance fields and `ClipPlan` |
| Text definition | [texts/types.ts](src/texts/types.ts) | `defineText`, text controls, layout and `TextPlan` |
| Reusable modules | [timeline-modules.ts](src/timeline-modules.ts) | Camera, scene style, text style and fade schema composition |
| Saved film | [clips/film.ts](src/clips/film.ts) | Construction, validation, serialization and migrations |
| Project template | [project-templates/types.ts](src/project-templates/types.ts) | Metadata, preview and a builder returning a `Film` |

Visual timing uses frames at **30 fps**. Scenes and texts share timing fields but have different duration constraints and rendering plans. Audio uses its own contracts in [imported-audio.ts](src/imported-audio.ts) and [techno.ts](src/techno.ts); adding a new track category requires explicit editor, storage and export integration.

Run `bun run contracts` to regenerate the machine-readable manifests in [docs/contracts/](docs/contracts/). They describe current library definitions and shared modules; edit the TypeScript sources, then regenerate the JSON. These manifests are documentation, not a plugin loader or a replacement for film validation.

### Add a scene timeline item

1. Inspect [Display](src/clips/display/index.ts) for a small example and [Reveal](src/clips/reveal/index.ts) for a scene with conditional controls.
2. Create `src/clips/<scene-id>/index.ts` using `defineClip`. Provide a stable unique ID, version, English metadata, duration bounds/default, settings schema with defaults, controls and a builder returning a `ClipPlan`.
3. Reuse the standard scene modules. Keep scene-specific settings in the definition schema; camera, style and fade fields belong to their shared modules.
4. Register the definition in the public `clips` array in [clips/registry.ts](src/clips/registry.ts). Compatibility-only definitions are intentionally separate. Library cards, the Add scene menu and existing property control kinds consume registry metadata.
5. Reuse existing engine behavior where possible. A new rendering primitive also needs changes in the engine model and renderer, with matching preview/export behavior. Review [scene-icons.ts](src/scene-icons.ts) if the new scene needs a dedicated library icon.
6. Validate construction with `makeClip`, settings parsing with `settingsFor`, building with `buildClip`, and save/import round trips through `validateFilm` and `parseDocument`. Regenerate contracts and inspect the browser library, properties, timeline, preview and export.

### Add a text timeline item

Use [Text badge](src/texts/caption/index.ts) as the minimal example. Create a module under `src/texts/`, call `defineText`, and provide its schema, controls, `supportedProperties`, layout, duration metadata and a builder returning `TextPlan`. Reuse [texts/shared.ts](src/texts/shared.ts) and register the definition in the public `texts` array in [texts/registry.ts](src/texts/registry.ts).

The existing text style and fade modules are shared across text definitions. Reuse the current title rendering paths; a new layout or rendering behavior may need explicit support in [texts/renderer.ts](src/texts/renderer.ts) and [title-renderer.ts](src/title-renderer.ts).

### Reuse or add a component

Here, a reusable module is a shared schema and field-ownership contract. It is not a standalone visual component framework. `cameraModule`, `sceneStyleModule`, `textStyleModule` and `fadeModule` define fields reused by multiple timeline items. `settingsKeys` identifies fields stored in `settings`; `instanceKeys` identifies fields stored on the item itself. `extendSettings` and `extendInstance` compose schemas and reject duplicate field ownership.

Scenes default to `sceneModules`; texts default to `textModules`. Reuse those modules instead of copying their fields into each definition. Shared controls and behavior live in files such as `camera-animation-controls.ts`, `scene-style-controls.ts`, `text-style-controls.ts` and `camera-settings.ts`.

Adding a new module does **not** automatically create its UI, default values, persistence or rendering behavior. Inspect factories in `clips/film.ts` and `texts/registry.ts`, film validation, property bindings in `client.ts`, and the applicable renderers. A new control `kind` also requires updating its type and editor rendering/event bindings.

### Add a project template

For nonblank templates, keep an exported project JSON in `src/project-templates/projects/` as the authoritative configuration. Exports include the user's project name in top-level `name`, alongside `film` and `data`. Use `defineExportedProjectTemplate` from `exported-project.ts`; it derives the displayed name from JSON and clones the saved film. Do not reconstruct exported settings in TypeScript. Preserve cameras, timing, styles, render quality, audio and seeds. Resolve data-driven content against the selected bitmap; repair only transaction indices that are absent from that bitmap. Add the JSON to `src/project-templates/projects/`; development and production builds generate `catalog.generated.ts` automatically. Do not create handwritten wrappers or edit the generated catalog. The filename supplies the stable template ID; `name` supplies the displayed title. Run `bun run templates` before standalone tests or type checking after adding/removing JSON files. Test exact film equivalence to the export, name propagation, independent copies and cross-bitmap references. Blank or procedural templates can use `defineProjectTemplate` and `composeTemplate`.

### Verify a contribution

Run the validation commands above and review the resulting diff, including regenerated contracts. Add tests for behavior and compatibility boundaries. In the browser, exercise adding the item, changing controls, moving/resizing, undo/redo, saving/importing, preview and export. Automated tests alone do not establish visual correctness or GPU compatibility.

Preserve stable IDs, saved fields and existing migrations. `settingsVersion` and definition versions are currently constrained to `1`; changing a version requires coordinated schema, loader and migration work. A new feature must not silently reinterpret an older project.


## Static client deployment

The app must run entirely in the browser from `dist/`, including blockchain requests, rendering, audio and exports. Ordinals requests go directly to `https://ordinals.com` using CORS without credentials. Do not introduce backend API or proxy dependencies. Keep assets and worker URLs relative so deployments work in subdirectories. Keep the CSP in `public/index.html` compatible with direct requests and local WebAssembly/workers. Bun is a build/development tool; `src/server.ts` is only an optional static preview server.
