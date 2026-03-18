import { JSDOM } from 'jsdom';

function defineGlobalProperty<TKey extends keyof typeof globalThis>(
  key: TKey,
  value: (typeof globalThis)[TKey],
): void {
  Object.defineProperty(globalThis, key, {
    configurable: true,
    writable: true,
    value,
  });
}

export function installTestDom(): () => void {
  const dom = new JSDOM('<!doctype html><html><body></body></html>', {
    pretendToBeVisual: true,
    url: 'http://localhost/',
  });

  const previous = {
    window: globalThis.window,
    document: globalThis.document,
    navigator: globalThis.navigator,
    HTMLElement: globalThis.HTMLElement,
    Node: globalThis.Node,
    Event: globalThis.Event,
    MouseEvent: globalThis.MouseEvent,
    KeyboardEvent: globalThis.KeyboardEvent,
    getComputedStyle: globalThis.getComputedStyle,
    requestAnimationFrame: globalThis.requestAnimationFrame,
    cancelAnimationFrame: globalThis.cancelAnimationFrame,
  };

  defineGlobalProperty('window', dom.window);
  defineGlobalProperty('document', dom.window.document);
  defineGlobalProperty('navigator', dom.window.navigator);
  defineGlobalProperty('HTMLElement', dom.window.HTMLElement);
  defineGlobalProperty('Node', dom.window.Node);
  defineGlobalProperty('Event', dom.window.Event);
  defineGlobalProperty('MouseEvent', dom.window.MouseEvent);
  defineGlobalProperty('KeyboardEvent', dom.window.KeyboardEvent);
  defineGlobalProperty('getComputedStyle', dom.window.getComputedStyle.bind(dom.window));
  defineGlobalProperty('requestAnimationFrame', dom.window.requestAnimationFrame.bind(dom.window));
  defineGlobalProperty('cancelAnimationFrame', dom.window.cancelAnimationFrame.bind(dom.window));
  defineGlobalProperty('IS_REACT_ACT_ENVIRONMENT', true);

  return () => {
    dom.window.close();
    defineGlobalProperty('window', previous.window);
    defineGlobalProperty('document', previous.document);
    defineGlobalProperty('navigator', previous.navigator);
    defineGlobalProperty('HTMLElement', previous.HTMLElement);
    defineGlobalProperty('Node', previous.Node);
    defineGlobalProperty('Event', previous.Event);
    defineGlobalProperty('MouseEvent', previous.MouseEvent);
    defineGlobalProperty('KeyboardEvent', previous.KeyboardEvent);
    defineGlobalProperty('getComputedStyle', previous.getComputedStyle);
    defineGlobalProperty('requestAnimationFrame', previous.requestAnimationFrame);
    defineGlobalProperty('cancelAnimationFrame', previous.cancelAnimationFrame);
  };
}
