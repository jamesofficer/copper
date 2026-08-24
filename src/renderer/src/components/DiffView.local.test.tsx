import { fireEvent, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { PullRequestFile } from "../../../shared/types";
import { stubApi } from "../testing/api";
import { renderWithProviders } from "../testing/render";
import DiffView from "./DiffView";

const file: PullRequestFile = {
  path: "src/app.ts",
  previousPath: null,
  status: "modified",
  additions: 1,
  deletions: 1,
  patch: "@@ -3 +3 @@\n-old value\n+new value",
};

const fullFile = "first line\nsecond line\nnew value\nfourth line\n";
const getLocalFile = vi.fn().mockResolvedValue(fullFile);

beforeEach(() => {
  getLocalFile.mockClear();
  stubApi({ getLocalFile });
});

describe("DiffView local full-file features", () => {
  it("expands hidden lines from the matching local file source", async () => {
    renderWithProviders(
      <DiffView
        file={file}
        fileContext={{
          kind: "local",
          repoPath: "/repos/app",
          source: { kind: "index" },
        }}
      />,
    );

    const expand = await screen.findByRole("button", {
      name: "Show 2 hidden lines",
    });
    fireEvent.click(expand);

    expect(await screen.findByText("first line")).toBeTruthy();
    expect(getLocalFile).toHaveBeenCalledWith(
      "/repos/app",
      { kind: "index" },
      "src/app.ts",
    );
  });

  it("switches between the diff and the complete local file", async () => {
    renderWithProviders(
      <DiffView
        file={file}
        fileContext={{
          kind: "local",
          repoPath: "/repos/app",
          source: { kind: "working" },
        }}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "View file" }));

    expect(await screen.findByText("fourth line")).toBeTruthy();
    expect(screen.getByRole("button", { name: "View diff" })).toBeTruthy();
    await waitFor(() =>
      expect(getLocalFile).toHaveBeenCalledWith(
        "/repos/app",
        { kind: "working" },
        "src/app.ts",
      ),
    );
  });
});
