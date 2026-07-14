import type { FileStatus } from "../../../shared/types";

export const statusMeta: Record<FileStatus, { label: string; color: string }> =
  {
    added: { label: "A", color: "green.fg" },
    modified: { label: "M", color: "yellow.fg" },
    deleted: { label: "D", color: "red.fg" },
    renamed: { label: "R", color: "purple.fg" },
  };
