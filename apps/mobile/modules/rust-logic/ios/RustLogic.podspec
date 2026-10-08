Pod::Spec.new do |s|
  s.name = 'RustLogic'
  s.version = '0.1.0'
  s.summary = 'Shared Volkspele Rust logic'
  s.description = s.summary
  s.author = 'Niclan1'
  s.homepage = 'https://github.com/Niclan1/automatic-waffle'
  s.source = { :git => s.homepage }
  s.platforms = { :ios => '16.0' }
  s.static_framework = true
  s.dependency 'ExpoModulesCore'
  s.source_files = '**/*.swift'
  s.vendored_frameworks = 'VolkspeleLogic.xcframework'
end
