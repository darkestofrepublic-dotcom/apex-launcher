// Jeu d'icônes SVG original (trait fin, style professionnel). Aucun emoji dans l'interface.
import type { SVGProps } from "react";

function Base({ children, ...props }: SVGProps<SVGSVGElement>) {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      {children}
    </svg>
  );
}

export const IconHome = (p: SVGProps<SVGSVGElement>) => (
  <Base {...p}><path d="M3 10.5 12 3l9 7.5" /><path d="M5 9.5V21h5v-6h4v6h5V9.5" /></Base>
);
export const IconBox = (p: SVGProps<SVGSVGElement>) => (
  <Base {...p}><path d="M21 8.5 12 3 3 8.5v7L12 21l9-5.5v-7Z" /><path d="M3 8.5 12 14l9-5.5M12 14v7" /></Base>
);
export const IconBook = (p: SVGProps<SVGSVGElement>) => (
  <Base {...p}><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20V3H6.5A2.5 2.5 0 0 0 4 5.5v14Z" /><path d="M4 19.5A2.5 2.5 0 0 0 6.5 22H20v-5" /></Base>
);
export const IconPuzzle = (p: SVGProps<SVGSVGElement>) => (
  <Base {...p}><path d="M14 7V5a2 2 0 0 0-4 0v2H7a2 2 0 0 0-2 2v3h2a2 2 0 1 1 0 4H5v3a2 2 0 0 0 2 2h3v-2a2 2 0 1 1 4 0v2h3a2 2 0 0 0 2-2v-3h-2a2 2 0 1 1 0-4h2V9a2 2 0 0 0-2-2h-3Z" /></Base>
);
export const IconGlobe = (p: SVGProps<SVGSVGElement>) => (
  <Base {...p}><circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3c2.5 2.6 3.9 5.7 3.9 9S14.5 18.4 12 21c-2.5-2.6-3.9-5.7-3.9-9S9.5 5.6 12 3Z" /></Base>
);
export const IconFile = (p: SVGProps<SVGSVGElement>) => (
  <Base {...p}><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6Z" /><path d="M14 2v6h6M9 13h6M9 17h6" /></Base>
);
export const IconArchive = (p: SVGProps<SVGSVGElement>) => (
  <Base {...p}><rect x="2" y="3" width="20" height="5" rx="1" /><path d="M4 8v11a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8M10 12h4" /></Base>
);
export const IconUser = (p: SVGProps<SVGSVGElement>) => (
  <Base {...p}><circle cx="12" cy="8" r="4" /><path d="M4 21c0-4 3.6-6.5 8-6.5s8 2.5 8 6.5" /></Base>
);
export const IconJava = (p: SVGProps<SVGSVGElement>) => (
  <Base {...p}><path d="M17 8h1a3 3 0 0 1 0 6h-1M4 8h13v6a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5V8Z" /><path d="M7 2v2M11 2v2M15 2v2" /></Base>
);
export const IconGear = (p: SVGProps<SVGSVGElement>) => (
  <Base {...p}><circle cx="12" cy="12" r="3.2" /><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.2a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.9.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.9 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.2a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.9l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.9.3h0a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.2a1.7 1.7 0 0 0 1 1.5h0a1.7 1.7 0 0 0 1.9-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.9v0a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.2a1.7 1.7 0 0 0-1.4 1Z" /></Base>
);
export const IconPlay = (p: SVGProps<SVGSVGElement>) => (
  <Base {...p}><circle cx="12" cy="12" r="9" /><path d="M10 8.5v7l6-3.5-6-3.5Z" fill="currentColor" stroke="none" /></Base>
);
export const IconPlus = (p: SVGProps<SVGSVGElement>) => (
  <Base {...p}><path d="M12 5v14M5 12h14" /></Base>
);
export const IconDots = (p: SVGProps<SVGSVGElement>) => (
  <Base {...p}><circle cx="5" cy="12" r="1.4" fill="currentColor" stroke="none" /><circle cx="12" cy="12" r="1.4" fill="currentColor" stroke="none" /><circle cx="19" cy="12" r="1.4" fill="currentColor" stroke="none" /></Base>
);
export const IconFolder = (p: SVGProps<SVGSVGElement>) => (
  <Base {...p}><path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7Z" /></Base>
);
export const IconSearch = (p: SVGProps<SVGSVGElement>) => (
  <Base {...p}><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></Base>
);
export const IconX = (p: SVGProps<SVGSVGElement>) => (
  <Base {...p}><path d="M18 6 6 18M6 6l12 12" /></Base>
);
export const IconCheck = (p: SVGProps<SVGSVGElement>) => (
  <Base {...p}><path d="m4 12.5 5 5L20 6.5" /></Base>
);
export const IconAlert = (p: SVGProps<SVGSVGElement>) => (
  <Base {...p}><path d="M12 3 2.5 20h19L12 3Z" /><path d="M12 10v4M12 17.5v.5" /></Base>
);
export const IconRefresh = (p: SVGProps<SVGSVGElement>) => (
  <Base {...p}><path d="M21 12a9 9 0 1 1-2.6-6.3M21 3v6h-6" /></Base>
);
export const IconCopy = (p: SVGProps<SVGSVGElement>) => (
  <Base {...p}><rect x="9" y="9" width="12" height="12" rx="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" /></Base>
);
export const IconTrash = (p: SVGProps<SVGSVGElement>) => (
  <Base {...p}><path d="M3 6h18M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" /></Base>
);
export const IconEdit = (p: SVGProps<SVGSVGElement>) => (
  <Base {...p}><path d="M17 3a2.8 2.8 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3Z" /></Base>
);
export const IconChevron = (p: SVGProps<SVGSVGElement>) => (
  <Base {...p}><path d="m6 9 6 6 6-6" /></Base>
);
export const IconDownload = (p: SVGProps<SVGSVGElement>) => (
  <Base {...p}><path d="M12 3v12m0 0 4-4m-4 4-4-4M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" /></Base>
);
export const IconShield = (p: SVGProps<SVGSVGElement>) => (
  <Base {...p}><path d="M12 2 4 5.5V11c0 5 3.4 9.3 8 11 4.6-1.7 8-6 8-11V5.5L12 2Z" /><path d="m9 11.5 2 2 4-4.5" /></Base>
);
export const IconCpu = (p: SVGProps<SVGSVGElement>) => (
  <Base {...p}><rect x="6" y="6" width="12" height="12" rx="2" /><path d="M9 1v3M15 1v3M9 20v3M15 20v3M1 9h3M1 15h3M20 9h3M20 15h3" /></Base>
);
export const IconUpdate = (p: SVGProps<SVGSVGElement>) => (
  <Base {...p}><path d="M12 3v12m0-12L8 7m4-4 4 4" /><path d="M4 15v4a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-4" /></Base>
);
export const IconStar = (p: SVGProps<SVGSVGElement>) => (
  <Base {...p}><path d="m12 2.5 2.9 6 6.6.9-4.8 4.6 1.2 6.5L12 17.4 6.1 20.5l1.2-6.5L2.5 9.4l6.6-.9 2.9-6Z" /></Base>
);
export const IconLogout = (p: SVGProps<SVGSVGElement>) => (
  <Base {...p}><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" /></Base>
);
export const IconLayers = (p: SVGProps<SVGSVGElement>) => (
  <Base {...p}><path d="m12 2 9 5-9 5-9-5 9-5Z" /><path d="m3 12 9 5 9-5M3 17l9 5 9-5" /></Base>
);
export const IconShirt = (p: SVGProps<SVGSVGElement>) => (
  <Base {...p}><path d="M9 3 4 6l-2 4 3 2v9h6v-4h2v4h6v-9l3-2-2-4-5 3a3 3 0 0 1-6 0L9 3Z" /></Base>
);
export const IconMoon = (p: SVGProps<SVGSVGElement>) => (
  <Base {...p}><path d="M20 14.5A8.5 8.5 0 0 1 9.5 4 8.5 8.5 0 1 0 20 14.5Z" /></Base>
);
export const IconSun = (p: SVGProps<SVGSVGElement>) => (
  <Base {...p}><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></Base>
);
export const IconHelp = (p: SVGProps<SVGSVGElement>) => (
  <Base {...p}><circle cx="12" cy="12" r="9" /><path d="M9.5 9.3a2.6 2.6 0 1 1 3.4 2.5c-.8.3-.9 1-.9 1.7" /><circle cx="12" cy="17" r="1.1" fill="currentColor" stroke="none" /></Base>
);
