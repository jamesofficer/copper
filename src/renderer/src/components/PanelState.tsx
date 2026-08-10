import { Center, HStack, Spinner, Text } from "@chakra-ui/react";

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
