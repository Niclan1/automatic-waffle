# Validation

Locally verified on 8 October 2026: seven Rust tests, three content-generation tests, two browser integration tests, web/mobile TypeScript, production WASM and React builds, Electron protocol/WASM/file IPC, a Windows x64 installer, and a signed universal Android APK/AAB. Phone and desktop web layouts were reviewed visually. Commands to reproduce:

```sh
cargo test --locked
npm test
npm run check:mobile
npm run pages
npx playwright install chromium
npx playwright test
cd apps/mobile
npx expo export --platform android --output-dir ../../mobile-check
```

Browser tests use test-only fixtures; they do not publish invented dance content. They exercise a verified download, opening it, rejecting a corrupt replacement, retaining the old file, reopening after an offline API check, deleting the saved file, mobile navigation, search, pending content, and app update banners.

Native Rust bridge tests check shared hash results, invalid input and endpoint restrictions. Desktop native IPC restricts paths to SHA-256 filenames and external links to this repository's releases and the official Volkspele website. The native Android bridge is compiled through cargo-ndk; the Gradle release APK/AAB build passed, including Kotlin integration and signature verification. Physical-device interaction has not yet been tested. iOS requires a macOS runner.

`npm audit fix` was applied within compatible version ranges. The installed Expo/Metro and Electron packaging toolchains still report upstream advisories for braces, node-forge, sprintf-js and uuid; npm proposes incompatible Expo downgrades for some findings. No force downgrade was applied. Review upstream patches before production release. Development servers bind to localhost.
