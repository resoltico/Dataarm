import { cleanup } from '@testing-library/react';

const render = vi.fn();
const createRoot = vi.fn(() => ({ render }));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  vi.resetModules();
  document.body.innerHTML = '';
});

describe('main entrypoint', () => {
  it('mounts the React app into the root element', async () => {
    vi.doMock('../../src/App', () => ({
      default: () => <div>App</div>,
    }));
    vi.doMock('react-dom/client', () => ({
      default: { createRoot },
      createRoot,
    }));

    document.body.innerHTML = '<div id="root"></div>';

    await import('../../src/main');

    expect(createRoot).toHaveBeenCalledWith(document.getElementById('root'));
    expect(render).toHaveBeenCalledTimes(1);
  });

  it('throws when the root element is missing', async () => {
    vi.doMock('../../src/App', () => ({
      default: () => <div>App</div>,
    }));
    vi.doMock('react-dom/client', () => ({
      default: { createRoot },
      createRoot,
    }));

    await expect(import('../../src/main')).rejects.toThrow('Root element "#root" was not found.');
    expect(createRoot).not.toHaveBeenCalled();
  });
});
