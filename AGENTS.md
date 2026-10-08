# Volkspele architecture

The user requires Rust for every application behavior that is not directly visual.

- Keep HTTP, content/version validation, hashes, download/cache orchestration, saved metadata, search/filtering, lesson preparation, audio decoding/preparation and playback decisions in `crates/`.
- React and React Native render prepared data and collect UI events. Platform adapters may perform mechanical IndexedDB/IPC operations, draw PDFs and apply Rust commands to browser/native players. Do not add application decisions or HTTP requests to those adapters.
- Use WASM on web/Electron and the JNI/C ABI Rust runtime on React Native. Keep behavior consistent across them.
- Keep dance media and sheet music on Pages, outside installers. Never publish invented dance instructions/scores/music as real content. Test fixtures must remain test-only.
- Keep email, signing keys and credentials outside Git. Retain the permanent Android key.
- Development/build automation can use Node; it is not the shipped application logic.

Run Rust tests and WASM build after Rust changes; web/mobile TypeScript and relevant browser tests after frontend changes. Validate native bridge changes with an APK build. Use `actionlint` for workflow edits.
