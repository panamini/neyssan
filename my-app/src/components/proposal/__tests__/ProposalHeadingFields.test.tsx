import React from "react";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import ProposalHeadingFields, {
  type ProposalHeadingField,
} from "../ProposalHeadingFields";

function fields(
  overrides: Partial<ProposalHeadingField>[] = [],
): ProposalHeadingField[] {
  const base: ProposalHeadingField[] = [
    {
      id: "proposal-subject",
      label: "Subject line",
      value: "Application for Product Designer",
      placeholder: "Subject line",
      onChange: vi.fn(),
      onBlur: vi.fn(),
    },
    {
      id: "applicant-name",
      label: "Full name",
      value: "Alex Martin",
      placeholder: "Full name",
      onChange: vi.fn(),
      onBlur: vi.fn(),
    },
    {
      id: "applicant-role",
      label: "Target role",
      value: "Product Designer",
      placeholder: "Target role",
      onChange: vi.fn(),
      onBlur: vi.fn(),
    },
    {
      id: "contact-line",
      label: "Contact information",
      value: "alex@example.com",
      placeholder: "email · phone · location · LinkedIn · website",
      onChange: vi.fn(),
      onBlur: vi.fn(),
    },
    {
      id: "letter-date",
      label: "Date",
      value: "May 11, 2026",
      placeholder: "Date",
      onChange: vi.fn(),
      onBlur: vi.fn(),
    },
    {
      id: "recipient-name",
      label: "Recipient name / team",
      value: "Hiring Manager",
      placeholder: "Hiring manager or team",
      onChange: vi.fn(),
      onBlur: vi.fn(),
    },
    {
      id: "recipient-company",
      label: "Recipient company",
      value: "Northstar",
      placeholder: "Company name",
      onChange: vi.fn(),
      onBlur: vi.fn(),
    },
    {
      id: "recipient-city",
      label: "Recipient city / location",
      value: "Paris",
      placeholder: "Company city / remote",
      onChange: vi.fn(),
      onBlur: vi.fn(),
    },
    {
      id: "salutation",
      label: "Salutation",
      value: "Dear hiring team,",
      placeholder: "Dear Hiring Manager,",
      onChange: vi.fn(),
      onBlur: vi.fn(),
    },
  ];

  return base.map((field, index) => ({ ...field, ...overrides[index] }));
}

describe("ProposalHeadingFields", () => {
  it("renders applicant, recipient, and letter field groups", () => {
    render(<ProposalHeadingFields variableFields={fields()} />);

    expect(screen.getByText("Applicant details")).toBeInTheDocument();
    expect(screen.getByText("Recipient details")).toBeInTheDocument();
    expect(screen.getByText("Letter details")).toBeInTheDocument();
    expect(screen.getByLabelText("Full name")).toHaveValue("Alex Martin");
    expect(screen.getByLabelText("Recipient company")).toHaveValue("Northstar");
    expect(screen.getByLabelText("Recipient city / location")).toHaveValue("Paris");
  });

  it("supports structured applicant contact fields in the applicant group", () => {
    render(
      <ProposalHeadingFields
        variableFields={[
          fields()[1],
          fields()[2],
          {
            id: "contact-email",
            label: "Email",
            value: "alex@example.com",
            onChange: vi.fn(),
          },
          {
            id: "contact-phone",
            label: "Phone",
            value: "+33 6 00 00 00 00",
            onChange: vi.fn(),
          },
          {
            id: "contact-location",
            label: "City / location",
            value: "Paris",
            onChange: vi.fn(),
          },
        ]}
      />,
    );

    const applicantGroup = screen
      .getByText("Applicant details")
      .closest(".dasti-proposal-skeleton-rail__variable-group");

    expect(applicantGroup).toBeTruthy();
    expect(within(applicantGroup as HTMLElement).getByLabelText("Email")).toHaveValue(
      "alex@example.com",
    );
    expect(within(applicantGroup as HTMLElement).getByLabelText("Phone")).toHaveValue(
      "+33 6 00 00 00 00",
    );
  });

  it("preserves field callbacks", () => {
    const onChange = vi.fn();
    const onBlur = vi.fn();
    render(
      <ProposalHeadingFields variableFields={fields([{ onChange, onBlur }])} />,
    );

    const subject = screen.getByLabelText("Subject line");
    fireEvent.change(subject, { target: { value: "Updated subject" } });
    fireEvent.blur(subject);

    expect(onChange).toHaveBeenCalledWith("Updated subject");
    expect(onBlur).toHaveBeenCalledTimes(1);
  });

  it("renders remaining heading fields after known groups", () => {
    render(
      <ProposalHeadingFields
        variableFields={[
          ...fields(),
          {
            id: "custom-heading",
            label: "Custom heading",
            value: "Custom value",
            onChange: vi.fn(),
          },
        ]}
      />,
    );

    const other = screen.getByText("Other heading fields").closest("div");
    expect(other).toBeTruthy();
    expect(
      within(other!.parentElement as HTMLElement).getByLabelText(
        "Custom heading",
      ),
    ).toHaveValue("Custom value");
  });

  it("renders the existing empty hint when there are no fields", () => {
    render(<ProposalHeadingFields variableFields={[]} />);

    expect(
      screen.getByText(
        "Generate a draft to edit document header details here.",
      ),
    ).toBeInTheDocument();
  });

  it("uses heading placeholders without writing them as values", () => {
    render(
      <ProposalHeadingFields
        variableFields={fields([
          {},
          { value: "" },
          { value: "" },
          { value: "" },
          {},
          { value: "" },
          { value: "" },
          { value: "" },
          { value: "" },
        ])}
      />,
    );

    expect(screen.getByPlaceholderText("Full name")).toHaveValue("");
    expect(screen.getByPlaceholderText("Target role")).toHaveValue("");
    expect(
      screen.getByPlaceholderText(
        "email · phone · location · LinkedIn · website",
      ),
    ).toHaveValue("");
    expect(screen.getByPlaceholderText("Hiring manager or team")).toHaveValue("");
    expect(screen.getByPlaceholderText("Company name")).toHaveValue("");
    expect(screen.getByPlaceholderText("Company city / remote")).toHaveValue("");
    expect(screen.getByPlaceholderText("Dear Hiring Manager,")).toHaveValue("");
  });
});
