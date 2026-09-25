import { describe, expect, it, vi } from 'vitest';

const render = vi.fn();
const createRoot = vi.fn(() => ({ render }));

vi.mock('react-dom/client', () => ({ default: { createRoot } }));
vi.mock('../src/App', () => ({ default: () => <div>Game mounted</div> }));

describe('browser entry point', () => {
  it('renders the app into the document root', async () => {
    document.body.innerHTML = '<div id="root"></div>';
    await import('../src/main');

    expect(createRoot).toHaveBeenCalledWith(document.getElementById('root'));
    expect(render).toHaveBeenCalledOnce();
  });
});
