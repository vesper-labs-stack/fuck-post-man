import type { ReactNode } from "react";

export type IconName =
  | "folder"
  | "folder-plus"
  | "doc"
  | "doc-plus"
  | "plus"
  | "search"
  | "chevron-right"
  | "chevron-down"
  | "chevron-up-down"
  | "trash"
  | "pencil"
  | "bookmark"
  | "paperplane"
  | "sun"
  | "moon"
  | "minus"
  | "square"
  | "xmark"
  | "ellipsis"
  | "clock"
  | "checkmark"
  | "globe"
  | "key"
  | "person"
  | "lock"
  | "bolt"
  | "copy"
  | "sliders"
  | "arrow-uturn-left"
  | "terminal"
  | "play"
  | "upload"
  | "download";

const PATHS: Record<IconName, ReactNode> = {
  folder: (
    <path d="M3 7.5A2.5 2.5 0 0 1 5.5 5h4l2 2.5h7A2.5 2.5 0 0 1 21 10v7a2.5 2.5 0 0 1-2.5 2.5h-13A2.5 2.5 0 0 1 3 17z" />
  ),
  "folder-plus": (
    <>
      <path d="M3 7.5A2.5 2.5 0 0 1 5.5 5h4l2 2.5h7A2.5 2.5 0 0 1 21 10v7a2.5 2.5 0 0 1-2.5 2.5h-13A2.5 2.5 0 0 1 3 17z" />
      <path d="M12 10.5v5M9.5 13h5" />
    </>
  ),
  doc: (
    <>
      <path d="M7 3.5h7l4 4V20a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4.5a1 1 0 0 1 1-1z" />
      <path d="M14 3.5V8h4" />
    </>
  ),
  "doc-plus": (
    <>
      <path d="M7 3.5h7l4 4V20a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4.5a1 1 0 0 1 1-1z" />
      <path d="M12 11v6M9 14h6" />
    </>
  ),
  plus: <path d="M12 5v14M5 12h14" />,
  search: (
    <>
      <circle cx="11" cy="11" r="7" />
      <path d="M20.5 20.5 16 16" />
    </>
  ),
  "chevron-right": <path d="m9 6 6 6-6 6" />,
  "chevron-down": <path d="m6 9 6 6 6-6" />,
  "chevron-up-down": <path d="m8 9 4-4 4 4M8 15l4 4 4-4" />,
  trash: (
    <>
      <path d="M4 7h16M9.5 7V4.5h5V7M6.5 7l1 13h9l1-13" />
      <path d="M10 11v6M14 11v6" />
    </>
  ),
  pencil: <path d="m4 20 1.2-4.2L16.5 4.5l3 3L8.2 18.8z" />,
  bookmark: <path d="M6.5 3.5h11V21L12 17l-5.5 4z" />,
  paperplane: <path d="M22 2 11 13M22 2l-7 20-4-9-9-4z" />,
  sun: (
    <>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
    </>
  ),
  moon: <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />,
  minus: <path d="M5 12h14" />,
  square: <rect x="5" y="5" width="14" height="14" rx="2.5" />,
  xmark: <path d="m6 6 12 12M18 6 6 18" />,
  ellipsis: (
    <>
      <circle cx="5" cy="12" r="1.4" />
      <circle cx="12" cy="12" r="1.4" />
      <circle cx="19" cy="12" r="1.4" />
    </>
  ),
  clock: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7v5l3.5 2" />
    </>
  ),
  checkmark: <path d="m5 13 4 4L19 7" />,
  globe: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M3.5 12h17M12 3.5c2.5 2.3 3.8 5.2 3.8 8.5s-1.3 6.2-3.8 8.5c-2.5-2.3-3.8-5.2-3.8-8.5s1.3-6.2 3.8-8.5z" />
    </>
  ),
  key: (
    <>
      <circle cx="8" cy="14" r="4.5" />
      <path d="m11.5 10.5 8-8M17 5l2.5 2.5M14 8l2.5 2.5" />
    </>
  ),
  person: (
    <>
      <circle cx="12" cy="8" r="4" />
      <path d="M4.5 20.5a7.5 7.5 0 0 1 15 0" />
    </>
  ),
  lock: (
    <>
      <rect x="5.5" y="10.5" width="13" height="9.5" rx="2.5" />
      <path d="M8.5 10.5V7.5a3.5 3.5 0 0 1 7 0v3" />
    </>
  ),
  bolt: <path d="M13 2 4.5 14H11l-1 8 8.5-12H12z" />,
  copy: (
    <>
      <rect x="8.5" y="8.5" width="12" height="12" rx="2.5" />
      <path d="M15.5 8.5v-3a2 2 0 0 0-2-2h-8a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h3" />
    </>
  ),
  sliders: (
    <>
      <path d="M4 7h16M4 12h16M4 17h16" />
      <circle cx="9" cy="7" r="2" />
      <circle cx="15" cy="12" r="2" />
      <circle cx="7" cy="17" r="2" />
    </>
  ),
  "arrow-uturn-left": <path d="M9 14 4 9l5-5M4 9h10a6 6 0 0 1 0 12h-3" />,
  terminal: (
    <>
      <rect x="3" y="4.5" width="18" height="15" rx="2.5" />
      <path d="m7 9.5 3 2.5-3 2.5M12.5 15H17" />
    </>
  ),
  play: <path d="M8 5.5v13l11-6.5z" />,
  upload: <path d="M12 15.5V4M7 8.5l5-5 5 5M4.5 19.5h15" />,
  download: <path d="M12 4v11.5M7 11l5 5 5-5M4.5 19.5h15" />,
};

interface IconProps {
  name: IconName;
  size?: number;
  className?: string;
  strokeWidth?: number;
}

export default function Icon({
  name,
  size = 16,
  className = "",
  strokeWidth = 1.8,
}: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      {PATHS[name]}
    </svg>
  );
}