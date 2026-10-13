# Publishing content

The native apps contain only the interface and shared Rust logic (native mobile libraries, desktop WASM). `content/` is excluded from installers. The Pages workflow publishes the full responsive React website plus static API files at:

- `https://niclan1.github.io/automatic-waffle/api/v2/catalog.json` (MIDI-capable clients)
- `https://niclan1.github.io/automatic-waffle/api/v1/catalog.json` (legacy APKs; MIDI assets omitted)
- `https://niclan1.github.io/automatic-waffle/api/v1/app.json`
- `https://niclan1.github.io/automatic-waffle/content/<sha256>`

Pages is a read-only static API: GET requests, no server-side code or database. It is public, including every published content file.

Place approved source files under `content/files/`. Add an asset to its entry in `content/catalog.source.json`:

```json
{
  "id": "aanstap-rooies-steps",
  "title": "Aanstap Rooies — Passies en grepe",
  "kind": "steps",
  "file": "aanstap-rooies/steps.txt",
  "mime": "text/plain",
  "version": "1.0.0"
}
```

Kinds: `video`, `audio`, `lyrics`, `steps`, `document`, `image`, `sheet`. Supported media: MP4/WebM video; MP3/Ogg/WAV audio (Rust decodes audio for waveform and duration preparation; previews support songs up to 30 minutes); plain UTF-8 text and PDF documents. PDF sheet music and documents render inside the app on Android/iOS, web and desktop, with paging and zoom. Native export remains available. Images support JPEG, PNG and WebP. Keep asset IDs stable. Increment the asset version when changing its file, and the catalog version whenever changing entries. The builder calculates hashes and byte sizes from the actual files and rejects duplicate IDs or paths escaping the content folder.

Push changes to main. Pages rebuilds independently of app releases. A launch check fetches the new catalog without browser caching. Saved metadata is compared by stable ID and SHA-256. Users choose which updates to download. Integrity and file size are verified before replacing the saved record. An interrupted update leaves the previous download usable.

React Native downloads live in the app document directory. Electron downloads live in application data. Browser downloads live in IndexedDB; persistent storage is requested but remains subject to browser storage policies. Native share/save dialogs or browser export offer an additional user-owned copy. A removed catalog asset remains accessible in My aflaaie until the user deletes it. App uninstall may remove native files.

Sources received on 13 October 2026: history A, clothing B, both songs' lyrics, two YouTube demonstration links, two printed scores, two dance introductions and ten unique laer-directory screenshots. Duplicate image downloads are omitted. The live official laer list was checked against the screenshots and published as a dated text snapshot. The official contact form remains an external link. Full dance instructions per measure and the promised dance photographs are still missing. The email and its workplace signature remain outside the repository.

GitHub Pages has storage/bandwidth limits. Keep files small (prefer under 50 MB); Git rejects individual files above its limit. The downloader rejects files above 250 MB. For a large media library, retain Pages for the manifests and move content to a suitable host, updating the Rust path policy and CSP deliberately.

Landing page reference: https://volkspele.co.za/avvb/ (reviewed 13 October 2026). The remote welcome photograph is from https://volkspele.co.za/avvb/wp-content/uploads/2019/02/IMG_2309.jpg and is attributed in the interface. It is published with the Pages content, not embedded in any installer. Landing copy is original; the existing website informs the photograph-led welcome and history/clothing/laer/contact navigation.

Songs use one asset with `kind: audio`, `mime: audio/midi`. Do not publish reference photographs or split the song's words and instructions into separate user downloads. Rust reads standard MIDI Lyric meta events and the bounded `VOLKSPELE_SONG_V1:` JSON Text event (lyrics, steps, credits, notes). Other MIDI players can still play the file normally. Metadata travels with the exported original MIDI.

Rust (`midly`) parses notes and tempo, computes timed lyrics and a piano roll, reconstructs monophonic MusicXML with lyrics, and synthesizes a bounded WAV. OpenSheetMusicDisplay is bundled locally for web/desktop and the native WebView. No remote synthesizer, CDN, SoundFont or server is needed. Polyphonic MIDI still plays and shows its piano roll; reconstructed notation is limited to monophonic files. Playback starts when requested by the user.

`content/scores/*.json` contains the manual melody transcription at 480 ticks per quarter, timed lyric syllables and the complete typed song metadata. Generate a MIDI with `cargo run --locked -p catalog-core --bin score -- content/scores/aanstap-rooies.json content/files/aanstap-rooies/melody.mid` (repeat for `blinkvosperd`). Rust verifies measure duration and lyric bounds. The Aanstap transcription plays three verses. Blinkvosperd follows the printed score verse, which differs from the supplied three-verse text retained in its words section. These melody transcriptions require musical proofreading; piano accompaniment and instrumental introductions are not transcribed. Never describe them as exact full-score editions.

History, clothing, contact and laer text open inline in accordion sections. Rust fetches and checks hashes before showing remote text; explicit downloads save it for offline use. See [content audit](CONTENT-AUDIT.md) for placement and missing references.

The website caches only its compiled interface (including WASM and local notation code) in a service worker. Dance media and API JSON are excluded from precaching. Rust manages downloaded media in IndexedDB; an installed/cached interface can reopen the saved library after an offline reload. GitHub Pages accepts no uploads: publishing content still happens through Git and Actions, while users' downloads stay on their devices.
