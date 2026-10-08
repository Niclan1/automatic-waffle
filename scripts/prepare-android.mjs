import { readFile, writeFile } from 'node:fs/promises';
const file = 'apps/mobile/android/app/build.gradle';
let text = await readFile(file, 'utf8');
if (!text.includes('VOLKSPELE_SIGNING')) {
  const signing = `// VOLKSPELE_SIGNING: stable release key, never debug signing.
        release {
            def keyPath = System.getenv("ANDROID_KEYSTORE_PATH")
            def keyPasswordValue = System.getenv("ANDROID_KEY_PASSWORD")
            if (!keyPath || !keyPasswordValue) { throw new GradleException("Missing Android release signing credentials") }
            storeFile file(keyPath)
            storePassword keyPasswordValue
            keyAlias System.getenv("ANDROID_KEY_ALIAS") ?: "volkspele"
            keyPassword keyPasswordValue
        }`;
  text = text.replace(/signingConfigs\s*\{/, `signingConfigs {\n${signing}`);
  text = text.replace(/(buildTypes\s*\{[\s\S]*?release\s*\{[\s\S]*?)signingConfig signingConfigs\.debug/, '$1signingConfig signingConfigs.release');
  if (!text.includes('signingConfig signingConfigs.release')) throw new Error('Expo Gradle signing template changed');
  // Pin JNI bridge names: R8 must not rename native entry points.
  await writeFile('apps/mobile/android/app/proguard-rules.pro', (await readFile('apps/mobile/android/app/proguard-rules.pro', 'utf8')) + '\n-keep class expo.modules.rustlogic.NativeLogic { *; }\n');
  await writeFile(file, text);
}
// Normalize the build type assignments separately from signing config definitions.
text = text.replace(/(buildTypes\s*\{\s*debug\s*\{\s*)signingConfig signingConfigs\.release/, '$1signingConfig signingConfigs.debug');
text = text.replace(/(buildTypes\s*\{[\s\S]*?release\s*\{[\s\S]*?)signingConfig signingConfigs\.debug/, '$1signingConfig signingConfigs.release');
if (!/buildTypes\s*\{[\s\S]*?release\s*\{[\s\S]*?signingConfig signingConfigs\.release/.test(text)) throw new Error('Release build is not signed with the permanent key');
await writeFile(file, text);
