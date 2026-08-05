import { screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { PullRequestFile } from "../../../shared/types";
import { renderWithProviders } from "../testing/render";
import FileList from "./FileList";

const changedFile: PullRequestFile = {
  path: "src/app.ts",
  previousPath: null,
  status: "modified",
  additions: 1,
  deletions: 1,
  patch: "@@ -1 +1 @@\n-old\n+new",
};

describe("FileList row actions", () => {
  it("disables a write action while another checkout write is pending", () => {
    renderWithProviders(
      <FileList
        files={[changedFile]}
        selectedPath={null}
        onSelect={vi.fn()}
        rowActions={[
          {
            icon: <span>+</span>,
            label: "Stage",
            disabled: true,
            onRun: vi.fn(),
          },
        ]}
      />,
    );

    expect(
      screen
        .getByRole("button", { name: "Stage src/app.ts" })
        .hasAttribute("disabled"),
    ).toBe(true);
  });
});
