#!/usr/bin/env bash
set -euo pipefail
rustup target add aarch64-apple-ios aarch64-apple-ios-sim x86_64-apple-ios
for target in aarch64-apple-ios aarch64-apple-ios-sim x86_64-apple-ios; do
  cargo build -p volkspele-logic --release --locked --target "$target"
done
mkdir -p target/ios-simulator-universal
lipo -create target/aarch64-apple-ios-sim/release/libvolkspele_logic.a target/x86_64-apple-ios/release/libvolkspele_logic.a -output target/ios-simulator-universal/libvolkspele_logic.a
OUTPUT=apps/mobile/modules/rust-logic/ios/VolkspeleLogic.xcframework
if test -d "$OUTPUT"; then
  # This output is generated and ignored; retain a previous copy outside the repo.
  mv "$OUTPUT" "${TMPDIR:-/tmp}/VolkspeleLogic-$(date +%s).xcframework"
fi
xcodebuild -create-xcframework -library target/aarch64-apple-ios/release/libvolkspele_logic.a -headers crates/mobile-bridge/include -library target/ios-simulator-universal/libvolkspele_logic.a -headers crates/mobile-bridge/include -output "$OUTPUT"
