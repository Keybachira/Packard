import type { CSSProperties, ReactElement } from "react";

interface IconProps {
  size?: number;
  className?: string;
  strokeWidth?: number;
  style?: CSSProperties;
}

function base({ size = 18, className, strokeWidth = 1.6, style }: IconProps) {
  return {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    className,
    style,
  };
}

export function IconHome(p: IconProps) {
  return (
    <svg {...base(p)}>
      <path d="M3 10.5 12 3l9 7.5" />
      <path d="M5 9.5V21h5v-6h4v6h5V9.5" />
    </svg>
  );
}

export function IconPlay(p: IconProps) {
  return (
    <svg {...base(p)} fill="currentColor" stroke="none">
      <path d="M8 5.5v13l11-6.5-11-6.5z" />
    </svg>
  );
}

export function IconPause(p: IconProps) {
  return (
    <svg {...base(p)} fill="currentColor" stroke="none">
      <rect x="6" y="5" width="4" height="14" rx="1" />
      <rect x="14" y="5" width="4" height="14" rx="1" />
    </svg>
  );
}

export function IconPrev(p: IconProps) {
  return (
    <svg {...base(p)} fill="currentColor" stroke="none">
      <path d="M7 5v14M19 5l-8.5 7L19 19V5z" />
    </svg>
  );
}

export function IconNext(p: IconProps) {
  return (
    <svg {...base(p)} fill="currentColor" stroke="none">
      <path d="M17 5v14M5 5l8.5 7L5 19V5z" />
    </svg>
  );
}

export function IconShuffle(p: IconProps) {
  return (
    <svg {...base(p)}>
      <path d="M16 3h5v5" />
      <path d="M4 20 21 3" />
      <path d="M21 16v5h-5" />
      <path d="M15 15 21 21" />
      <path d="M4 4l5 5" />
    </svg>
  );
}

export function IconRepeat(p: IconProps) {
  return (
    <svg {...base(p)}>
      <path d="m17 2 4 4-4 4" />
      <path d="M3 11v-1a4 4 0 0 1 4-4h14" />
      <path d="m7 22-4-4 4-4" />
      <path d="M21 13v1a4 4 0 0 1-4 4H3" />
    </svg>
  );
}

export function IconLibrary(p: IconProps) {
  return (
    <svg {...base(p)}>
      <path d="M3 20V10M9 20V4M15 20V7M21 20v-8" />
    </svg>
  );
}

export function IconMic(p: IconProps) {
  return (
    <svg {...base(p)}>
      <path d="M12 2a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z" />
      <path d="M19 10v1a7 7 0 0 1-14 0v-1M12 18v4M8 22h8" />
    </svg>
  );
}

export function IconSliders(p: IconProps) {
  return (
    <svg {...base(p)}>
      <path d="M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3" />
      <path d="M1 14h6M9 8h6M17 16h6" />
    </svg>
  );
}

export function IconSpeaker(p: IconProps) {
  return (
    <svg {...base(p)}>
      <rect x="4" y="2" width="16" height="20" rx="2" />
      <circle cx="12" cy="14" r="4" />
      <path d="M12 6h.01" />
    </svg>
  );
}

export function IconHeadphones(p: IconProps) {
  return (
    <svg {...base(p)}>
      <path d="M3 14h3a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-7a9 9 0 0 1 18 0v7a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3" />
    </svg>
  );
}

export function IconPulse(p: IconProps) {
  return (
    <svg {...base(p)}>
      <path d="M3 12h4l3-8 4 16 3-8h4" />
    </svg>
  );
}

export function IconGauge(p: IconProps) {
  return (
    <svg {...base(p)}>
      <path d="M12 15l3.5-3.5" />
      <path d="M20.3 18a9 9 0 1 0-16.6 0" />
    </svg>
  );
}

export function IconSettings(p: IconProps) {
  return (
    <svg {...base(p)}>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33h0a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51h0a1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82v0a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  );
}

