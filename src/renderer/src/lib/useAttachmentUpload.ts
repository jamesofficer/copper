import { useCallback, useRef, useState } from "react";
import type { AttachmentUpload } from "../../../shared/types";
import { toaster } from "../components/ui/toaster";

// Where the attachment gets uploaded. GitHub's upload is tied to a repo you can
// read; the PR is optional because the new-PR dialog has no PR yet.
export interface AttachmentTarget {
  repo: string;
  prNumber?: number;
}

// While a file uploads, its place in the text is held by GitHub's own
// placeholder wording, then swapped for the real embed.
export function uploadPlaceholder(name: string): string {
  return `![Uploading ${name}…]()`;
}

export function attachmentMarkdown(upload: AttachmentUpload): string {
  if (upload.kind === "image") return `![${upload.name}](${upload.url})`;
  // GitHub turns a bare video URL into a player; a link would just download it.
  if (upload.kind === "video") return upload.url;
  return `[${upload.name}](${upload.url})`;
}

// Returns the new text and where the inserted run ends, so a second file lands
// after the first rather than at the end of the whole description.
function insertAt(
  text: string,
  at: number,
  insert: string,
): { text: string; end: number } {
  const cursor = Math.min(Math.max(at, 0), text.length);
  const needsBreakBefore = cursor > 0 && !text.slice(0, cursor).endsWith("\n");
  const prefix = needsBreakBefore ? "\n" : "";
  const added = `${prefix}${insert}\n`;
  return {
    text: `${text.slice(0, cursor)}${added}${text.slice(cursor)}`,
    end: cursor + added.length,
  };
}

function errorMessage(cause: unknown): string {
  return cause instanceof Error
    ? cause.message.replace(/^.*Error: /, "")
    : String(cause);
}

// GitHub's own ceiling for a video attachment, and the most generous limit it
// applies to anything. Smaller per-type limits are left to GitHub to enforce,
// since they vary by plan and it reports them clearly — this only stops a file
// far too big from being copied across IPC to be refused.
const maxUploadBytes = 100 * 1024 * 1024;

function tooBig(file: File): boolean {
  return file.size > maxUploadBytes;
}

interface Options {
  target: AttachmentTarget;
  value: string;
  onChange(value: string): void;
}

// Uploads pasted/dropped files to GitHub and keeps the editor text in step.
// Uploads run in parallel, so every edit goes through a ref holding the latest
// text rather than the value captured when the upload started.
export function useAttachmentUpload({ target, value, onChange }: Options) {
  const valueRef = useRef(value);
  valueRef.current = value;

  const [uploadingCount, setUploadingCount] = useState(0);

  const replace = useCallback(
    (find: string, insert: string) => {
      const next = valueRef.current.replace(find, insert);
      valueRef.current = next;
      onChange(next);
    },
    [onChange],
  );

  const uploadFiles = useCallback(
    async (dropped: File[], cursor: number) => {
      for (const file of dropped.filter(tooBig)) {
        toaster.create({
          type: "error",
          title: `${file.name} is too big to attach`,
          description: "GitHub accepts attachments up to 100 MB.",
          closable: true,
        });
      }

      const files = dropped.filter((file) => !tooBig(file));
      if (files.length === 0) return;

      const status = await window.api.getAttachmentAuthStatus();
      if (!status.signedIn) {
        const signedIn = await window.api.signInForAttachments();
        if (!signedIn.signedIn) {
          toaster.create({
            type: "error",
            title: "GitHub sign-in needed for attachments",
            description:
              "GitHub has no API for uploads, so attaching files needs a signed-in GitHub session.",
            closable: true,
          });
          return;
        }
      }

      // Every placeholder goes in first, so the text order matches the order
      // the files were dropped in however the uploads finish.
      let text = valueRef.current;
      for (const file of files) {
        const inserted = insertAt(text, cursor, uploadPlaceholder(file.name));
        text = inserted.text;
        cursor = inserted.end;
      }
      valueRef.current = text;
      onChange(text);

      setUploadingCount((count) => count + files.length);
      await Promise.all(
        files.map(async (file) => {
          try {
            const upload = await window.api.uploadAttachment(
              target.repo,
              target.prNumber ?? null,
              {
                name: file.name,
                data: new Uint8Array(await file.arrayBuffer()),
              },
            );
            replace(uploadPlaceholder(file.name), attachmentMarkdown(upload));
          } catch (cause) {
            replace(uploadPlaceholder(file.name), "");
            toaster.create({
              type: "error",
              title: `Couldn’t attach ${file.name}`,
              description: errorMessage(cause),
              closable: true,
            });
          } finally {
            setUploadingCount((count) => count - 1);
          }
        }),
      );
    },
    [onChange, replace, target.prNumber, target.repo],
  );

  return { uploading: uploadingCount > 0, uploadingCount, uploadFiles };
}
