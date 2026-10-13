# Volkspele

React + TypeScript + shadcn/ui for the responsive website and Electron desktop apps. React Native (Expo) provides native Android/iOS screens. Application logic, HTTP, downloads, update decisions, integrity, lesson preparation and audio decoding/preparation live in Rust. React renders the UI; thin storage and player adapters call platform APIs. Rust runs as WASM on web/desktop and through Kotlin JNI / Swift C bindings on mobile. Afrikaans navigation follows the supplied Volkspele brief.

## Development

Install Node 22, Rust stable, `wasm32-unknown-unknown`, and wasm-pack 0.15. Mobile also needs the Android SDK/NDK and Java, or Xcode on macOS for iOS. This is a custom native Expo app; its Rust module requires a native build and does not run in Expo Go.

```sh
npm ci
rustup target add wasm32-unknown-unknown
cargo install wasm-pack --version 0.15.0 --locked
npm run wasm
npm run dev
```

The default content base is the production Pages URL. To use local content, generate it with `npm run content`, serve `dist` separately, and set `VITE_CONTENT_BASE` to that server's URL before running Vite. The app never imports content into its JavaScript bundle.

```sh
cargo test --locked
npm test
npm run build
npm run desktop
npm run desktop:package
npm run check:mobile
```

## Hosting and releases

Enable Settings → Pages → GitHub Actions. Pushing main publishes the React site and static API. See [content publishing](docs/CONTENT.md).

The release workflow builds Electron installers for Windows x64/ARM64, macOS ARM64/Intel, Linux x64/ARM64 and a React Native universal Android APK/AAB. It publishes the draft after every job succeeds. Trigger it by a matching `vX.Y.Z` tag or workflow dispatch. Bump root/mobile `package.json`, `apps/mobile/app.json`, and both library modules together. Also increment Android `versionCode` and iOS `buildNumber` before each release.

Android requires repository Actions secrets `ANDROID_KEY_BASE64` (base64 of a private JKS with alias `volkspele`) and `ANDROID_KEY_PASSWORD`. Generate the key once and keep a backup outside the repository. Never replace it between releases. `scripts/prepare-android.mjs` patches the generated Gradle project to use those secrets; no debug signing fallback is allowed. Android SDK/NDK and Java are installed in CI.

After a successful release, Pages republishes `api/v1/app.json` with the latest release version and link. The app checks this at launch and on manual refresh; users install updates from Releases. There is no silent self-update. Releases also include an unsigned iOS simulator build; distributing to physical iPhones requires Apple signing/provisioning.

## Native mobile development

```sh
rustup target add aarch64-linux-android armv7-linux-androideabi i686-linux-android x86_64-linux-android
cargo install cargo-ndk --locked
# Set ANDROID_NDK_HOME to the Android NDK directory first.
cargo ndk -t arm64-v8a -t armeabi-v7a -t x86 -t x86_64 -o apps/mobile/modules/rust-logic/android/src/main/jniLibs build -p volkspele-logic --release --locked
cd apps/mobile
npx expo prebuild --platform android
npm run android
```

For iOS, run `bash scripts/build-ios-rust.sh` on macOS before `npx expo prebuild --platform ios` and `npm run ios` in the mobile app folder. This builds a Rust XCFramework for device and simulator. The generated native projects are ignored; source bindings, config and signing patches are tracked.

Sheet music renders inside the app beside song playback. Audio/video have practice speed and repeat controls, with expandable sections for words, instructions, demonstrations and sources.

The React Native app stores downloaded media in its document directory and uses native audio/video players and the system share sheet. Rust hashes saved files as a stream, so native integrity checks do not load an entire video into JavaScript memory. The website uses IndexedDB; Electron uses app data files with a restricted IPC bridge.

The welcome page follows the photograph-led layout and navigation of https://volkspele.co.za/avvb/. Its photograph is served remotely from the content manifest.

The published library includes the complete supplied history, clothing text, song lyrics, typed dance introductions and a dated AVVB laer directory. Book photographs and directory screenshots are private transcription references; they are not published downloads. See [reference placement and remaining gaps](docs/CONTENT-AUDIT.md).

Each song is a single standard MIDI download. It contains timed MIDI lyric events and embedded typed words, opening instructions and source notes. Rust prepares MusicXML with lyrics, piano-roll geometry and piano-like WAV audio. React displays the prepared results; OpenSheetMusicDisplay renders notation on web, desktop and in a locally bundled native WebView. No notation CDN is required. The separate words section preserves every verse supplied by the family.

Saved songs reopen offline. The MIDI transcriptions omit the full piano accompaniment and require musical proofreading. Blinkvosperd's printed score verse differs from the separately supplied words; its timed lyrics follow the score, while its words section retains all three supplied verses. Full measure-by-measure dance instructions remain pending. `api/v2/catalog.json` includes MIDI; the legacy v1 catalogue excludes MIDI so older APKs continue to work.

See [validation coverage](docs/VALIDATION.md) for regression, native render, browser screenshot and production offline tests.
