import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import {
  ManualApplicationHandoffPanel,
  type ManualApplicationHandoffPanelState,
} from "../ManualApplicationHandoffPanel";

const APPLICATION_URL = "https://jobs.example.com/apply/123?private=value";
const MANIFEST_DIGEST = "a".repeat(64);
const REQUIRED_COPY = `I confirm this Twoweeks handoff package ${MANIFEST_DIGEST}.`;

function preparedState(
  overrides: Partial<ManualApplicationHandoffPanelState> = {},
): ManualApplicationHandoffPanelState {
  return {
    status: "handoff_prepared",
    enabled: true,
    canPrepare: false,
    canConfirm: true,
    canUseConfirmedPackage: false,
    handoffId: "manual-application-handoff:one",
    applicationPackageId: "application-package:hash-a",
    manifestDigest: MANIFEST_DIGEST,
    requiredConfirmationCopy: REQUIRED_COPY,
    destinationHostname: "jobs.example.com",
    destinationOrigin: "https://jobs.example.com",
    providerVerified: false,
    approvedAnswers: [],
    downloadableArtifacts: [],
    answerCopyBlockedReason:
      "Approved answer copy is blocked until approved answers are server-derived.",
    downloadBlockedReason:
      "Approved artifact downloads are blocked until an approved export representation is available.",
    ...overrides,
  };
}

function handlers() {
  return {
    onPrepare: vi.fn(async () => undefined),
    onConfirm: vi.fn(async () => undefined),
    onRecordCopySucceeded: vi.fn(async () => undefined),
    onRecordFileDownloadRequested: vi.fn(async () => undefined),
    onRecordDestinationOpenRequested: vi.fn(async () => undefined),
    onReportOutcome: vi.fn(async () => undefined),
  };
}

