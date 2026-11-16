# Plugins für RuneSlate entwickeln

Diese Anleitung richtet sich an Entwickler, die RuneSlate erweitern möchten. Sie erklärt, wie Plugins funktionieren, das Paketformat, die vollständige Referenz von `window.runeSlateApi` und die Regeln für sichere, gut eingebundene Plugins.

Ein vollständiges, lauffähiges Beispiel liegt in diesem Repository unter `examples/plugins/dice-oracle/`.

## So funktionieren Plugins

Ein Plugin ist eine kleine Web-App aus einfachen Browser-Skripten, Stylesheets und Bildern. RuneSlate lädt es in einen **abgeschotteten iframe**:

- Der iframe nutzt `sandbox="allow-scripts"` und bekommt einen opaken Ursprung. Er wird von `rs-plugin://<plugin-id>/` ausgeliefert.
- Eine strikte Content Security Policy erlaubt nur Dateien aus dem Plugin selbst.
- Das Plugin hat **keinen** Zugriff auf Node.js, Electron, das Netzwerk, das Dateisystem oder andere Programme.
- Die einzige Verbindung zu RuneSlate ist das globale Objekt `window.runeSlateApi`. RuneSlate stellt es bereit, bevor dein Skript läuft. Es kommuniziert per `postMessage` mit dem DM-Fenster.
- Das DM-Fenster prüft jede Anfrage: Es akzeptiert nur Nachrichten aus deinem eigenen iframe, setzt deine Berechtigungen durch, validiert jedes Argument und lehnt alles Unerwartete ab.

Ein Plugin kann drei Dinge beitragen:

| Beitrag | Wo er erscheint | Wie er deklariert wird |
| --- | --- | --- |
| **Widgets** | In der Widget-Leiste der Slate; jede Instanz ist ein Knoten auf einem Board | `widgets` in `manifest.json` |
| **Befehle** | In der Befehlspalette (Strg/Cmd+K) | `commands` in `manifest.json` + `runeSlateApi.commands.register()` |
| **Stage-Overlay** | Ein reiner Textkasten in einer Ecke der Stage | `updateStageOverlay()` mit der Berechtigung `stage` |

### Laufzeit-Modi

Dein Einstiegsskript läuft in einem von zwei Modi. Den Modus liest du aus `document.documentElement.dataset.rsMode`:

- `widget`: ein sichtbarer Knoten auf der Slate. Jede Widget-Instanz bekommt einen eigenen iframe.
- `background`: ein unsichtbarer iframe, der Befehle ausführt. RuneSlate startet ihn nur, wenn dein Manifest mindestens einen Befehl deklariert.

In beiden Modi wird dasselbe Skript geladen. Prüfe also den Modus, bevor du eine Oberfläche aufbaust.

## Paketformat

Ein Plugin ist ein ZIP-Archiv mit der Endung `.runeslate` (`.zip` geht auch). `manifest.json` muss im Wurzelverzeichnis des Archivs liegen. Ein einzelner umschließender Ordner wird automatisch entfernt.

```text
mein-plugin/
├── manifest.json
├── index.js
├── style.css        (optional)
└── icon.png         (optional)
```

Einen Ordner packst du mit dem Skript aus dem Repository:

```sh
node tools/pack-plugin.mjs <ordner> [ausgabe.runeslate]
npm run pack-example   # -> examples/plugins/dice-oracle.runeslate
```

### Grenzen des Archivs

- Höchstens 20 MB komprimiert, 50 MB entpackt und 500 Einträge.
- Erlaubte Dateitypen: `js mjs css json png jpg jpeg svg webp gif md txt woff2`. Jede andere Datei lässt die Installation fehlschlagen. Das gilt auch für Dateien ohne Endung wie `LICENSE`: Nenne sie `LICENSE.txt`.
- Keine absoluten Pfade, keine `..`-Segmente, Backslashes, Laufwerksbuchstaben, symbolischen Links oder Pfade, die sich nur in Groß-/Kleinschreibung unterscheiden.

