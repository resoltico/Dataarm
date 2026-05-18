import { APP_NAME, APP_PACKAGE_NAME, APP_VERSION } from '../../src/lib/appVersion';

describe('appVersion', () => {
  it('exports the canonical application identity constants', () => {
    expect(APP_NAME).toBe('Dataarm');
    expect(APP_PACKAGE_NAME).toBe('dataarm');
    expect(APP_VERSION).toMatch(/^\d+\.\d+\.\d+$/u);
  });
});
