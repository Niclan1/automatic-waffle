# Publishing content

The native apps contain only the interface and shared Rust logic (native mobile libraries, desktop WASM). `content/` is excluded from installers. The Pages workflow publishes the full responsive React website plus static API files at:

- `https://niclan1.github.io/automatic-waffle/api/v1/catalog.json`
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

Kinds: `video`, `audio`, `lyrics`, `steps`, `document`, `image`. Supported media: MP4/WebM video; MP3/Ogg/WAV audio; plain UTF-8 text and PDF documents. React Native exports PDF files to a device reader. Images support JPEG, PNG and WebP. Keep asset IDs stable. Increment the asset version when changing its file, and the catalog version whenever changing entries. The builder calculates hashes and byte sizes from the actual files and rejects duplicate IDs or paths escaping the content folder.

Push changes to main. Pages rebuilds independently of app releases. A launch check fetches the new catalog without browser caching. Saved metadata is compared by stable ID and SHA-256. Users choose which updates to download. Integrity and file size are verified before replacing the saved record. An interrupted update leaves the previous download usable.

React Native downloads live in the app document directory. Electron downloads live in application data. Browser downloads live in IndexedDB; persistent storage is requested but remains subject to browser storage policies. Native share/save dialogs or browser export offer an additional user-owned copy. A removed catalog asset remains accessible in My aflaaie until the user deletes it. App uninstall may remove native files.

Current missing sources: A history, B clothing, C camp, D AVVB contacts; E–H Aanstap Rooies video/steps/lyrics/music; I–L Blinkvosperd video/steps/lyrics/music. The email and its workplace signature are kept outside the repository. Do not add them to published content.

GitHub Pages has storage/bandwidth limits. Keep files small (prefer under 50 MB); Git rejects individual files above its limit. The downloader rejects files above 250 MB. For a large media library, retain Pages for the manifests and move content to a suitable host, updating the Rust path policy and CSP deliberately.

Landing page reference: https://volkspele.co.za/avvb/ (reviewed 8 October 2026). The remote welcome photograph is from https://volkspele.co.za/avvb/wp-content/uploads/2019/02/IMG_2309.jpg and is attributed in the interface. It is published with the Pages content, not embedded in any installer. Landing copy is original; the existing website informs the photograph-led welcome and history/clothing/laer/contact navigation.
