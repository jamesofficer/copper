import { Box, Button, HStack, Text, Textarea } from "@chakra-ui/react";
import type { KeyboardEvent, ReactNode } from "react";
import Markdown from "./Markdown";

export type MarkdownEditorMode = "write" | "preview";

interface Props {
  value: string;
  mode: MarkdownEditorMode;
  placeholder: string;
  rows?: number;
  onChange(value: string): void;
  onModeChange(mode: MarkdownEditorMode): void;
  // Fired on Cmd/Ctrl+Enter in the textarea.
  onSubmit?(): void;
  // Rendered right-aligned below the editor, inside the border.
  footer?: ReactNode;
}

// A bordered Write/Preview markdown editor — used for conversation comments
// and PR descriptions. Mode is controlled so the parent can reset it.
export default function MarkdownEditor({
  value,
  mode,
  placeholder,
  rows = 4,
  onChange,
  onModeChange,
  onSubmit,
  footer,
}: Props) {
  function handleKeyDown(event: KeyboardEvent) {
    if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
      onSubmit?.();
    }
  }

  return (
    <Box borderWidth="1px" rounded="lg" overflow="hidden">
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
      </HStack>
      {mode === "write" ? (
        <Textarea
          placeholder={placeholder}
          rows={rows}
          resize="vertical"
          border="none"
          rounded="none"
          _focus={{ outline: "none", boxShadow: "none" }}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          onKeyDown={handleKeyDown}
        />
      ) : (
        <Box px="4" py="3" minH="102px">
          {value.trim() ? (
            <Markdown>{value}</Markdown>
          ) : (
            <Text fontSize="sm" color="fg.muted" fontStyle="italic">
              Nothing to preview.
            </Text>
          )}
        </Box>
      )}
      {footer && (
        <HStack justifyContent="flex-end" px="3" py="2" borderTopWidth="1px">
          {footer}
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
