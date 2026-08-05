import { QueryClient } from "@tanstack/react-query";
import { describe, expect, it } from "vitest";
import { invalidateLocalChangeQueries } from "./localChangesMutations";

describe("invalidateLocalChangeQueries", () => {
  it("invalidates both detailed changes and the cheap badge count", async () => {
    const queryClient = new QueryClient();
    queryClient.setQueryData(["localChanges", "/repos/app"], {});
    queryClient.setQueryData(["localChangeCount", "/repos/app"], 2);

    await invalidateLocalChangeQueries(queryClient, "/repos/app");

    expect(
      queryClient.getQueryState(["localChanges", "/repos/app"])?.isInvalidated,
    ).toBe(true);
    expect(
      queryClient.getQueryState(["localChangeCount", "/repos/app"])
        ?.isInvalidated,
    ).toBe(true);
  });
});
