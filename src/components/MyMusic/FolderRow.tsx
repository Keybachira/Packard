import { IconFolderSvg } from "../icons";
import { gradientFor } from "./data";

interface Props {
  name: string;
  path: string | null;
  count: number;
  onClick: () => void;
}

export default function FolderRow({
  name,
  path,
  count,
  onClick,
}: Props) {
  const root = path === "<root>";
  return (
    <button className="folder-item" onClick={onClick} title={root ? name : path ?? name}>
      <span
        className="folder-icon"
        style={{
          background: root ? gradientFor("root") : gradientFor(name),
        }}
      >
        <IconFolderSvg />
      </span>
      <span className="folder-name">{name}</span>
      <span className="folder-count">
        {count} {count === 1 ? "faixa" : "faixas"}
      </span>
    </button>
  );
}