export function IconSearch(p: IconProps) {
  return (
    <svg {...base(p)}>
      <circle cx="11" cy="11" r="7" />
      <path d="m21 21-4.3-4.3" />
    </svg>
  );
}

export function IconBell(p: IconProps) {
  return (
    <svg {...base(p)}>
      <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
      <path d="M13.7 21a2 2 0 0 1-3.4 0" />
    </svg>
  );
}

export function IconSun(p: IconProps) {
  return (
    <svg {...base(p)}>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
    </svg>
  );
}

export function IconMoon(p: IconProps) {
  return (
    <svg {...base(p)}>
      <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9z" />
    </svg>
  );
}

export function IconVolume(p: IconProps) {
  return (
    <svg {...base(p)}>
      <path d="M11 5 6 9H2v6h4l5 4V5z" fill="currentColor" stroke="none" />
      <path d="M15.5 8.5a5 5 0 0 1 0 7M18.5 5.5a9 9 0 0 1 0 13" />
    </svg>
  );
}

export function IconVolumeX(p: IconProps) {
  return (
    <svg {...base(p)}>
      <path d="M11 5 6 9H2v6h4l5 4V5z" fill="currentColor" stroke="none" />
      <path d="m22 9-6 6M16 9l6 6" />
    </svg>
  );
}

export function IconHeart(p: IconProps) {
  return (
    <svg {...base(p)} fill="currentColor" stroke="none">
      <path d="M12 21s-7.5-4.7-9.5-9C1 8.5 3 5 6.5 5c2 0 3.5 1 4.5 2.5C12 6 13.5 5 15.5 5 19 5 21 8.5 19.5 12c-2 4.3-7.5 9-7.5 9z" />
    </svg>
  );
}

export function IconMore(p: IconProps) {
  return (
    <svg {...base(p)} fill="currentColor" stroke="none">
      <circle cx="5" cy="12" r="1.6" />
      <circle cx="12" cy="12" r="1.6" />
      <circle cx="19" cy="12" r="1.6" />
    </svg>
  );
}

export function IconUsb(p: IconProps) {
  return (
    <svg {...base(p)}>
      <rect x="7" y="2" width="10" height="6" rx="2" />
      <path d="M12 8v4M8 12h8l1.5 4h-11L8 12z" />
      <rect x="9.5" y="16" width="5" height="5" rx="1" />
    </svg>
  );
}

export function IconBluetooth(p: IconProps) {
  return (
    <svg {...base(p)}>
      <path d="m7 7 10 10-5 5V2l5 5L7 17" />
    </svg>
  );
}

export function IconHdmi(p: IconProps) {
  return (
    <svg {...base(p)}>
      <path d="M8 5h8l4 4v10H4V9l4-4z" />
      <path d="M9 13v3M12 13v3M15 13v3M7 9h10" />
    </svg>
  );
}

export function IconDac(p: IconProps) {
  return (
    <svg {...base(p)}>
      <rect x="3" y="8" width="18" height="8" rx="2" />
      <path d="M6 8V6h12v2M7 12h.01M17 12h.01M9 14h6" />
    </svg>
  );
}

export function IconMicrophone(p: IconProps) {
  return (
    <svg {...base(p)}>
      <rect x="9" y="2" width="6" height="12" rx="3" />
      <path d="M5 10a7 7 0 0 0 14 0M12 17v5M8 22h8" />
    </svg>
  );
}

export function IconAudioInterface(p: IconProps) {
  return (
    <svg {...base(p)}>
      <rect x="4" y="4" width="16" height="9" rx="2" />
      <rect x="7" y="16" width="3" height="4" rx="1" />
      <rect x="14" y="16" width="3" height="4" rx="1" />
      <circle cx="7.5" cy="8.5" r="0.5" />
      <circle cx="10.5" cy="8.5" r="0.5" />
      <circle cx="13.5" cy="8.5" r="0.5" />
      <circle cx="16.5" cy="8.5" r="0.5" />
    </svg>
  );
}

