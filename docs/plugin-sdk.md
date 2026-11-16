# Developing plugins for RuneSlate

This guide is for developers who want to extend RuneSlate. It covers how plugins work, the package format, the full `window.runeSlateApi` reference and the rules for writing safe, well-behaved plugins.

A complete working sample lives in this repository at `examples/plugins/dice-oracle/`.

## How plugins work

A plugin is a small web app made of plain browser scripts, styles and images. RuneSlate loads it into a **sandboxed iframe**:

- The iframe uses `sandbox="allow-scripts"` and gets an opaque origin. It is served from `rs-plugin://<plugin-id>/`.
- A strict Content Security Policy only allows files from the plugin itself.
- The plugin has **no** access to Node.js, Electron, the network, the file system or other programs.
- The only connection to RuneSlate is the global `window.runeSlateApi` object. RuneSlate injects it before your script runs. It talks to the DM window over `postMessage`.
- The DM window checks every request: it only accepts messages from your own iframe, enforces your permissions, validates every argument and rejects anything it does not expect.

A plugin can contribute three things:

| Contribution | Where it appears | How it is declared |
| --- | --- | --- |
| **Widgets** | In the widget drawer of the Slate; each instance is a node on a board | `widgets` in `manifest.json` |
| **Commands** | In the command palette (Ctrl/Cmd+K) | `commands` in `manifest.json` + `runeSlateApi.commands.register()` |
| **Stage overlay** | A plain-text box in one corner of the Stage | `updateStageOverlay()` with the `stage` permission |

### Runtime modes

Your entry script runs in one of two modes. Read the mode from `document.documentElement.dataset.rsMode`:

- `widget`: a visible node on the Slate. Every widget instance gets its own iframe.
- `background`: an invisible iframe that runs commands. RuneSlate only starts it when your manifest declares at least one command.

The same script is loaded in both modes, so check the mode before you build any UI.

## Package format

A plugin is a ZIP archive with the file extension `.runeslate` (`.zip` also works). `manifest.json` must sit at the root of the archive. A single top-level wrapper folder is removed automatically.

```text
my-plugin/
├── manifest.json
├── index.js
├── style.css        (optional)
└── icon.png         (optional)
```

Pack a folder with the script from the repository:

```sh
node tools/pack-plugin.mjs <folder> [out.runeslate]
npm run pack-example   # -> examples/plugins/dice-oracle.runeslate
```

### Archive limits

- At most 20 MB compressed, 50 MB uncompressed and 500 entries.
- Allowed file types: `js mjs css json png jpg jpeg svg webp gif md txt woff2`. Any other file makes the install fail. This includes files without an extension, such as `LICENSE`: name it `LICENSE.txt`.
- No absolute paths, `..` segments, backslashes, drive letters, symbolic links, or paths that only differ in case.

### Installing, enabling and updating

1. In RuneSlate open **Settings → Plugins** and click **Install plugin…**.
2. Plugins are installed **per workspace** into `<workspace>/plugins/<id>/`.
3. A new plugin is **disabled** after the first install. The DM reviews the requested permissions and enables it.
4. Installing a newer archive with the same `id` updates the plugin. It stays enabled, unless the update asks for different permissions; then the DM has to enable it again.
5. Uninstalling removes the plugin files and its stored data. Its widgets stay on the boards as placeholders.

## Manifest reference

```json
{
  "id": "dice-oracle",
  "name": "Dice Oracle",
  "version": "1.0.0",
  "apiVersion": 1,
  "main": "index.js",
  "description": "Ask a yes/no question and let the oracle answer.",
  "author": "Your Name",
  "permissions": ["dice", "sfx", "stage", "storage"],
  "widgets": [{ "type": "oracle", "name": "Dice Oracle", "width": 280, "height": 200 }],
  "commands": [{ "id": "ask-oracle", "title": "Ask the Oracle" }]
}
```