describe("ManualApplicationHandoffPanel", () => {
  it("shows a safe disabled state when the PR80B flag is off", () => {
    render(
      <ManualApplicationHandoffPanel
        jobId="job_1"
        applicationUrl={APPLICATION_URL}
        handoff={{
          status: "disabled",
          enabled: false,
          canPrepare: false,
          canConfirm: false,
          canUseConfirmedPackage: false,
          providerVerified: false,
          approvedAnswers: [],
          downloadableArtifacts: [],
        }}
        {...handlers()}
      />,
    );

    expect(screen.getByText("Manual application handoff")).toBeInTheDocument();
    expect(screen.getByText("Manual handoff is disabled.")).toBeInTheDocument();
    expect(
      screen.getByText("Twoweeks will not submit, fill forms, or contact the provider."),
    ).toBeInTheDocument();
  });

  it("requires exact confirmation copy before the package can be used", async () => {
    const props = handlers();
    render(
      <ManualApplicationHandoffPanel
        jobId="job_1"
        applicationUrl={APPLICATION_URL}
        handoff={preparedState()}
        {...props}
      />,
    );

    const confirmButton = screen.getByRole("button", {
      name: "Confirm package",
    });
    expect(confirmButton).toBeDisabled();
    fireEvent.change(screen.getByLabelText("Confirmation copy"), {
      target: { value: REQUIRED_COPY },
    });
    expect(confirmButton).not.toBeDisabled();
    fireEvent.click(confirmButton);
    await waitFor(() =>
      expect(props.onConfirm).toHaveBeenCalledWith({
        handoffId: "manual-application-handoff:one",
        manifestDigest: MANIFEST_DIGEST,
        confirmationCopy: REQUIRED_COPY,
      }),
    );
  });

  it("marks answer copy and artifact downloads blocked when no approved representation exists", () => {
    const props = handlers();

    render(
      <ManualApplicationHandoffPanel
        jobId="job_1"
        applicationUrl={APPLICATION_URL}
        handoff={preparedState({
          status: "handoff_confirmed",
          canConfirm: false,
          canUseConfirmedPackage: true,
        })}
        {...props}
      />,
    );

    expect(
      screen.getByText(
        "Approved answer copy is blocked until approved answers are server-derived.",
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        "Approved artifact downloads are blocked until an approved export representation is available.",
      ),
    ).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /copy/i })).toBeNull();
    expect(screen.queryByRole("button", { name: /download/i })).toBeNull();
    expect(props.onRecordCopySucceeded).not.toHaveBeenCalled();
    expect(props.onRecordFileDownloadRequested).not.toHaveBeenCalled();
  });

  it("does not render placeholder markdown download controls even if stale artifact props arrive", () => {
    const props = handlers();

    render(
      <ManualApplicationHandoffPanel
        jobId="job_1"
        applicationUrl={APPLICATION_URL}
        handoff={preparedState({
          status: "handoff_confirmed",
          canConfirm: false,
          canUseConfirmedPackage: true,
          downloadableArtifacts: [
            {
              artifactRef: "resume-variant-artifact:hash-a",
              label: "Resume variant",
              filename: "resume-variant.md",
              mimeType: "text/markdown",
              text: "# Resume variant",
              artifactDigest: "c".repeat(64),
            },
          ],
        })}
        {...props}
      />,
    );

    expect(
      screen.queryByRole("button", { name: "Download Resume variant" }),
    ).toBeNull();
    expect(
      screen.getByText(
        "Approved artifact downloads are blocked until an approved export representation is available.",
      ),
    ).toBeInTheDocument();
    expect(props.onRecordFileDownloadRequested).not.toHaveBeenCalled();
  });

  it("does not render answer copy controls when only test-only answer props arrive", () => {
    const props = handlers();

    render(
      <ManualApplicationHandoffPanel
        jobId="job_1"
        applicationUrl={APPLICATION_URL}
        handoff={preparedState({
          status: "handoff_confirmed",
          canConfirm: false,
          canUseConfirmedPackage: true,
          approvedAnswers: [
            {
              answerRef: "application-answer:one",
              label: "Why are you interested?",
              text: "I am interested because the role matches my operations work.",
              answerDigest: "b".repeat(64),
            },
          ],
        })}
        {...props}
      />,
    );

    expect(
      screen.queryByRole("button", { name: "Copy Why are you interested?" }),
    ).toBeNull();
    expect(
      screen.getByText(
        "Approved answer copy is blocked until approved answers are server-derived.",
      ),
    ).toBeInTheDocument();
    expect(props.onRecordCopySucceeded).not.toHaveBeenCalled();
  });

  it("records destination open requested before opening the owned job application URL", async () => {
    const props = handlers();
    const open = vi.fn();
    vi.stubGlobal("open", open);

    render(
      <ManualApplicationHandoffPanel
        jobId="job_1"
        applicationUrl={APPLICATION_URL}
        handoff={preparedState({
          status: "handoff_confirmed",
          canConfirm: false,
          canUseConfirmedPackage: true,
        })}
        {...props}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Open application form" }));
    await waitFor(() =>
      expect(props.onRecordDestinationOpenRequested).toHaveBeenCalledWith({
        handoffId: "manual-application-handoff:one",
        manifestDigest: MANIFEST_DIGEST,
      }),
    );
    expect(open).toHaveBeenCalledWith(APPLICATION_URL, "_blank", "noopener");
  });

  it("labels user-reported outcomes as unverified provider truth", async () => {
    const props = handlers();
    render(
      <ManualApplicationHandoffPanel
        jobId="job_1"
        applicationUrl={APPLICATION_URL}
        handoff={preparedState({
          status: "destination_open_requested",
          canConfirm: false,
          canUseConfirmedPackage: true,
        })}
        {...props}
      />,
    );

    expect(
      screen.getByText("Reported by you, not verified by the provider."),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "I submitted it" }));
    await waitFor(() =>
      expect(props.onReportOutcome).toHaveBeenCalledWith({
        handoffId: "manual-application-handoff:one",
        manifestDigest: MANIFEST_DIGEST,
        outcome: "user_reported_submitted",
      }),
    );
  });
});
