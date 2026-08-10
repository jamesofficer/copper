import { Button, Center, HStack, Spinner, Text } from "@chakra-ui/react";
import { LuRefreshCw, LuTriangleAlert } from "react-icons/lu";

// The centred loading and error states a full-height reading panel shows
// before its content arrives. Shared by the pull-request and issue overviews
// so the two read identically while loading.

export function PanelLoading({ label }: { label: string }) {
  return (
    <Center h="full">
      <HStack color="fg.muted">
        <Spinner size="sm" />
        <Text fontSize="sm">{label}</Text>
      </HStack>
    </Center>
  );
}

export function PanelError({ message }: { message: string }) {
  return (
    <Center h="full" p="8">
      <Text fontSize="sm" color="fg.error" textAlign="center">
        {message}
      </Text>
    </Center>
  );
}

interface SectionErrorProps {
  message: string;
  retrying: boolean;
  onRetry(): void;
}

// One part of a panel failed while the rest loaded. It reports in place, where
// the missing content would have been, rather than as a toast: a toast is gone
// in seconds and the gap it described stays on screen, reading as "there is
// nothing here".
export function PanelSectionError({
  message,
  retrying,
  onRetry,
}: SectionErrorProps) {
  return (
    <HStack
      gap="3"
      px="3"
      py="2"
      rounded="md"
      borderWidth="1px"
      borderColor="border.warning"
      color="fg.muted"
      fontSize="sm"
    >
      <LuTriangleAlert size={14} />
      <Text flex="1">{message}</Text>
      <Button size="xs" variant="outline" loading={retrying} onClick={onRetry}>
        <LuRefreshCw /> Retry
      </Button>
    </HStack>
  );
}
