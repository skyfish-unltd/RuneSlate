# RuneSlate plugin examples

The full plugin developer documentation (package format, manifest, permissions, `window.runeSlateApi`
reference, security and best practices) is in [`docs/plugin-sdk.md`](../../docs/plugin-sdk.md)
(German: [`docs/plugin-sdk.de.md`](../../docs/plugin-sdk.de.md)). In RuneSlate you can also open it from the
start screen under **Help → Plugin development**.

## dice-oracle

`dice-oracle/` is a complete sample: one Slate widget, one command for the command palette, a Stage
overlay and shared storage. Build its archive from the repository root with:

```sh
npm install
npm run pack-example   # -> examples/plugins/dice-oracle.runeslate
```

Pack your own folder with `node tools/pack-plugin.mjs <folder> [out.runeslate]`, then install the
archive in RuneSlate under **Settings → Plugins → Install plugin…**.
