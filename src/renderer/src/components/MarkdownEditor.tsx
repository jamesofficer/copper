import { Box, Button, HStack, Spinner, Text, Textarea } from "@chakra-ui/react";
import type {
  ClipboardEvent,
  DragEvent,
  KeyboardEvent,
  ReactNode,
} from "react";
import { useRef, useState } from "react";
import { LuImage } from "react-icons/lu";
import {
  type AttachmentTarget,
  useAttachmentUpload,
} from "../lib/useAttachmentUpload";
import Markdown from "./Markdown";

export type MarkdownEditorMode = "write" | "preview";

interface Props {
  value: string;
  mode: MarkdownEditorMode;
  placeholder: string;
  rows?: number;
  autoFocus?: boolean;
  onChange(value: string): void;
  onModeChange(mode: MarkdownEditorMode): void;
  // Fired on Cmd/Ctrl+Enter in the textarea.
  onSubmit?(): void;
  onEscape?(): void;
  // Extra content on the right of the Write/Preview tabs (a line-range
  // label, for example).
  toolbar?: ReactNode;
  // Rendered on the left of the footer row, inside the border.
  footerStart?: ReactNode;
  // Rendered right-aligned below the editor, inside the border.
  footer?: ReactNode;
  // Set to allow images and videos to be pasted, dropped, or picked. Uploaded
  // to GitHub through a signed-in github.com session — see main/github/
  // attachments.ts for why that's needed.
  attachments?: AttachmentTarget;
}

// A bordered Write/Preview markdown editor — used for conversation comments,
// inline review comments, and PR descriptions. Mode is controlled so the
// parent can reset it.
export default function MarkdownEditor({
  value,
  mode,
  placeholder,
  rows = 4,
  autoFocus,
  onChange,
  onModeChange,
  onSubmit,
  onEscape,
  toolbar,
  footerStart,
  footer,
  attachments,
}: Props) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [dragging, setDragging] = useState(false);

  const { uploading, uploadFiles } = useAttachmentUpload({
    target: attachments ?? { repo: "" },
    value,
    onChange,
  });

  // Tracks the textarea's height, so switching to Preview doesn't resize the
  // editor under the cursor.
  const previewMinHeight = `${rows * 25 + 2}px`;

  function handleKeyDown(event: KeyboardEvent) {
    if (
      event.target instanceof HTMLTextAreaElement &&
      (event.metaKey || event.ctrlKey) &&
      event.key === "Enter"
    ) {
      onSubmit?.();
    }
    if (event.key === "Escape") {
      onEscape?.();
    }
  }

  function cursorPosition(): number {
    return textareaRef.current?.selectionStart ?? value.length;
  }

  function upload(files: File[]) {
    if (!attachments || files.length === 0) return;
    void uploadFiles(files, cursorPosition());
  }

  function handlePaste(event: ClipboardEvent<HTMLTextAreaElement>) {
    const files = Array.from(event.clipboardData.files);
    if (!attachments || files.length === 0) return;
    // A pasted screenshot is a file with no text alternative — take it over
    // the default paste, which would drop it.
    event.preventDefault();
    upload(files);
  }

  function handleDrop(event: DragEvent) {
    setDragging(false);
    const files = Array.from(event.dataTransfer.files);
    if (!attachments || files.length === 0) return;
    event.preventDefault();
    upload(files);
  }

  function handleDragOver(event: DragEvent) {
    if (!attachments || !event.dataTransfer.types.includes("Files")) return;
    event.preventDefault();
    setDragging(true);
  }

  return (
    <Box
      borderWidth="1px"
      rounded="lg"
      overflow="hidden"
      borderColor={dragging ? "colorPalette.solid" : undefined}
      onKeyDown={handleKeyDown}
    >
      <HStack gap="1" px="2" py="1.5" bg="bg.subtle" borderBottomWidth="1px">
        <ModeButton
          active={mode === "write"}
          onClick={() => onModeChange("write")}
          label="Write"
        />
        <ModeButton
          active={mode === "preview"}
          onClick={() => onModeChange("preview")}
          label="Preview"
        />
        {toolbar && (
          <Box ml="auto" minW="0" px="1">
            {toolbar}
          </Box>
        )}
      </HStack>
      {mode === "write" ? (
        <Textarea
          ref={textareaRef}
          autoFocus={autoFocus}
          placeholder={placeholder}
          rows={rows}
          resize="vertical"
          border="none"
          rounded="none"
          _focus={{ outline: "none", boxShadow: "none" }}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          onPaste={handlePaste}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={() => setDragging(false)}
        />
      ) : (
        <Box px="4" py="3" minH={previewMinHeight}>
          {value.trim() ? (
            <Markdown>{value}</Markdown>
          ) : (
            <Text fontSize="sm" color="fg.muted" fontStyle="italic">
              Nothing to preview.
            </Text>
          )}
        </Box>
      )}
      {attachments && mode === "write" && (
        <HStack
          px="3"
          py="1.5"
          gap="2"
          borderTopWidth="1px"
          bg="bg.subtle"
          color="fg.muted"
          fontSize="xs"
        >
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept="image/*,video/*"
            hidden
            onChange={(event) => {
              upload(Array.from(event.target.files ?? []));
              event.target.value = "";
            }}
          />
          <Button
            size="2xs"
            variant="ghost"
            color="fg.muted"
            onClick={() => fileInputRef.current?.click()}
          >
            <LuImage /> Attach files
          </Button>
          {uploading ? (
            <HStack gap="1.5">
              <Spinner size="xs" />
              <Text>Uploading to GitHub…</Text>
            </HStack>
          ) : (
            <Text>Or paste and drop images and videos here.</Text>
          )}
        </HStack>
      )}
      {(footer || footerStart) && (
        <HStack px="3" py="2" borderTopWidth="1px" gap="2">
          {footerStart}
          {footer && (
            <HStack gap="2" ml="auto">
              {footer}
            </HStack>
          )}
        </HStack>
      )}
    </Box>
  );
}

interface ModeButtonProps {
  active: boolean;
  onClick(): void;
  label: string;
}

function ModeButton({ active, onClick, label }: ModeButtonProps) {
  return (
    <Button
      size="2xs"
      variant={active ? "surface" : "ghost"}
      color={active ? "fg" : "fg.muted"}
      onClick={onClick}
    >
      {label}
    </Button>
  );
}
