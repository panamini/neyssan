import React from "react";
import { act, fireEvent, render, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { ProjectsModal } from "../structured-blocks/ProjectsModal";
import { CertificationModal } from "../structured-blocks/CertificationAffiliationModal";

describe("Structured modal targeted focus", () => {
  it("keeps the targeted projects field focused while typing after preview targeting", async () => {
    vi.useFakeTimers();

    render(
      <ProjectsModal
        open
        initialItemId="project-2:description"
        onClose={vi.fn()}
        onSave={vi.fn()}
        items={[
          {
            id: "project-1",
            title: "Atlas",
            meta: "2023",
            description: "System work",
          },
          {
            id: "project-2",
            title: "Signal",
            meta: "2024",
            description: "Platform work",
          },
        ]}
      />,
    );

    await act(async () => {
      vi.advanceTimersByTime(60);
    });

    const row = document.querySelector(
      '[data-entry-id="project-2"]',
    ) as HTMLElement;
    const descriptionInput = within(row).getByLabelText("Description");

    expect(descriptionInput).toHaveFocus();
    descriptionInput.focus();
    expect(descriptionInput).toHaveFocus();
    fireEvent.change(descriptionInput, {
      target: { value: "Expanded platform work" },
    });

    await act(async () => {
      vi.advanceTimersByTime(60);
    });

    expect(descriptionInput).toHaveFocus();
    vi.useRealTimers();
  });

  it("keeps the active certification field focused while typing after preview targeting", async () => {
    vi.useFakeTimers();

    render(
      <CertificationModal
        open
        initialItemId="cert-2"
        onClose={vi.fn()}
        onSave={vi.fn()}
        items={[
          {
            id: "cert-1",
            certificationName: "AWS Certified Developer",
            issuingOrganization: "Amazon Web Services",
            issueDate: "2022-01-01T00:00:00.000Z",
            expirationDate: null,
            credentialId: "AWS-1",
          },
          {
            id: "cert-2",
            certificationName: "Service Design Masterclass",
            issuingOrganization: "Nielsen Norman Group",
            issueDate: "2024-01-01T00:00:00.000Z",
            expirationDate: null,
            credentialId: "NNG-2",
          },
        ]}
      />,
    );

    await act(async () => {
      vi.advanceTimersByTime(60);
    });

    const row = document.querySelector('[data-entry-id="cert-2"]') as HTMLElement;
    const credentialIdInput = within(row).getByLabelText("Credential ID");

    credentialIdInput.focus();
    expect(credentialIdInput).toHaveFocus();
    fireEvent.change(credentialIdInput, {
      target: { value: "NNG-2024-UPDATED" },
    });

    await act(async () => {
      vi.advanceTimersByTime(60);
    });

    expect(credentialIdInput).toHaveFocus();
    vi.useRealTimers();
  });
});
