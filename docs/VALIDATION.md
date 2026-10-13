# Validation

Locally verified on 13 October 2026: 20 Rust tests, four content tests, four native render tests, 12 browser tests on Linux and Windows, and one production offline test on both platforms. TypeScript, WASM and production builds pass. Electron real MIDI playback/notation and PDF/audio/native file IPC also pass. The signed universal Android APK/AAB build passes; CI rebuilds all release targets.

The regression suite exercises behavior through Rust, native React Native rendering, browser integration, visual comparisons and a production offline reload. Browser tests use the real published MIDI, sheet images and reference documents where available. Generated PDF/WAV fixtures exercise pagination and playback without inventing published library content.

| Area | Regression coverage |
| --- | --- |
| Library | SHA-256 integrity, cancellation/retry, corrupt replacement retains old content, removal and offline reopening |
| Updates | Newer release banner, approved installer link, native check starts while catalogue waits, legacy catalogue excludes MIDI |
| MIDI | Reproducible transcriptions, tempo changes within notes, chord playback/roll, malformed and oversized input rejection, non-silent synthesized WAV |
| Practice | Original score and lyrics, MusicXML SVG rendering, piano roll, playback rate/seek/repeat and offline playback |
| Sheet viewing | Browser and native PDF pagination, zoom, image accessibility |
| References | History/clothing/directory render and reopen offline; UTF-8 text preserved |
| Visuals | Screenshot baselines for welcome and complete practice at 390px and 1280px, plus horizontal overflow checks |
| Production offline | Service worker caches compiled shell/WASM/notation renderer, excludes API/media, saved MIDI reopens after network-disabled reload |
| Native storage | Native HTTP download, verified WAV preview with original MIDI export, cleanup and failed-update retention |

Reproduce with locked dependencies:

```sh
npm ci
cargo test --locked
npm run wasm
npm test
npm run check:mobile
npm run test:mobile
npm run pages
npx playwright install --with-deps chromium
npm run test:browser
npm run test:offline
```

CI uses Ubuntu 22.04 and Linux screenshot baselines; local Windows baselines are also kept. Deliberate visual changes require reviewing generated images before accepting updated baselines. Native render tests mock platform media output and bridge responses; Rust tests independently exercise the actual native storage/HTTP/audio logic.

Checks gate automatic Pages publication. Release publishing additionally requires all regression checks and all installer builds to succeed. Android builds compile four Rust ABIs, build APK/AAB and verify the permanent release-key signature. iOS compilation runs on macOS. Physical-device interaction, device audio quality and the musical accuracy of concept transcriptions still require human verification.

Development-tool dependencies have upstream npm advisories. No forced incompatible Expo/React Native downgrade is applied. Development servers bind to localhost; credentials, private email and signing keys remain outside this repository.
