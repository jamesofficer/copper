import { Box, HStack, Text, VStack } from "@chakra-ui/react";
import type { ReactNode } from "react";
import { LuScrollText } from "react-icons/lu";
import type { AnalysisResult, ChangeGroupRisk } from "../../../shared/types";
import { severityDotColor } from "./RiskSeverityBadge";

export type AnalysisSelection =
  | { kind: "summary" }
  | { kind: "risk"; index: number }
  | { kind: "behavior"; index: number }
  | { kind: "group"; id: string };

interface Props {
  analysis: AnalysisResult;
  selection: AnalysisSelection;
  onSelect(selection: AnalysisSelection): void;
}

const riskDotColor: Record<ChangeGroupRisk, string> = {
  attention: "orange.solid",
  routine: "blue.solid",
  mechanical: "gray.solid",
};

function sameSelection(a: AnalysisSelection, b: AnalysisSelection): boolean {
  if (a.kind !== b.kind) return false;
  switch (a.kind) {
    case "summary":
      return true;
    case "group":
      return b.kind === "group" && a.id === b.id;
    case "risk":
      return b.kind === "risk" && a.index === b.index;
    case "behavior":
      return b.kind === "behavior" && a.index === b.index;
  }
}

function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <Text
      fontSize="2xs"
      fontWeight="semibold"
      color="fg.muted"
      textTransform="uppercase"
      letterSpacing="wider"
      px="2"
    >
      {children}
    </Text>
  );
}

function NavItem({
  selected,
  onClick,
  children,
}: {
  selected: boolean;
  onClick(): void;
  children: ReactNode;
}) {
  return (
    <Box
      as="button"
      onClick={onClick}
      textAlign="left"
      w="full"
      rounded="md"
      px="2"
      py="1.5"
      cursor="pointer"
      bg={selected ? "bg.emphasized" : "transparent"}
      _hover={{ bg: selected ? "bg.emphasized" : "bg.subtle" }}
    >
      {children}
    </Box>
  );
}

function Dot({ color }: { color: string }) {
  return (
    <Box w="1.5" h="1.5" mt="1.5" rounded="full" bg={color} flexShrink="0" />
  );
}

export default function AnalysisNav({ analysis, selection, onSelect }: Props) {
  return (
    <VStack alignItems="stretch" gap="5" px="3" py="4">
      <NavItem
        selected={sameSelection(selection, { kind: "summary" })}
        onClick={() => onSelect({ kind: "summary" })}
      >
        <HStack gap="2">
          <Box color="colorPalette.fg" flexShrink="0">
            <LuScrollText size={13} />
          </Box>
          <Text fontSize="xs" fontWeight="medium">
            Summary
          </Text>
        </HStack>
      </NavItem>

      <VStack alignItems="stretch" gap="1">
        <SectionLabel>Reading guide ({analysis.groups.length})</SectionLabel>
        {analysis.groups.map((group, index) => (
          <NavItem
            key={group.id}
            selected={sameSelection(selection, { kind: "group", id: group.id })}
            onClick={() => onSelect({ kind: "group", id: group.id })}
          >
            <HStack gap="2" alignItems="flex-start">
              <Text
                fontFamily="mono"
                fontSize="xs"
                color="fg.subtle"
                flexShrink="0"
              >
                {index + 1}
              </Text>
              <Text fontSize="xs" flex="1" lineClamp={2}>
                {group.title}
              </Text>
              <Dot color={riskDotColor[group.risk]} />
            </HStack>
          </NavItem>
        ))}
      </VStack>

      <VStack alignItems="stretch" gap="1">
        <SectionLabel>
          Behavior changes ({analysis.behaviorChanges.length})
        </SectionLabel>
        {analysis.behaviorChanges.length === 0 ? (
          <Text fontSize="xs" color="fg.muted" px="2" py="1">
            None identified.
          </Text>
        ) : (
          analysis.behaviorChanges.map((claim, index) => (
            <NavItem
              // biome-ignore lint/suspicious/noArrayIndexKey: claims have no stable id
              key={index}
              selected={sameSelection(selection, { kind: "behavior", index })}
              onClick={() => onSelect({ kind: "behavior", index })}
            >
              <HStack gap="2" alignItems="flex-start">
                <Dot color="teal.solid" />
                <Text fontSize="xs" lineClamp={2}>
                  {claim.title}
                </Text>
              </HStack>
            </NavItem>
          ))
        )}
      </VStack>

      <VStack alignItems="stretch" gap="1">
        <SectionLabel>Risks ({analysis.risks.length})</SectionLabel>
        {analysis.risks.length === 0 ? (
          <Text fontSize="xs" color="fg.muted" px="2" py="1">
            Nothing stood out.
          </Text>
        ) : (
          analysis.risks.map((claim, index) => (
            <NavItem
              // biome-ignore lint/suspicious/noArrayIndexKey: claims have no stable id
              key={index}
              selected={sameSelection(selection, { kind: "risk", index })}
              onClick={() => onSelect({ kind: "risk", index })}
            >
              <HStack gap="2" alignItems="flex-start">
                <Dot color={severityDotColor(claim.severity)} />
                <Text fontSize="xs" lineClamp={2}>
                  {claim.title}
                </Text>
              </HStack>
            </NavItem>
          ))
        )}
      </VStack>
    </VStack>
  );
}
