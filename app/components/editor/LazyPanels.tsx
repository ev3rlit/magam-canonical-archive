'use client';

import dynamic from 'next/dynamic';

export const LazyChatPanel = dynamic(
  () => import('@/components/chat/ChatPanel').then((module) => module.ChatPanel),
  {
    ssr: false,
    loading: () => null,
  },
);

export const LazySearchOverlay = dynamic(
  () => import('@/components/ui/SearchOverlay').then((module) => module.SearchOverlay),
  {
    ssr: false,
    loading: () => null,
  },
);

export const LazyStickerInspector = dynamic(
  () => import('@/components/ui/StickerInspector').then((module) => module.StickerInspector),
  {
    ssr: false,
    loading: () => null,
  },
);

export const LazyQuickOpenDialog = dynamic(
  () => import('@/components/ui/QuickOpenDialog').then((module) => module.QuickOpenDialog),
  {
    ssr: false,
    loading: () => null,
  },
);