### Installieren, aktivieren und aktualisieren

1. Öffne in RuneSlate **Einstellungen → Plugins** und klicke auf **Plugin installieren…**.
2. Plugins werden **pro Workspace** nach `<workspace>/plugins/<id>/` installiert.
3. Ein neues Plugin ist nach der ersten Installation **deaktiviert**. Der DM prüft die angefragten Berechtigungen und aktiviert es.
4. Ein neueres Archiv mit derselben `id` aktualisiert das Plugin. Es bleibt aktiviert, außer das Update verlangt andere Berechtigungen; dann muss der DM es erneut aktivieren.
5. Beim Deinstallieren werden die Plugin-Dateien und seine gespeicherten Daten entfernt. Seine Widgets bleiben als Platzhalter auf den Boards.

## Manifest-Referenz

```json
{
  "id": "dice-oracle",
  "name": "Dice Oracle",
  "version": "1.0.0",
  "apiVersion": 1,
  "main": "index.js",
  "description": "Stelle eine Ja/Nein-Frage und lass das Orakel antworten.",
  "author": "Dein Name",
  "permissions": ["dice", "sfx", "stage", "storage"],
  "widgets": [{ "type": "oracle", "name": "Dice Oracle", "width": 280, "height": 200 }],
  "commands": [{ "id": "ask-oracle", "title": "Das Orakel befragen" }]
}
```

| Feld | Pflicht | Regeln |
| --- | --- | --- |
| `id` | ja | `^[a-z0-9][a-z0-9-]{1,63}$`. Eindeutig; zugleich Installationsordner und `rs-plugin://`-Host. Zwischen Versionen nie ändern. |
| `name` | ja | 1–80 Zeichen. |
| `version` | ja | Semantische Version wie `1.2.3`, `1.2.3-beta.1` oder `1.2.3+build.5`. |
| `apiVersion` | ja | Muss `1` sein. |
| `main` | ja | Relativer Pfad zum Einstiegsskript. Muss auf `.js` enden, im Archiv existieren und darf nicht mit `__` beginnen. |
| `description` | nein | Bis zu 1000 Zeichen. Wird in den Einstellungen angezeigt. |
| `author` | nein | Bis zu 120 Zeichen. |
| `permissions` | nein | Array aus Berechtigungen der Tabelle unten. Unbekannte Werte lassen die Installation fehlschlagen. Standard: keine. |
| `widgets` | nein | Bis zu 32 Einträge. `type` passt auf `^[a-z0-9-]{1,40}$` und ist eindeutig; `name` 1–80 Zeichen; `width` / `height` optional, ganze Zahlen von 80 bis 2000 (Startgröße des Knotens in px). |
| `commands` | nein | Bis zu 32 Einträge. `id` passt auf `^[a-z0-9-]{1,40}$` und ist eindeutig; `title` 1–80 Zeichen. |

Unbekannte Felder werden ignoriert.

## Berechtigungen

Ein Plugin darf nur aufrufen, was es in `permissions` deklariert hat **und** was der DM beim Aktivieren bestätigt hat.

| Berechtigung | Schaltet frei |
| --- | --- |
| `entities:read` | `getEntities()`: Lore-Einträge der aktiven Welt. Erlaubt dem Begegnungsgenerator außerdem Homebrew-Kreaturen. |
| `dice` | Würfelwürfe. `rollDice()` wird lokal berechnet; deklariere die Berechtigung trotzdem, damit der DM weiß, dass das Plugin würfelt. |
| `sfx` | `triggerSfx()`: eine Audiodatei aus dem Vault auf dem SFX-Kanal abspielen. |
| `stage` | `updateStageOverlay()`: ein reines Text-Overlay auf der Stage zeigen. |
| `storage` | `storage.get()` / `storage.set()`: Schlüssel-Wert-Speicher pro Plugin in `world.db`. |
| `generators` | `generators.*`: die NSC-, Dorf-, Tavernen- und Begegnungsgeneratoren aus dem Tools-Tab. |
| `time:read` | `getCampaignTime()`, `getCountdowns()`: die Spielzeit der aktiven Kampagne. |
| `time:write` | `advanceCampaignTime()`, `rollWeather()`: Uhr und Wetter verändern. |

