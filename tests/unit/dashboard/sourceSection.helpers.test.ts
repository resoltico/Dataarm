import {
  buildSelectorTrail,
  clearSelection,
  cssSelectorForElement,
  highlightSelected,
  previewMessage,
  selectionFromPreviewPoint,
} from '../../../src/components/dashboard/targetEditor/sourceSection.helpers';

describe('sourceSection helpers', () => {
  it('builds stable selectors and selector trails from the clicked preview elements', () => {
    const previewDocument = document.implementation.createHTMLDocument('preview');
    previewDocument.body.innerHTML =
      '<main class="app-shell dataarm-ignore"><article id="release-card"><span class="headline dataarm-hover">Release 1.2.3</span></article><article class="release-card"><span>Ignored</span></article></main>';
    const headline = previewDocument.querySelector('.headline');
    if (!(headline instanceof Element)) {
      throw new Error('Expected the preview headline element.');
    }

    expect(cssSelectorForElement(headline)).toBe('article#release-card > span.headline');
    expect(buildSelectorTrail(headline)).toEqual([
      'article#release-card > span.headline',
      'article#release-card',
      'body > main.app-shell',
    ]);

    previewDocument.body.innerHTML =
      '<main><section><article class="release-card">One</article><article class="release-card">Two</article></section></main>';
    const secondArticle = previewDocument.querySelectorAll('article')[1];
    if (!(secondArticle instanceof Element)) {
      throw new Error('Expected the second article element.');
    }
    expect(cssSelectorForElement(secondArticle)).toBe(
      'body > main > section > article.release-card:nth-of-type(2)',
    );

    const detached = previewDocument.createElement('span');
    detached.className = 'orphan';
    expect(cssSelectorForElement(detached)).toBe('span.orphan');
  });

  it('clears and highlights preview selections without leaking stale decoration', () => {
    const previewDocument = document.implementation.createHTMLDocument('preview');
    previewDocument.body.innerHTML =
      '<main><article id="release-card" data-dataarm-selected="true" style="outline: 1px solid red;"><span class="headline">Release 1.2.3</span></article></main>';
    const article = previewDocument.querySelector('#release-card');
    if (!(article instanceof HTMLElement)) {
      throw new Error('Expected the article element.');
    }

    clearSelection(previewDocument);
    expect(article.dataset.dataarmSelected).toBeUndefined();
    expect(article.getAttribute('style')).toBeNull();

    highlightSelected(previewDocument, 'article#release-card');
    expect(article.dataset.dataarmSelected).toBe('true');
    expect(article.style.outline).toContain('3px solid');

    highlightSelected(previewDocument, '.missing');
    expect(article.dataset.dataarmSelected).toBeUndefined();
  });

  it('formats the inspection message for idle, loading, ready, and error states', () => {
    expect(previewMessage({ kind: 'idle' })).toContain('Paste a page URL');
    expect(previewMessage({ kind: 'loading' })).toBe('Loading the page preview…');
    expect(previewMessage({ kind: 'error', message: 'Preview failed' })).toBe('Preview failed');
    expect(
      previewMessage({
        kind: 'ready',
        result: { finalUrl: null, contentType: null, html: '<main />' },
        selectedText: null,
      }),
    ).toBe('Click a section in the preview to use it as the watch scope.');
    expect(
      previewMessage({
        kind: 'ready',
        result: { finalUrl: null, contentType: null, html: '<main />' },
        selectedText: 'Release 1.2.3',
      }),
    ).toBe('Release 1.2.3');
  });

  it('reads a preview selection from a clicked point inside the iframe', () => {
    const frame = document.createElement('iframe');
    expect(selectionFromPreviewPoint(frame, { x: 20, y: 20 })).toBeNull();

    const previewDocument = document.implementation.createHTMLDocument('preview');
    previewDocument.body.innerHTML =
      '<main><article id="release-card"><span class="headline">Release 1.2.3</span></article></main>';
    Object.defineProperty(frame, 'contentDocument', {
      configurable: true,
      value: previewDocument,
    });
    const headline = previewDocument.querySelector('.headline');
    if (!(headline instanceof Element)) {
      throw new Error('Expected the preview headline element.');
    }

    Object.defineProperty(previewDocument, 'elementFromPoint', {
      configurable: true,
      value: vi.fn(() => headline),
    });

    expect(selectionFromPreviewPoint(frame, { x: 32, y: 18 })).toEqual({
      doc: previewDocument,
      trail: ['article#release-card > span.headline', 'article#release-card', 'body > main'],
      selectedSelector: 'article#release-card > span.headline',
      selectedText: 'Release 1.2.3',
    });
  });

  it('returns null when the clicked point does not resolve to a preview element', () => {
    const frame = document.createElement('iframe');
    const previewDocument = document.implementation.createHTMLDocument('preview');
    Object.defineProperty(frame, 'contentDocument', {
      configurable: true,
      value: previewDocument,
    });
    Object.defineProperty(previewDocument, 'elementFromPoint', {
      configurable: true,
      value: vi.fn(() => null),
    });

    expect(selectionFromPreviewPoint(frame, { x: 4, y: 4 })).toBeNull();
  });

  it('returns null when the clicked element does not produce a selectable trail', () => {
    const frame = document.createElement('iframe');
    const previewDocument = document.implementation.createHTMLDocument('preview');
    previewDocument.body.innerHTML = '<main><p>Body-adjacent content</p></main>';
    Object.defineProperty(frame, 'contentDocument', {
      configurable: true,
      value: previewDocument,
    });
    Object.defineProperty(previewDocument, 'elementFromPoint', {
      configurable: true,
      value: vi.fn(() => previewDocument.body),
    });

    expect(selectionFromPreviewPoint(frame, { x: 4, y: 4 })).toBeNull();
  });

  it('reports null preview text when the picked element has no text content', () => {
    const frame = document.createElement('iframe');
    const previewDocument = document.implementation.createHTMLDocument('preview');
    previewDocument.body.innerHTML = '<main><div class="empty"></div></main>';
    Object.defineProperty(frame, 'contentDocument', {
      configurable: true,
      value: previewDocument,
    });
    const empty = previewDocument.querySelector('.empty');
    if (!(empty instanceof Element)) {
      throw new Error('Expected the empty preview element.');
    }
    Object.defineProperty(previewDocument, 'elementFromPoint', {
      configurable: true,
      value: vi.fn(() => empty),
    });

    expect(selectionFromPreviewPoint(frame, { x: 12, y: 12 })).toEqual({
      doc: previewDocument,
      trail: ['body > main > div.empty', 'body > main'],
      selectedSelector: 'body > main > div.empty',
      selectedText: null,
    });
  });
});