| Field | Required | Rules |
| --- | --- | --- |
| `id` | yes | `^[a-z0-9][a-z0-9-]{1,63}$`. Unique; also the install folder and the `rs-plugin://` host. Never change it between versions. |
| `name` | yes | 1–80 characters. |
| `version` | yes | Semantic version such as `1.2.3`, `1.2.3-beta.1` or `1.2.3+build.5`. |
| `apiVersion` | yes | Must be `1`. |
| `main` | yes | Relative path to the entry script. Must end in `.js`, must exist in the archive and must not start with `__`. |
| `description` | no | Up to 1000 characters. Shown in Settings. |
| `author` | no | Up to 120 characters. |
| `permissions` | no | Array of permissions from the table below. Unknown values make the install fail. Defaults to none. |
| `widgets` | no | Up to 32 entries. `type` matches `^[a-z0-9-]{1,40}$` and is unique; `name` 1–80 characters; `width` / `height` are optional integers from 80 to 2000 (default node size in px). |
| `commands` | no | Up to 32 entries. `id` matches `^[a-z0-9-]{1,40}$` and is unique; `title` 1–80 characters. |

Unknown fields are ignored.

## Permissions

A plugin can only call what it declared in `permissions` **and** what the DM accepted when enabling it.

| Permission | Unlocks |
| --- | --- |
| `entities:read` | `getEntities()`: Lore entries of the active world. Also lets the encounter generator use homebrew creatures. |
| `dice` | Dice rolls. `rollDice()` is computed locally; declare this permission so the DM knows the plugin rolls dice. |
| `sfx` | `triggerSfx()`: play a Vault audio file on the SFX channel. |
| `stage` | `updateStageOverlay()`: show a plain-text overlay on the Stage. |
| `storage` | `storage.get()` / `storage.set()`: per-plugin key/value storage in `world.db`. |
| `generators` | `generators.*`: the NPC, village, tavern and encounter generators of the Tools tab. |
| `time:read` | `getCampaignTime()`, `getCountdowns()`: the in-game clock of the active campaign. |
| `time:write` | `advanceCampaignTime()`, `rollWeather()`: change the clock and the weather. |

Without the matching permission a call is rejected. Promise-based calls reject with an `Error` whose message starts with `RuneSlate: permission "…" required`.

## API reference

All members live on the frozen object `window.runeSlateApi`. Unless stated otherwise, asynchronous calls time out after **10 seconds** and reject with an `Error`.

### Basics

```ts
runeSlateApi.version: string                    // SDK version, currently "1.2.0"
runeSlateApi.getActiveWorldId(): string | null
runeSlateApi.getActiveCampaignId(): string | null
runeSlateApi.on(
  event: 'context-changed',
  cb: (ctx: { worldId: string | null; campaignId: string | null }) => void
): () => void                                   // returns an unsubscribe function
```

The context (world, campaign, widget state) arrives **just after** your script has run. Read it in a `context-changed` or `onStateChange` listener, not only at the top level. Both fire once when the context arrives, and again whenever it changes.

### Lore entries: `getEntities` (`entities:read`)

```ts
getEntities(type?: string): Promise<Array<{
  id: string;
  type: string;            // e.g. 'character', 'location', 'creature', 'custom:<id>'
  name: string;
  imageAssetId: string | null;
  updatedAt: number;
}>>
```

Returns summaries of the active world's Lore entries, optionally filtered by type, at most 500 entries. An unknown type returns an empty list. Rejects when no world is open.

### Dice: `rollDice`

```ts
rollDice(formula: string): { formula: string; result: number; rolls: number[] }
```

Synchronous and computed inside the iframe with a cryptographic random number generator. Supports `NdM`, `dM`, constants and several terms joined with `+` / `-`, for example `2d6+1d4+3`. At most 100 dice per roll and 1000 sides per die. The formula needs at least one die. Invalid formulas **throw**.

### Sound effects: `triggerSfx` (`sfx`)

```ts
triggerSfx(assetId: string): void
```

Plays a Vault audio file on the SFX channel, which is independent of music and ambience. Asset IDs that are not audio files in the Vault are rejected.

### Stage overlay: `updateStageOverlay` (`stage`)

```ts
updateStageOverlay(overlay: {
  title?: string;          // up to 80 characters
  lines: string[];         // up to 12 lines, up to 200 characters each
  position: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
} | null): void            // null removes the overlay
```

Each plugin has one overlay. Calling it again replaces the previous one. Longer texts are cut off. The text is always rendered as plain text; HTML is never interpreted. The overlay is removed when the plugin is disabled or the world is closed.

### Storage (`storage`)

```ts
storage.get(key: string): Promise<unknown>             // null for missing keys
storage.set(key: string, value: unknown): Promise<void> // undefined deletes the key
```

