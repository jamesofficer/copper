import { QueryClient } from "@tanstack/react-query";
import { describe, expect, it } from "vitest";
import { invalidateLocalChangeQueries } from "./localChangesMutations";

describe("invalidateLocalChangeQueries", () => {
  it("invalidates changes, full files, and the cheap badge count", async () => {
    const queryClient = new QueryClient();
    queryClient.setQueryData(["localChanges", "/repos/app"], {});
    queryClient.setQueryData(
      ["localFile", "/repos/app", "working", null, "app.ts"],
      "old contents",
    );
    queryClient.setQueryData(["localChangeCount", "/repos/app"], 2);

    await invalidateLocalChangeQueries(queryClient, "/repos/app");

    expect(
      queryClient.getQueryState(["localChanges", "/repos/app"])?.isInvalidated,
    ).toBe(true);
    expect(
      queryClient.getQueryState([
        "localFile",
        "/repos/app",
        "working",
        null,
        "app.ts",
      ])?.isInvalidated,
    ).toBe(true);
    expect(
      queryClient.getQueryState(["localChangeCount", "/repos/app"])
        ?.isInvalidated,
    ).toBe(true);
  });
});
