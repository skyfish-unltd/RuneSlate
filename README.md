# RuneSlate

**RuneSlate** is a free, local, offline-first desktop app for D&D 5e Dungeon Masters: plan sessions on an
infinite Slate, keep your world's Lore, Maps and Vault in one place, and show pictures, maps, initiative,
time and weather to your players on a second window, the Stage.

- Slate with 13 widgets (scenes, checks, battle tracker, calendar, countdowns, weather, …)
- Lore, Vault and Maps with POIs and Fog of War
- Player-facing Stage window with music, sound effects and weather ambience
- Offline SRD 5.1 Encyclopedia and procedural generators
- Open plugin SDK (`window.runeSlateApi`)
- English & German, dark & light mode. No account, no cloud: your data stays on your disk.

## Download

Get the latest installer for **Windows** (`.exe`), **macOS** (`.dmg`) or **Linux** (`.AppImage` / `.deb`) from
the [**Releases**](https://github.com/skyfish-unltd/RuneSlate/releases/latest) page. The release notes are listed
with every version. Installed copies update themselves automatically.

### macOS

- **Pick the right build:** Apple Silicon (M1/M2/M3/M4) → `…-arm64.dmg` / `…-arm64-mac.zip`;
  Intel Macs → `…-x64.dmg` / `…-x64-mac.zip`. The Intel build also starts on Apple Silicon, but runs slowly
  through Rosetta.
- **First launch:** the builds are not notarized yet. Right-click the app → **Open**. On macOS 15 (Sequoia)
  and later, open it once, then go to **System Settings → Privacy & Security** and click **Open Anyway**.
- If macOS still says the app "is damaged", remove the download quarantine once in Terminal:

  ```bash
  xattr -dr com.apple.quarantine /Applications/RuneSlate.app
  ```

- If the in-app update fails on macOS, download the new version from the Releases page and replace the app.

## Plugin SDK

RuneSlate is closed-source freeware, but its plugin interface is open: plugins are small sandboxed web apps that
talk to the app through `window.runeSlateApi` (SDK 1.2).

- Documentation: [docs/plugin-sdk.md](docs/plugin-sdk.md) ([Deutsch](docs/plugin-sdk.de.md))
- Sample plugin: [examples/plugins/dice-oracle](examples/plugins/dice-oracle)
- Pack a plugin: `npm install`, then `node tools/pack-plugin.mjs <folder>`

## Bugs & feature requests

Found a bug or have an idea? Please open an [issue](https://github.com/skyfish-unltd/RuneSlate/issues/new/choose).
This repository contains the releases, the plugin SDK and the issue tracker; the application source code is not
public.

## Terms

RuneSlate is free to use. See [TERMS.md](TERMS.md).
