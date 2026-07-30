import { IconButton } from "@chakra-ui/react";
import { LuStar } from "react-icons/lu";
import type { PullRequest } from "../../../shared/types";
import { toggleFavourite, useIsFavourite } from "../lib/favouritePrs";

interface Props {
  pr: PullRequest;
}

// Stars the PR into the sidebar's Favourites section. Local only — GitHub has
// no such thing, so nothing is sent anywhere.
export default function FavouritePrButton({ pr }: Props) {
  const favourite = useIsFavourite(pr);

  return (
    <IconButton
      aria-label={favourite ? "Remove from favourites" : "Add to favourites"}
      title={favourite ? "Remove from favourites" : "Add to favourites"}
      aria-pressed={favourite}
      variant="outline"
      size="xs"
      colorPalette={favourite ? "yellow" : undefined}
      color={favourite ? "yellow.fg" : undefined}
      onClick={() => toggleFavourite(pr)}
    >
      <LuStar fill={favourite ? "currentColor" : "none"} />
    </IconButton>
  );
}
