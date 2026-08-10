import { ButtonGroup, IconButton, Pagination } from "@chakra-ui/react";
import { LuChevronLeft, LuChevronRight } from "react-icons/lu";

interface Props {
  count: number;
  pageSize: number;
  page: number;
  onPageChange(page: number): void;
}

// Pages rather than infinite scroll: a reviewer working through a list needs to
// know where they are in it, and needs the end to arrive. Renders nothing while
// everything fits on one page, so a short list carries no chrome.
export default function ListPagination({
  count,
  pageSize,
  page,
  onPageChange,
}: Props) {
  if (count <= pageSize) return null;

  return (
    <Pagination.Root
      count={count}
      pageSize={pageSize}
      page={page}
      onPageChange={(details) => onPageChange(details.page)}
      maxW="2xl"
      w="full"
      pt="2"
    >
      <ButtonGroup variant="ghost" size="sm" w="full">
        <Pagination.PageText format="long" flex="1" color="fg.muted" />
        <Pagination.PrevTrigger asChild>
          <IconButton aria-label="Previous page">
            <LuChevronLeft />
          </IconButton>
        </Pagination.PrevTrigger>
        <Pagination.Items
          render={(item) => (
            <IconButton
              aria-label={`Page ${item.value}`}
              variant={{ base: "ghost", _selected: "outline" }}
            >
              {item.value}
            </IconButton>
          )}
        />
        <Pagination.NextTrigger asChild>
          <IconButton aria-label="Next page">
            <LuChevronRight />
          </IconButton>
        </Pagination.NextTrigger>
      </ButtonGroup>
    </Pagination.Root>
  );
}