Ohne passende Berechtigung wird ein Aufruf abgelehnt. Promise-basierte Aufrufe werden mit einem `Error` abgelehnt, dessen Meldung mit `RuneSlate: permission "…" required` beginnt.

## API-Referenz

Alle Mitglieder liegen auf dem eingefrorenen Objekt `window.runeSlateApi`. Wenn nicht anders angegeben, laufen asynchrone Aufrufe nach **10 Sekunden** ab und werden mit einem `Error` abgelehnt.

### Grundlagen

```ts
runeSlateApi.version: string                    // SDK-Version, aktuell "1.2.0"
runeSlateApi.getActiveWorldId(): string | null
runeSlateApi.getActiveCampaignId(): string | null
runeSlateApi.on(
  event: 'context-changed',
  cb: (ctx: { worldId: string | null; campaignId: string | null }) => void
): () => void                                   // gibt eine Abmeldefunktion zurück
```

Der Kontext (Welt, Kampagne, Widget-Zustand) kommt **kurz nachdem** dein Skript gelaufen ist. Lies ihn in einem `context-changed`- oder `onStateChange`-Listener, nicht nur auf oberster Ebene. Beide feuern einmal, wenn der Kontext ankommt, und erneut bei jeder Änderung.

### Lore-Einträge: `getEntities` (`entities:read`)

```ts
getEntities(type?: string): Promise<Array<{
  id: string;
  type: string;            // z. B. 'character', 'location', 'creature', 'custom:<id>'
  name: string;
  imageAssetId: string | null;
  updatedAt: number;
}>>
```

Liefert Zusammenfassungen der Lore-Einträge der aktiven Welt, optional nach Typ gefiltert, höchstens 500 Einträge. Ein unbekannter Typ liefert eine leere Liste. Wird abgelehnt, wenn keine Welt geöffnet ist.

### Würfeln: `rollDice`

```ts
rollDice(formula: string): { formula: string; result: number; rolls: number[] }
```

Synchron und im iframe mit einem kryptografischen Zufallsgenerator berechnet. Unterstützt `NdM`, `dM`, Konstanten und mehrere Terme mit `+` / `-`, zum Beispiel `2d6+1d4+3`. Höchstens 100 Würfel pro Wurf und 1000 Seiten pro Würfel. Die Formel braucht mindestens einen Würfel. Ungültige Formeln **werfen eine Ausnahme**.

### Soundeffekte: `triggerSfx` (`sfx`)

```ts
triggerSfx(assetId: string): void
```

Spielt eine Audiodatei aus dem Vault auf dem SFX-Kanal ab, der unabhängig von Musik und Ambience ist. Asset-IDs, die keine Audiodatei im Vault sind, werden abgelehnt.

### Stage-Overlay: `updateStageOverlay` (`stage`)

```ts
updateStageOverlay(overlay: {
  title?: string;          // bis zu 80 Zeichen
  lines: string[];         // bis zu 12 Zeilen mit je bis zu 200 Zeichen
  position: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
} | null): void            // null entfernt das Overlay
```

Jedes Plugin hat ein Overlay. Ein erneuter Aufruf ersetzt das vorherige. Längere Texte werden abgeschnitten. Der Text wird immer als reiner Text dargestellt; HTML wird nie interpretiert. Das Overlay verschwindet, wenn das Plugin deaktiviert oder die Welt geschlossen wird.

### Speicher (`storage`)

