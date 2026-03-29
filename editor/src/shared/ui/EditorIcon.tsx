import type { SVGProps } from 'react';

export type EditorIconName =
  | 'back'
  | 'copy'
  | 'cursor'
  | 'delete'
  | 'frame'
  | 'front'
  | 'group'
  | 'image'
  | 'inspect'
  | 'lock'
  | 'pan'
  | 'property'
  | 'rename'
  | 'shape'
  | 'sticky'
  | 'text'
  | 'unlock'
  | 'ungroup';

function Svg({
  children,
  ...props
}: SVGProps<SVGSVGElement>) {
  return (
    <svg
      aria-hidden="true"
      fill="none"
      height="18"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="1.8"
      viewBox="0 0 24 24"
      width="18"
      {...props}
    >
      {children}
    </svg>
  );
}

export function EditorIcon({
  name,
  ...props
}: { name: EditorIconName } & SVGProps<SVGSVGElement>) {
  switch (name) {
    case 'cursor':
      return (
        <Svg {...props}>
          <path d="M6 4L18 12L12.2 13.8L14.4 19.4L11.4 20.6L9.1 14.9L5 19V4Z" />
        </Svg>
      );
    case 'pan':
      return (
        <Svg {...props}>
          <path d="M8 11V7.5A1.5 1.5 0 0 1 11 7.5V11" />
          <path d="M11 11V6.5A1.5 1.5 0 0 1 14 6.5V11" />
          <path d="M14 11V8A1.5 1.5 0 0 1 17 8V13.5C17 17 14.5 20 11 20H9.8C7 20 4.8 17.8 4.8 15V11.8A1.8 1.8 0 0 1 8 10.6V11Z" />
        </Svg>
      );
    case 'shape':
      return (
        <Svg {...props}>
          <rect height="12" rx="3" width="16" x="4" y="6" />
        </Svg>
      );
    case 'sticky':
      return (
        <Svg {...props}>
          <path d="M6 4H18V16L14 20H6V4Z" />
          <path d="M14 16H18L14 20V16Z" />
        </Svg>
      );
    case 'text':
      return (
        <Svg {...props}>
          <path d="M6 6H18" />
          <path d="M12 6V18" />
        </Svg>
      );
    case 'image':
      return (
        <Svg {...props}>
          <rect height="14" rx="3" width="18" x="3" y="5" />
          <path d="M7.5 12.5L10.5 9.5L14 13L16 11L19 14" />
          <circle cx="8" cy="9" r="1.1" />
        </Svg>
      );
    case 'frame':
      return (
        <Svg {...props}>
          <path d="M8 4H4V8" />
          <path d="M16 4H20V8" />
          <path d="M8 20H4V16" />
          <path d="M16 20H20V16" />
        </Svg>
      );
    case 'property':
      return (
        <Svg {...props}>
          <circle cx="8" cy="8" r="2.5" />
          <circle cx="16" cy="16" r="2.5" />
          <path d="M10 10L14 14" />
          <path d="M14 8H20" />
          <path d="M4 16H10" />
        </Svg>
      );
    case 'copy':
      return (
        <Svg {...props}>
          <rect height="10" rx="2" width="10" x="9" y="9" />
          <path d="M6 15H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v1" />
        </Svg>
      );
    case 'front':
      return (
        <Svg {...props}>
          <rect height="9" rx="2" width="9" x="9" y="9" />
          <path d="M6 15H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h7" />
          <path d="M12 6V3" />
          <path d="M9.5 5.5L12 3L14.5 5.5" />
        </Svg>
      );
    case 'back':
      return (
        <Svg {...props}>
          <rect height="9" rx="2" width="9" x="6" y="6" />
          <path d="M12 18H19a2 2 0 0 0 2-2V9" />
          <path d="M12 18V21" />
          <path d="M9.5 18.5L12 21L14.5 18.5" />
        </Svg>
      );
    case 'inspect':
      return (
        <Svg {...props}>
          <path d="M5 7H19" />
          <path d="M5 12H19" />
          <path d="M5 17H19" />
          <circle cx="9" cy="7" fill="currentColor" r="1.8" stroke="none" />
          <circle cx="15" cy="12" fill="currentColor" r="1.8" stroke="none" />
          <circle cx="11" cy="17" fill="currentColor" r="1.8" stroke="none" />
        </Svg>
      );
    case 'delete':
      return (
        <Svg {...props}>
          <path d="M5 7H19" />
          <path d="M9 7V5.5A1.5 1.5 0 0 1 10.5 4H13.5A1.5 1.5 0 0 1 15 5.5V7" />
          <path d="M8 9.5V18" />
          <path d="M12 9.5V18" />
          <path d="M16 9.5V18" />
          <path d="M7 7L8 20H16L17 7" />
        </Svg>
      );
    case 'group':
      return (
        <Svg {...props}>
          <rect height="6" rx="1.4" width="6" x="4" y="4" />
          <rect height="6" rx="1.4" width="6" x="14" y="4" />
          <rect height="6" rx="1.4" width="6" x="9" y="14" />
          <path d="M10 8H14" />
          <path d="M9.5 14L8 10" />
          <path d="M14.5 14L16 10" />
        </Svg>
      );
    case 'ungroup':
      return (
        <Svg {...props}>
          <rect height="6" rx="1.4" width="6" x="4" y="4" />
          <rect height="6" rx="1.4" width="6" x="14" y="4" />
          <rect height="6" rx="1.4" width="6" x="9" y="14" />
          <path d="M10 8H14" strokeDasharray="2.2 2.2" />
          <path d="M9.5 14L8 10" strokeDasharray="2.2 2.2" />
          <path d="M14.5 14L16 10" strokeDasharray="2.2 2.2" />
        </Svg>
      );
    case 'rename':
      return (
        <Svg {...props}>
          <path d="M4 20H8L18 10C18.8 9.2 18.8 7.8 18 7L17 6C16.2 5.2 14.8 5.2 14 6L4 16V20Z" />
          <path d="M13 7L17 11" />
        </Svg>
      );
    case 'lock':
      return (
        <Svg {...props}>
          <rect height="10" rx="2" width="12" x="6" y="10" />
          <path d="M9 10V7.5A3 3 0 0 1 15 7.5V10" />
        </Svg>
      );
    case 'unlock':
      return (
        <Svg {...props}>
          <rect height="10" rx="2" width="12" x="6" y="10" />
          <path d="M15 10V7.5A3 3 0 0 0 9.9 5.4" />
        </Svg>
      );
  }
}
