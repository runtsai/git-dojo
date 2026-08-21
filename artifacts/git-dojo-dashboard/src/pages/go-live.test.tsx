// @vitest-environment jsdom

import React from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GoLive, MissionVerificationNotice } from "./go-live";

const mocks = vi.hoisted(() => ({
  invalidateQueries: vi.fn(),
}));

vi.mock("@tanstack/react-query", () => ({
  useQueryClient: () => ({ invalidateQueries: mocks.invalidateQueries }),
}));

vi.mock("@workspace/api-client-react", () => {
  const status = {
    githubConnected: true,
    githubLogin: "testuser",
    repo: {
      name: "dojo-live-capstone",
      fullName: "testuser/dojo-live-capstone",
      htmlUrl: "https://github.com/testuser/dojo-live-capstone",
      cloneUrl: "https://github.com/testuser/dojo-live-capstone.git",
      defaultBranch: "main",
    },
    prNumber: null,
    prUrl: null,
    prBranch: null,
    missions: [
      {
        id: "push-commit",
        title: "Push a commit",
        verified: false,
        verifiedAt: null,
      },
    ],
    badgeEarnedAt: null,
  };

  return {
    useGetCapstoneStatus: () => ({ data: status, isLoading: false }),
    getGetCapstoneStatusQueryKey: () => ["capstone-status"],
    useCreateCapstoneRepo: () => ({ mutate: vi.fn(), isPending: false }),
    useDeleteCapstoneRepo: () => ({ mutate: vi.fn(), isPending: false }),
    useVerifyCapstoneMission: (options: {
      mutation: {
        onSuccess: (result: {
          missionId: string;
          verified: boolean;
          githubUnavailable: boolean;
          detail: string;
          status: typeof status;
        }) => void;
      };
    }) => ({
      isPending: false,
      mutate: ({ missionId }: { missionId: string }) =>
        options.mutation.onSuccess({
          missionId,
          verified: false,
          githubUnavailable: true,
          detail: "connector timeout",
          status,
        }),
    }),
  };
});

vi.mock("lucide-react", () => {
  const Icon = () => null;
  return {
    Rocket: Icon,
    Github: Icon,
    CheckCircle2: Icon,
    XCircle: Icon,
    Copy: Icon,
    Check: Icon,
    Loader2: Icon,
    Trash2: Icon,
    Trophy: Icon,
    ExternalLink: Icon,
    GitBranch: Icon,
    GitCommitHorizontal: Icon,
    GitMerge: Icon,
    ShieldAlert: Icon,
  };
});

describe("MissionVerificationNotice", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => cleanup());

  it("shows a clear retry message when GitHub is unavailable", () => {
    render(
      <MissionVerificationNotice
        result={{
          verified: false,
          githubUnavailable: true,
          detail: "Could not read commits from GitHub: network error",
        }}
      />,
    );

    expect(
      screen.getByText("Can’t reach GitHub right now — try checking your work again in a moment."),
    ).toBeTruthy();
    expect(screen.queryByText(/Could not read commits/)).toBeNull();
  });

  it("keeps the mission guidance when GitHub is reachable", () => {
    const detail = "Not yet: commit locally, then run git push.";
    render(
      <MissionVerificationNotice
        result={{ verified: false, githubUnavailable: false, detail }}
      />,
    );

    expect(screen.getByText(detail)).toBeTruthy();
    expect(screen.queryByText(/Can’t reach GitHub/)).toBeNull();
  });
});

describe("GoLive verification outage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => cleanup());

  it("keeps the retry message visible without refreshing away the last known capstone state", () => {
    render(<GoLive />);

    fireEvent.click(screen.getByRole("button", { name: "Check my work" }));

    expect(
      screen.getByText("Can’t reach GitHub right now — try checking your work again in a moment."),
    ).toBeTruthy();
    expect(mocks.invalidateQueries).not.toHaveBeenCalled();
  });
});