```ts
storage.get(key: string): Promise<unknown>             // null bei fehlendem Schlüssel
storage.set(key: string, value: unknown): Promise<void> // undefined löscht den Schlüssel
```

- Pro Plugin und pro Welt, gespeichert in `world.db`. Alle Widget-Instanzen und die Hintergrund-Laufzeit deines Plugins teilen sich den Speicher.
- Schlüssel bis zu 128 Zeichen. Werte müssen JSON-serialisierbar und als JSON höchstens 64 KB groß sein. Höchstens 500 Schlüssel pro Plugin.
- Wird beim Deinstallieren des Plugins gelöscht.

### Widgets

```ts
widget.getState(): unknown                              // gespeicherter Zustand dieses Slate-Knotens
widget.setState(state: unknown): void                   // speichert in den Knoten (nur im Widget-Modus)
widget.onStateChange(cb: (state: unknown) => void): () => void
widget.getContext(): { widgetType: string; nodeId: string } | null   // null im Hintergrund-Modus
```

- Nutze den Widget-Zustand für Daten, die zu genau einem Knoten gehören, etwa seine Einstellungen. Nutze `storage` für Daten, die alle Instanzen teilen.
- Der Zustand muss aus einfachen, strukturiert klonbaren Daten bestehen (keine Funktionen, DOM-Knoten oder Klasseninstanzen). Er wird mit dem Board gespeichert.
- `setState` löst deine eigenen `onStateChange`-Listener nicht aus. Im Hintergrund-Modus tut es nichts.
- `getContext().widgetType` verrät dir, welches deiner Manifest-Widgets dieser iframe darstellt.

### Befehle

```ts
commands.register(id: string, handler: () => void | Promise<void>): void
```

`id` muss in den `commands` des Manifests deklariert sein. Der Befehl erscheint in der Befehlspalette als „Plugin: <Titel>“. Befehle laufen in der Hintergrund-Laufzeit; registriere sie deshalb **vor** der Prüfung von `rsMode`.

### Generatoren (`generators`)

```ts
generators.npc(params?): Promise<PluginNpcResult>
generators.village(params?): Promise<VillageResult>
generators.tavern(params?): Promise<TavernResult>
generators.encounter(params?): Promise<EncounterResult>
```

Jeder Parameter ist optional; unbekannte oder ungültige Werte fallen auf Zufallswerte bzw. Standards zurück. Jeder Aufruf akzeptiert `locale: 'en' | 'de'` (Standard: die UI-Sprache des DM).

| Generator | Parameter |
| --- | --- |
| `npc` | `race`, `gender` (`'male'` / `'female'`), `archetype` |
| `village` | `settlementType` (`'hamlet'` / `'village'` / `'town'` / `'city'`), `terrain` |
| `tavern` | `quality` (`'poor'` / `'modest'` / `'comfortable'` / `'wealthy'`), `settlementType` |
| `encounter` | `partyLevel` (1–20, Standard 3), `partySize` (1–8, Standard 4), `difficulty` (`'easy'` / `'medium'` / `'hard'` / `'deadly'`), `terrain` oder `'any'`, `crMin` / `crMax` (z. B. `"1/4"`), `sources` (`'srd'` / `'homebrew'` / `'both'`), `maxGroups` (1–4) |

`terrain` ist einer der Werte `forest`, `mountain`, `swamp`, `desert`, `arctic`, `coast`, `underdark`, `urban`, `grassland`, `dungeon`.

- NSC-Ergebnisse enthalten zusätzlich `name`, `raceName` und den `statblock` des Archetyps.
- Begegnungsergebnisse enthalten `groups` (Monster, HG, EP, Anzahl, RK, TP), einen Story-`hook` und die EP-`balance` mit den Schwellenwerten der Gruppe und einer Bewertung.
- Die Generatoren nutzen die eingebauten SRD-Daten und die CSV-Flavor-Pools der Welt. Homebrew-Kreaturen werden nur verwendet, wenn das Plugin zusätzlich `entities:read` hat.
- Generatoren schreiben nie in die Datenbank.

