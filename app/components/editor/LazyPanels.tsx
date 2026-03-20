'use client';

import {
  createElement,
  type ComponentType,
  useEffect,
  useState,
} from 'react';

function createLazyClientComponent<Props extends object>(
  loader: () => Promise<ComponentType<Props>>,
): (props: Props) => React.ReactElement | null {
  return function LazyClientComponent(props: Props) {
    const [Component, setComponent] = useState<ComponentType<Props> | null>(null);

    useEffect(() => {
      let active = true;
      void loader().then((nextComponent) => {
        if (active) {
          setComponent(() => nextComponent);
        }
      });

      return () => {
        active = false;
      };
    }, []);

    if (!Component) {
      return null;
    }

    return createElement(Component as ComponentType<any>, props);
  };
}

export const LazyChatPanel = createLazyClientComponent(
  () => import('@/components/chat/ChatPanel').then((module) => module.ChatPanel),
);

export const LazySearchOverlay = createLazyClientComponent(
  () => import('@/components/ui/SearchOverlay').then((module) => module.SearchOverlay),
);

export const LazyStickerInspector = createLazyClientComponent(
  () => import('@/components/ui/StickerInspector').then((module) => module.StickerInspector),
);

export const LazyQuickOpenDialog = createLazyClientComponent(
  () => import('@/components/ui/QuickOpenDialog').then((module) => module.QuickOpenDialog),
);
