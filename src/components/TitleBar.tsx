import { useEffect, useState } from "react";
import * as api from "../lib/deviceApi";
import { IconWinClose, IconWinMaximize, IconWinMinimize, IconWinRestore } from "./icons";

/**
 * Custom title bar. The window itself runs undecorated (see
 * `decorations: false` in tauri.conf.json) so this replaces the native
 * Windows chrome with something that actually matches the app.
 */
export default function TitleBar() {
  const [maximized, setMaximized] = useState(false);

  useEffect(() => {
    api.windowIsMaximized().then(setMaximized).catch(() => {});
  }, []);

  const minimize = () => api.windowMinimize().catch(() => {});
  const toggleMaximize = () =>
    api
      .windowToggleMaximize()
      .then(setMaximized)
      .catch(() => {});
  const close = () => api.windowClose().catch(() => {});

  return (
    <div className="titlebar" data-tauri-drag-region onDoubleClick={toggleMaximize}>
      <div className="titlebar-brand" data-tauri-drag-region>
        <span className="titlebar-bars" data-tauri-drag-region>
          {[7, 12, 9, 15, 8].map((h, i) => (
            <span key={i} style={{ height: h }} />
          ))}
        </span>
        <span className="titlebar-name" data-tauri-drag-region>
          SoundCore
        </span>
      </div>

      <div className="titlebar-ctrls">
        <button className="titlebar-btn" title="Minimizar" onClick={minimize}>
          <IconWinMinimize size={13} strokeWidth={1.6} />
        </button>
        <button
          className="titlebar-btn"
          title={maximized ? "Restaurar" : "Maximizar"}
          onClick={toggleMaximize}
        >
          {maximized ? (
            <IconWinRestore size={12} strokeWidth={1.6} />
          ) : (
            <IconWinMaximize size={11} strokeWidth={1.6} />
          )}
        </button>
        <button className="titlebar-btn titlebar-close" title="Fechar" onClick={close}>
          <IconWinClose size={14} strokeWidth={1.7} />
        </button>
      </div>
    </div>
  );
}