Die Ergebnisse sind reines JSON; prüfe neuere Felder über `runeSlateApi.version`.

### Spielzeit (`time:read` / `time:write`)

```ts
getCampaignTime(): Promise<CampaignTime | null>                    // time:read
advanceCampaignTime(minutes: number): Promise<CampaignTime | null> // time:write; negativ spult zurück
getCountdowns(): Promise<Array<{
  id: string; title: string; mode: 'target_date' | 'relative_minutes';
  remainingMinutes: number; isTriggered: boolean; isVisibleToPlayers: boolean;
}>>                                                                 // time:read
rollWeather(): Promise<WeatherState | null>                        // time:write

interface CampaignTime {
  campaignId: string;
  timestamp: GameTimestamp;
  dateText: string;         // lokalisiert, z. B. "14. Mirtul 1492 DR"
  timeText: string;         // "HH:MM"
  stage: TimeOfDayStage;    // 'dawn' | 'morning' | 'noon' | 'afternoon' | 'evening' | 'night'
  season: SeasonKey;
  weather: WeatherState | null;
}
```

Alle Zeit-Aufrufe liefern `null` (bzw. eine leere Liste), wenn keine Kampagne aktiv ist.

## Laufzeitumgebung

- Das Einstiegsskript wird als **klassisches Skript** geladen. ES-Module (`import` / `export`) werden nicht unterstützt; bündle deinen Code daher in eine Datei (zum Beispiel mit esbuild oder Rollup im Format `iife`).
- Die Seite enthält ein leeres `<div id="root"></div>` für deine Oberfläche.
- Eigene Dateien lädst du mit Pfaden relativ zum Plugin-Wurzelverzeichnis, etwa `<link rel="stylesheet" href="style.css">` oder `<img src="icon.png">`.
- Content Security Policy:
  - Skripte, Styles und Schriften nur aus deinem Plugin (`rs-plugin://<id>`). Inline-Styles sind erlaubt.
  - Bilder aus deinem Plugin, aus dem Vault (`rs-asset:`) und als `data:`-URLs.
  - Kein `fetch`, XHR oder WebSocket (`connect-src 'none'`), keine Formulare, kein `<base>`.
- Widget-iframes passen ihre Größe automatisch an: Das SDK misst deinen Inhalt, und der Knoten wächst oder schrumpft mit, zwischen 120 × 80 und 1200 × 1200 px. Bis zur ersten Messung nutzt der Knoten `width` / `height` aus dem Manifest (Standard 280 × 200).
- Jeder iframe darf höchstens 50 Anfragen pro Sekunde senden; weitere Anfragen werden abgelehnt.

## Beispiel

Ein minimales Plugin mit einem Widget und einem Befehl:

```js
(function () {
  'use strict';
  var api = window.runeSlateApi;
  if (!api) return;

  // 1. Zuerst die Befehle: Sie laufen in der Hintergrund-Laufzeit.
  api.commands.register('roll-d20', function () {
    var roll = api.rollDice('1d20');
    api.updateStageOverlay({ title: 'W20', lines: [String(roll.result)], position: 'top-right' });
  });

  // 2. Widget-Oberfläche nur im Widget-Modus.
  if (document.documentElement.dataset.rsMode !== 'widget') return;

  var root = document.getElementById('root');
  var button = document.createElement('button');
  button.textContent = 'W20 würfeln';
  button.addEventListener('click', function () {
    var roll = api.rollDice('1d20');
    button.textContent = 'Gewürfelt: ' + roll.result;
    api.widget.setState({ last: roll.result });
  });
  root.appendChild(button);

  // 3. Gespeicherten Zustand wiederherstellen, sobald er ankommt.
  api.widget.onStateChange(function (state) {
    if (state && typeof state.last === 'number') button.textContent = 'Gewürfelt: ' + state.last;
  });
})();
```

