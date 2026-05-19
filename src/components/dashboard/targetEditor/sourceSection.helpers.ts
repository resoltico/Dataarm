import type { SourceInspectionResult } from '../../../types';

export type SourceInspectionState =
  | { kind: 'idle' }
  | { kind: 'loading' }
  | { kind: 'ready'; result: SourceInspectionResult; selectedText: string | null }
  | { kind: 'error'; message: string };

export function cssSelectorForElement(element: Element) {
  const segments: string[] = [];
  let current: Element | null = element;

  while (current && current.tagName.toLowerCase() !== 'html') {
    const tag = current.tagName.toLowerCase();
    const id = current.getAttribute('id');
    if (id && !id.includes(' ')) {
      segments.unshift(`${tag}#${id}`);
      break;
    }

    const classes = Array.from(current.classList)
      .filter((name) => !name.startsWith('dataarm-'))
      .slice(0, 2);
    const classSelector = classes.length > 0 ? `.${classes.join('.')}` : '';
    const siblings = current.parentElement
      ? Array.from(current.parentElement.children).filter(
          (candidate) => candidate.tagName === current?.tagName,
        )
      : [];
    const nth = siblings.length > 1 ? `:nth-of-type(${String(siblings.indexOf(current) + 1)})` : '';
    segments.unshift(`${tag}${classSelector}${nth}`);
    current = current.parentElement;
  }

  return segments.join(' > ');
}

export function buildSelectorTrail(target: Element) {
  return Array.from({ length: 5 })
    .reduce<Element[]>((elements, _unused, index) => {
      const next = index === 0 ? target : (elements[index - 1]?.parentElement ?? null);
      if (!next || next.tagName.toLowerCase() === 'body' || next.tagName.toLowerCase() === 'html') {
        return elements;
      }
      elements.push(next);
      return elements;
    }, [])
    .map(cssSelectorForElement);
}

export function clearSelection(doc: Document) {
  doc.querySelectorAll('[data-dataarm-selected="true"]').forEach((element) => {
    element.removeAttribute('data-dataarm-selected');
    element.removeAttribute('style');
  });
}

export function highlightSelected(doc: Document, selector: string) {
  clearSelection(doc);
  const element = doc.querySelector(selector);
  const htmlElementCtor = doc.defaultView?.HTMLElement ?? HTMLElement;
  if (!(element instanceof htmlElementCtor)) {
    return;
  }
  element.dataset.dataarmSelected = 'true';
  element.style.outline = '3px solid rgba(182, 101, 43, 0.88)';
  element.style.outlineOffset = '2px';
  element.style.background = 'rgba(243, 184, 140, 0.18)';
}

export function previewMessage(inspection: SourceInspectionState) {
  if (inspection.kind === 'loading') {
    return 'Loading the page preview…';
  }
  if (inspection.kind === 'error') {
    return inspection.message;
  }
  if (inspection.kind === 'ready') {
    return (
      inspection.selectedText ?? 'Click a section in the preview to use it as the watch scope.'
    );
  }
  return 'Paste a page URL, then load the page preview to pick a section visually.';
}

export type PreviewSelection = {
  doc: Document;
  trail: string[];
  selectedSelector: string;
  selectedText: string | null;
};

export function selectionFromPreviewPoint(
  frame: HTMLIFrameElement,
  point: { x: number; y: number },
) {
  const doc = frame.contentDocument;
  if (!doc) {
    return null;
  }

  const target = doc.elementFromPoint(point.x, point.y);
  const elementCtor = doc.defaultView?.Element ?? Element;
  if (!(target instanceof elementCtor)) {
    return null;
  }

  const trail = buildSelectorTrail(target);
  if (trail.length === 0) {
    return null;
  }

  const selectedSelector = trail[0] as string;
  const selectedText = target.textContent;

  return {
    doc,
    trail,
    selectedSelector,
    selectedText: selectedText ? selectedText.trim().slice(0, 220) : null,
  };
}