- Per plugin and per world, stored in `world.db`. Shared by all widget instances and the background runtime of your plugin.
- Keys up to 128 characters. Values must be JSON-serializable and at most 64 KB as JSON. At most 500 keys per plugin.
- Deleted when the plugin is uninstalled.

### Widgets

```ts
widget.getState(): unknown                              // persisted state of this Slate node
widget.setState(state: unknown): void                   // saves into the node (widget mode only)
widget.onStateChange(cb: (state: unknown) => void): () => void
widget.getContext(): { widgetType: string; nodeId: string } | null   // null in background mode
```

- Use widget state for data that belongs to one node, such as its settings. Use `storage` for data shared by all instances.
- The state must be plain, structured-cloneable data (no functions, DOM nodes or class instances). It is saved with the board.
- `setState` does not trigger your own `onStateChange` listeners. In background mode it does nothing.
- `getContext().widgetType` tells you which of your manifest widgets this iframe renders.

### Commands

```ts
commands.register(id: string, handler: () => void | Promise<void>): void
```

`id` must be declared in the manifest's `commands`. The command appears in the command palette as "Plugin: <title>". Commands run in the background runtime, so register them **before** the `rsMode` check.

### Generators (`generators`)

```ts
generators.npc(params?): Promise<PluginNpcResult>
generators.village(params?): Promise<VillageResult>
generators.tavern(params?): Promise<TavernResult>
generators.encounter(params?): Promise<EncounterResult>
```