Das passende Manifest:

```json
{
  "id": "quick-d20",
  "name": "Schneller W20",
  "version": "1.0.0",
  "apiVersion": 1,
  "main": "index.js",
  "permissions": ["dice", "stage"],
  "widgets": [{ "type": "roller", "name": "Schneller W20", "width": 200, "height": 120 }],
  "commands": [{ "id": "roll-d20", "title": "W20 auf der Stage würfeln" }]
}
```

Das vollständige Beispiel `examples/plugins/dice-oracle/` nutzt zusätzlich den Speicher und zeigt, wie Widget-Instanzen und Befehle Daten teilen.

## Sicherheit und Best Practices

### So wenig wie möglich anfragen

- Deklariere nur die Berechtigungen, die du wirklich nutzt. Der DM sieht die Liste vor dem Aktivieren, und eine kurze Liste schafft Vertrauen.
- Fügt ein Update eine Berechtigung hinzu, wird das Plugin deaktiviert, bis der DM erneut zustimmt. Plane deine Berechtigungen früh.

### Fehler behandeln

- Jeder asynchrone Aufruf kann abgelehnt werden: fehlende Berechtigung, keine aktive Welt oder Kampagne, ungültige Argumente oder ein Timeout. Nutze immer `.catch()` oder `try` / `catch`.
- `rollDice` wirft bei ungültigen Formeln synchron eine Ausnahme.
- Zeige dem DM im Widget eine kurze, ruhige Meldung, statt still zu scheitern. Details protokollierst du mit `console.warn`.

### Den Spieltisch nicht ausbremsen

- RuneSlate wird live am Spieltisch genutzt. Vermeide schwere Schleifen, häufige Timer und große DOM-Bäume; jede Widget-Instanz ist ein eigener iframe.
- Lass das Stage-Overlay nicht ewig stehen. Entferne es mit `updateStageOverlay(null)`, sobald es nicht mehr gebraucht wird.
- Halte den Widget-Zustand klein. Große oder geteilte Daten gehören in `storage`; denk an die Grenze von 64 KB pro Wert.

### Sich in die App einfügen

- RuneSlate hat ein dunkles und ein helles Design sowie Deutsch und Englisch. API-Version 1 teilt deinem Plugin nicht mit, welches Design oder welche Sprache aktiv ist. Wähle Farben mit genug Kontrast auf hellem und dunklem Hintergrund, oder gib dem Widget einen eigenen, klar abgegrenzten Hintergrund.
- Übergib den Generatoren `locale`, wenn dein Plugin für eine Sprache geschrieben ist; standardmäßig folgen sie der Sprache des DM.
- Verwende die Begriffe des DM: **Slate**, **Lore**, **Vault**, **Stage**, **Map**.
- Tastatur: Fange keine globalen Tasten ab. Dein iframe erhält Tastenereignisse nur, solange er den Fokus hat.

### Daten als nicht vertrauenswürdig behandeln

- Lore-Namen, gespeicherte Werte und Generator-Ergebnisse sind Nutzerinhalte. Füge sie mit `textContent` ein, nie mit `innerHTML`.
- Verwende kein `eval` oder `new Function`; die CSP blockiert sie ohnehin.

### Versionierung

- Erhöhe `version` bei jeder Veröffentlichung nach semantischer Versionierung.
- Halte die `id` für immer stabil; eine neue `id` ist ein neues Plugin und verliert alle gespeicherten Daten.
- Dein Code sollte mit altem Widget-Zustand und Speicherwerten früherer Versionen zurechtkommen.
- Prüfe `runeSlateApi.version`, bevor du neuere Funktionen nutzt: Generatoren brauchen SDK 1.1.0 oder neuer, die Zeit-API 1.2.0 oder neuer.