export function IconWaves(p: IconProps) {
  return (
    <svg {...base(p)}>
      <path d="M2 12c2 0 2-5 4-5s2 10 4 10 2-8 4-8 2 3 4 3 2-4 4-4" />
    </svg>
  );
}

export function IconArrowRight(p: IconProps) {
  return (
    <svg {...base(p)}>
      <path d="M5 12h14M13 6l6 6-6 6" />
    </svg>
  );
}

export function IconMusic(p: IconProps) {
  return (
    <svg {...base(p)}>
      <path d="M9 18V5l12-2v13" />
      <circle cx="6" cy="18" r="3" />
      <circle cx="18" cy="16" r="3" />
    </svg>
  );
}

export function IconCheck(p: IconProps) {
  return (
    <svg {...base(p)} strokeWidth={2}>
      <path d="m5 12 5 5 9-10" />
    </svg>
  );
}

export function IconX(p: IconProps) {
  return (
    <svg {...base(p)}>
      <path d="M6 6l12 12M18 6 6 18" />
    </svg>
  );
}

export function IconPlus(p: IconProps) {
  return (
    <svg {...base(p)} strokeWidth={2}>
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

export function IconFolder(p: IconProps) {
  return (
    <svg {...base(p)}>
      <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7z" />
    </svg>
  );
}

/** Faithful inline port of src/assets/folder.svg (FLB folder glyph). */
export function IconFolderSvg(p: IconProps) {
  const { size = 18, className, style } = p;
  return (
    <svg
      width={size}
      height={size}
      viewBox="383.069 437.98 21.932 17.796"
      className={className}
      style={style}
    >
      <path
        d="M 391.069 437.98 L 385.069 437.98 C 383.959 437.98 383.069 438.87 383.069 439.98 L 383.069 451.98 C 383.069 453.077 383.972 453.98 385.069 453.98 L 401.069 453.98 C 402.166 453.98 403.069 453.077 403.069 451.98 L 403.069 441.98 C 403.069 440.87 402.169 439.98 401.069 439.98 L 393.069 439.98 L 391.069 437.98 Z"
        fill="currentColor"
        fillOpacity="0.22"
      />
      <path
        d="M 401.015 447.139 L 401.015 445.81 L 398.357 445.81 L 398.357 449.464 C 398.078 449.258 397.74 449.132 397.361 449.132 C 396.92 449.132 396.498 449.307 396.186 449.619 C 395.875 449.93 395.7 450.353 395.7 450.793 C 395.7 451.234 395.875 451.656 396.186 451.968 C 396.498 452.279 396.92 452.454 397.361 452.454 C 397.801 452.454 398.224 452.279 398.535 451.968 C 398.847 451.656 399.022 451.234 399.022 450.793 L 399.022 447.139 L 401.015 447.139 M 398.357 442.488 C 400.12 442.488 401.809 443.188 403.055 444.434 C 404.301 445.68 405.001 447.37 405.001 449.132 C 405.001 450.894 404.301 452.584 403.055 453.83 C 401.809 455.076 400.12 455.776 398.357 455.776 C 396.595 455.776 394.905 455.076 393.659 453.83 C 392.413 452.584 391.713 450.894 391.713 449.132 C 391.713 447.37 392.413 445.68 393.659 444.434 C 394.905 443.188 396.595 442.488 398.357 442.488 Z"
        fillRule="evenodd"
        fill="currentColor"
      />
    </svg>
  );
}

export function IconQueue(p: IconProps) {
  return (
    <svg {...base(p)}>
      <path d="M3 6h13M3 12h9M3 18h13" />
      <path d="M18 8v10M15 12l3-4 3 4" />
    </svg>
  );
}

export function IconInfo(p: IconProps) {
  return (
    <svg {...base(p)}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 8h.01M12 12v4" />
    </svg>
  );
}

export function IconSort(p: IconProps) {
  return (
    <svg {...base(p)}>
      <path d="M7 4v16M7 4 4 7M7 4l3 3M17 20V4M17 20l-3-3M17 20l3-3" />
    </svg>
  );
}

export function IconClock(p: IconProps) {
  return (
    <svg {...base(p)}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 3" />
    </svg>
  );
}

export function IconGrid(p: IconProps) {
  return (
    <svg {...base(p)}>
      <rect x="3" y="3" width="7" height="7" rx="1.5" />
      <rect x="14" y="3" width="7" height="7" rx="1.5" />
      <rect x="3" y="14" width="7" height="7" rx="1.5" />
      <rect x="14" y="14" width="7" height="7" rx="1.5" />
    </svg>
  );
}

export function IconUser(p: IconProps) {
  return (
    <svg {...base(p)}>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21a8 8 0 0 1 16 0" />
    </svg>
  );
}

export function IconList(p: IconProps) {
  return (
    <svg {...base(p)}>
      <path d="M9 6h12M9 12h12M9 18h12M4 6h.01M4 12h.01M4 18h.01" />
    </svg>
  );
}

export function IconStar(p: IconProps) {
  return (
    <svg {...base(p)} fill="currentColor" stroke="none">
      <path d="m12 2 3.1 6.3 6.9 1-5 4.9 1.2 6.8L12 17.8 5.8 21l1.2-6.8-5-4.9 6.9-1L12 2z" />
    </svg>
  );
}

export function IconTrash(p: IconProps) {
  return (
    <svg {...base(p)}>
      <path d="M4 7h16M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2M6 7l1 13a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1l1-13" />
    </svg>
  );
}

export function IconEdit(p: IconProps) {
  return (
    <svg {...base(p)}>
      <path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
    </svg>
  );
}

export function IconBack(p: IconProps) {
  return (
    <svg {...base(p)}>
      <path d="M19 12H5M11 6l-6 6 6 6" />
    </svg>
  );
}

export function IconAlbum(p: IconProps) {
  return (
    <svg {...base(p)}>
      <circle cx="12" cy="12" r="9" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

export function IconLyrics(p: IconProps) {
  return (
    <svg {...base(p)}>
      <path d="M4 5h16M4 10h16M4 15h10M4 20h7" />
      <path d="M18 15v6M16 18h4" />
    </svg>
  );
}

export function IconPin(p: IconProps) {
  return (
    <svg {...base(p)}>
      <path d="M9 4h6l-1 7 3 3v2H7v-2l3-3-1-7z" />
      <path d="M12 16v4" />
    </svg>
  );
}

export function IconChevron(p: IconProps) {
  return (
    <svg {...base(p)}>
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}

export function IconNote(p: IconProps) {
  return (
    <svg {...base(p)}>
      <path d="M9 18V5l12-2v13" />
      <circle cx="6" cy="18" r="3" />
      <circle cx="18" cy="16" r="3" />
    </svg>
  );
}

export function IconCamera(p: IconProps) {
  return (
    <svg {...base(p)}>
      <path d="M4 8h3l1.6-2.2h6.8L17 8h3a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1Z" />
      <circle cx="12" cy="13.4" r="3.4" />
    </svg>
  );
}

export function IconExpand(p: IconProps) {
  return (
    <svg {...base(p)}>
      <path d="M9 4H4v5M15 4h5v5M9 20H4v-5M15 20h5v-5" />
    </svg>
  );
}

export function IconMinimize2(p: IconProps) {
  return (
    <svg {...base(p)}>
      <path d="M15 9V4h5M9 9H4V4M15 15v5h5M9 15H4v5" />
    </svg>
  );
}

export function IconWinMinimize(p: IconProps) {
  return (
    <svg {...base(p)}>
      <path d="M5 12h14" />
    </svg>
  );
}

export function IconWinMaximize(p: IconProps) {
  return (
    <svg {...base(p)}>
      <rect x="5.5" y="5.5" width="13" height="13" rx="1.5" />
    </svg>
  );
}

export function IconWinRestore(p: IconProps) {
  return (
    <svg {...base(p)}>
      <rect x="7.5" y="4.5" width="12" height="12" rx="1.4" />
      <path d="M16.5 8.5H6.9A2.4 2.4 0 0 0 4.5 10.9V19.5h9.6a2.4 2.4 0 0 0 2.4-2.4V8.5Z" />
    </svg>
  );
}

export function IconWinClose(p: IconProps) {
  return (
    <svg {...base(p)}>
      <path d="M6 6l12 12M18 6L6 18" />
    </svg>
  );
}

export function IconAvatarFallback(p: IconProps) {
  return (
    <svg {...base(p)}>
      <circle cx="12" cy="8.5" r="3.5" />
      <path d="M4.5 19.5c1.6-3.4 4.4-5 7.5-5s5.9 1.6 7.5 5" />
    </svg>
  );
}

export function IconSmartphone(p: IconProps) {
  return (
    <svg {...base(p)}>
      <rect x="6.5" y="2.5" width="11" height="19" rx="2.2" />
      <path d="M10.5 18.5h3" />
    </svg>
  );
}

export function IconQrCode(p: IconProps) {
  return (
    <svg {...base(p)}>
      <rect x="3.5" y="3.5" width="6" height="6" rx="1" />
      <rect x="14.5" y="3.5" width="6" height="6" rx="1" />
      <rect x="3.5" y="14.5" width="6" height="6" rx="1" />
      <path d="M14.5 14.5h3v3h-3zM20.5 14.5v3M17.5 20.5h3" />
    </svg>
  );
}

export function IconRefresh(p: IconProps) {
  return (
    <svg {...base(p)}>
      <path d="M20 11a8 8 0 10-2.1 6.4" />
      <path d="M20 5v6h-6" />
    </svg>
  );
}

export function IconFingerprint(p: IconProps) {
  return (
    <svg {...base(p)}>
      <path d="M12 11a4 4 0 0 1 4 4c0 2-.4 4.2-1 6" />
      <path d="M8 11a4 4 0 0 0-2 3.5c0 1.7.4 3.5 1 5" />
      <path d="M12 5a6 6 0 0 0-6 6c0 1.2.2 2.4.5 3.6" />
      <path d="M12 5a6 6 0 0 1 6 6c0 1.2-.2 2.4-.5 3.6" />
      <path d="M9 3.4A7 7 0 0 1 19 11v1" />
      <path d="M5 3.4A7 7 0 0 0 3 11v1" />
      <path d="M12 12a2 2 0 0 1 2 2c0 1.7-.3 3.4-.8 5" />
    </svg>
  );
}

const CONNECTION_ICONS: Record<string, (p: IconProps) => ReactElement> = {
  usb: IconUsb,
  bluetooth: IconBluetooth,
  hdmi: IconHdmi,
  dac: IconDac,
  headphones: IconHeadphones,
  microphone: IconMicrophone,
  audio_interface: IconAudioInterface,
  none: IconSpeaker,
};

export function iconForConnection(connection: string, p: IconProps = {}) {
  const Icon = CONNECTION_ICONS[connection] ?? IconSpeaker;
  return <Icon {...p} />;
}

const CONNECTION_LABELS: Record<string, string> = {
  usb: "USB",
  bluetooth: "Bluetooth",
  hdmi: "HDMI",
  dac: "DAC",
  headphones: "Fones de Ouvido",
  microphone: "Microfone",
  audio_interface: "Interface de Áudio",
  none: "—",
};

export function connectionLabel(connection: string) {
  return CONNECTION_LABELS[connection] ?? connection;
}