Every parameter is optional; unknown or invalid values fall back to random values or defaults. Every call accepts `locale: 'en' | 'de'` (default: the DM's UI language).

| Generator | Parameters |
| --- | --- |
| `npc` | `race`, `gender` (`'male'` / `'female'`), `archetype` |
| `village` | `settlementType` (`'hamlet'` / `'village'` / `'town'` / `'city'`), `terrain` |
| `tavern` | `quality` (`'poor'` / `'modest'` / `'comfortable'` / `'wealthy'`), `settlementType` |
| `encounter` | `partyLevel` (1–20, default 3), `partySize` (1–8, default 4), `difficulty` (`'easy'` / `'medium'` / `'hard'` / `'deadly'`), `terrain` or `'any'`, `crMin` / `crMax` (e.g. `"1/4"`), `sources` (`'srd'` / `'homebrew'` / `'both'`), `maxGroups` (1–4) |

`terrain` is one of `forest`, `mountain`, `swamp`, `desert`, `arctic`, `coast`, `underdark`, `urban`, `grassland`, `dungeon`.

- NPC results also contain `name`, `raceName` and the archetype's `statblock`.
- Encounter results contain `groups` (monster, CR, XP, count, AC, HP), a story `hook` and the XP `balance` with the party thresholds and a rating.
- The generators use the embedded SRD data and the world's CSV flavor pools. Homebrew creatures are only used when the plugin also has `entities:read`.
- Generators never write to the database.

The result objects are plain JSON; use `runeSlateApi.version` to feature-detect newer fields.

### In-game time (`time:read` / `time:write`)

```ts
getCampaignTime(): Promise<CampaignTime | null>                    // time:read
advanceCampaignTime(minutes: number): Promise<CampaignTime | null> // time:write; negative rewinds
getCountdowns(): Promise<Array<{
  id: string; title: string; mode: 'target_date' | 'relative_minutes';
  remainingMinutes: number; isTriggered: boolean; isVisibleToPlayers: boolean;
}>>                                                                 // time:read
rollWeather(): Promise<WeatherState | null>                        // time:write

interface CampaignTime {
  campaignId: string;
  timestamp: GameTimestamp;
  dateText: string;         // localized, e.g. "14 Mirtul 1492 DR"
  timeText: string;         // "HH:MM"
  stage: TimeOfDayStage;    // 'dawn' | 'morning' | 'noon' | 'afternoon' | 'evening' | 'night'
  season: SeasonKey;
  weather: WeatherState | null;
}
```

All time calls return `null` (or an empty list) when no campaign is active.

## Runtime environment

- The entry script is loaded as a **classic script**. ES modules (`import` / `export`) are not supported, so bundle your code into one file (for example with esbuild or Rollup using the `iife` format).
- The page contains an empty `<div id="root"></div>` for your UI.
- You may load your own files with paths relative to the plugin root, for example `<link rel="stylesheet" href="style.css">` or `<img src="icon.png">`.
- Content Security Policy:
  - Scripts, styles and fonts only from your plugin (`rs-plugin://<id>`). Inline styles are allowed.
  - Images from your plugin, from the Vault (`rs-asset:`) and as `data:` URLs.
  - No `fetch`, XHR or WebSocket (`connect-src 'none'`), no forms, no `<base>`.
- Widget iframes resize automatically: the SDK measures your content and the node grows or shrinks with it, between 120 × 80 and 1200 × 1200 px. Until the first measurement the node uses the `width` / `height` from the manifest (default 280 × 200).
- Each iframe may send at most 50 requests per second; additional requests are rejected.

## Example

A minimal plugin with one widget and one command:

```js
(function () {
  'use strict';
  var api = window.runeSlateApi;
  if (!api) return;

  // 1. Commands first: they run in the background runtime.
  api.commands.register('roll-d20', function () {
    var roll = api.rollDice('1d20');
    api.updateStageOverlay({ title: 'd20', lines: [String(roll.result)], position: 'top-right' });
  });

  // 2. Widget UI only in widget mode.
  if (document.documentElement.dataset.rsMode !== 'widget') return;

  var root = document.getElementById('root');
  var button = document.createElement('button');
  button.textContent = 'Roll d20';
  button.addEventListener('click', function () {
    var roll = api.rollDice('1d20');
    button.textContent = 'Rolled ' + roll.result;
    api.widget.setState({ last: roll.result });
  });
  root.appendChild(button);

  // 3. Restore the saved state once it arrives.
  api.widget.onStateChange(function (state) {
    if (state && typeof state.last === 'number') button.textContent = 'Rolled ' + state.last;
  });
})();
```

Matching manifest:

```json
{
  "id": "quick-d20",
  "name": "Quick d20",
  "version": "1.0.0",
  "apiVersion": 1,
  "main": "index.js",
  "permissions": ["dice", "stage"],
  "widgets": [{ "type": "roller", "name": "Quick d20", "width": 200, "height": 120 }],
  "commands": [{ "id": "roll-d20", "title": "Roll a d20 on the Stage" }]
}
```

The full sample `examples/plugins/dice-oracle/` also uses storage and shows how to share data between widget instances and commands.

## Security and best practices

### Ask for as little as possible

- Only declare the permissions you really use. The DM sees the list before enabling your plugin, and a short list builds trust.
- Adding a permission in an update disables the plugin until the DM confirms it again. Plan your permissions early.

### Handle errors

- Every asynchronous call can reject: missing permission, no active world or campaign, invalid arguments or a timeout. Always add `.catch()` or `try` / `catch`.
- `rollDice` throws synchronously on invalid formulas.
- Show the DM a short, calm message in your widget instead of failing silently. Log details with `console.warn`.

### Keep the table running

- RuneSlate is used live at the gaming table. Avoid heavy loops, busy timers and large DOM trees; every widget instance is its own iframe.
- Don't keep the Stage overlay up forever. Remove it with `updateStageOverlay(null)` when it is no longer needed.
- Keep widget state small. Large or shared data belongs in `storage`, and remember the 64 KB value limit.

### Fit into the app

- RuneSlate has a dark and a light theme and German and English. API version 1 does not tell your plugin which theme or language is active. Choose colors with enough contrast on both light and dark backgrounds, or let the widget bring its own clearly framed background.
- Pass `locale` to the generators if your plugin is written for one language; by default they follow the DM's language.
- Use the DM's terms: **Slate**, **Lore**, **Vault**, **Stage**, **Map**.
- Keyboard: don't catch global keys. Your iframe only receives key events while it has focus.

### Treat data as untrusted

- Lore names, storage values and generator results are user content. Insert them with `textContent`, never with `innerHTML`.
- Don't use `eval` or `new Function`; the CSP blocks them anyway.

### Versioning

- Increase `version` with every release, following semantic versioning.
- Keep `id` stable forever; a new `id` is a new plugin and loses all stored data.
- Make your code cope with old widget state and storage values written by earlier versions.
- Check `runeSlateApi.version` before you use newer functions: generators need SDK 1.1.0 or later, the time API 1.2.0 or later.
