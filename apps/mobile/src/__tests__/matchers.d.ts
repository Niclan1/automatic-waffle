import type { JestNativeMatchers } from '@testing-library/react-native/dist/matchers/types';
// RNTL installs these matchers at runtime; include its matcher types in native tests.
declare global {
  namespace jest {
    interface Matchers<R, T = {}> extends JestNativeMatchers<R> {}
  }
}
