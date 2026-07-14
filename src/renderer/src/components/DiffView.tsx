import { Box, Center, Flex, Text } from "@chakra-ui/react";
import type { PullRequestFile } from "../../../shared/types";

interface Props {
  file: PullRequestFile;
}

type LineKind = "hunk" | "add" | "del" | "context" | "meta";

interface DiffLine {
  kind: LineKind;
  oldNumber: number | null;
  newNumber: number | null;
  text: string;
}

function parsePatch(patch: string): DiffLine[] {
  const lines: DiffLine[] = [];
  let oldNumber = 0;
  let newNumber = 0;

  for (const raw of patch.split("\n")) {
    if (raw.startsWith("@@")) {
      const match = raw.match(/@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@/);
      if (match) {
        oldNumber = Number(match[1]);
        newNumber = Number(match[2]);
      }
      lines.push({ kind: "hunk", oldNumber: null, newNumber: null, text: raw });
      continue;
    }
    if (raw.startsWith("+")) {
      lines.push({
        kind: "add",
        oldNumber: null,
        newNumber,
        text: raw.slice(1),
      });
      newNumber++;
      continue;
    }
    if (raw.startsWith("-")) {
      lines.push({
        kind: "del",
        oldNumber,
        newNumber: null,
        text: raw.slice(1),
      });
      oldNumber++;
      continue;
    }
    if (raw.startsWith("\\")) {
      lines.push({ kind: "meta", oldNumber: null, newNumber: null, text: raw });
      continue;
    }
    if (raw === "") continue;

    lines.push({ kind: "context", oldNumber, newNumber, text: raw.slice(1) });
    oldNumber++;
    newNumber++;
  }

  return lines;
}

const rowStyles: Record<LineKind, { bg: string; sign: string }> = {
  add: { bg: "green.subtle", sign: "+" },
  del: { bg: "red.subtle", sign: "-" },
  context: { bg: "transparent", sign: " " },
  hunk: { bg: "bg.muted", sign: "" },
  meta: { bg: "transparent", sign: "" },
};

function Gutter({ value }: { value: number | null }) {
  return (
    <Text
      as="span"
      w="12"
      flexShrink="0"
      px="2"
      textAlign="right"
      color="fg.subtle"
      userSelect="none"
    >
      {value ?? ""}
    </Text>
  );
}

export default function DiffView({ file }: Props) {
  if (!file.patch) {
    return (
      <Center h="full" p="8">
        <Text color="fg.muted" fontSize="sm" textAlign="center">
          {file.status === "renamed"
            ? "File renamed with no content changes."
            : "No text diff available — this file is binary or too large to show."}
        </Text>
      </Center>
    );
  }

  const lines = parsePatch(file.patch);

  return (
    <Box
      h="full"
      overflow="auto"
      fontFamily="mono"
      fontSize="xs"
      lineHeight="1.6"
    >
      {lines.map((line, index) => {
        const style = rowStyles[line.kind];
        return (
          <Flex
            // biome-ignore lint/suspicious/noArrayIndexKey: patch lines have no stable id
            key={index}
            bg={style.bg}
            color={line.kind === "hunk" ? "fg.muted" : "fg"}
            minW="max-content"
          >
            {line.kind === "hunk" || line.kind === "meta" ? (
              <Text as="span" px="3" py="0.5" whiteSpace="pre">
                {line.text}
              </Text>
            ) : (
              <>
                <Gutter value={line.oldNumber} />
                <Gutter value={line.newNumber} />
                <Text
                  as="span"
                  w="4"
                  flexShrink="0"
                  textAlign="center"
                  color="fg.subtle"
                  userSelect="none"
                >
                  {style.sign}
                </Text>
                <Text as="span" flex="1" pr="4" whiteSpace="pre">
                  {line.text}
                </Text>
              </>
            )}
          </Flex>
        );
      })}
    </Box>
  );
}
