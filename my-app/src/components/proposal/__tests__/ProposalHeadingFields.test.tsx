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

  it("opens closing phrase options from a compact Heading drawer", () => {
    const onChange = vi.fn();

    render(
      <ProposalHeadingFields
        variableFields={[
          {
            id: "signature-signoff",
            label: "Signature / politeness formula",
            value: "Kind regards,",
            placeholder: "Kind regards,",
            onChange,
            closingOptionGroups: [
              {
                id: "recommended",
                label: "Recommended",
                options: ["Sincerely,"],
              },
              {
                id: "classic",
                label: "Classic",
                options: [
                  "Veuillez agréer, Madame, Monsieur, l'expression de mes salutations distinguées.",
                ],
              },
              {
                id: "custom",
                label: "Custom",
                options: [],
              },
            ],
          },
        ]}
      />,
    );

    expect(screen.getByText("Letter details")).toBeInTheDocument();
    expect(screen.getByLabelText("Signature / politeness formula")).toHaveValue(
      "Kind regards,",
    );
    expect(screen.queryByText("Choose formula")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Closing formula options")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Choose closing formula" }));
    expect(screen.getByLabelText("Closing formula options")).toBeInTheDocument();
    expect(screen.queryByText("Classic")).not.toBeInTheDocument();
    expect(screen.queryByText("Custom")).not.toBeInTheDocument();
    expect(screen.queryByText("Write your own in the field above.")).not.toBeInTheDocument();
    expect(screen.getByText("Recommended")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Sincerely," }));
    expect(onChange).toHaveBeenCalledWith("Sincerely,");
    expect(screen.queryByLabelText("Closing formula options")).not.toBeInTheDocument();
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

  it("keeps sender and recipient drawer fields in letter-block order", () => {
    render(
      <ProposalHeadingFields
        variableFields={[
          {
            id: "applicant-name",
            label: "Full name",
            value: "Joella Martin",
            onChange: vi.fn(),
          },
          {
            id: "applicant-role",
            label: "Target role",
            value: "Design Lead",
            onChange: vi.fn(),
          },
          {
            id: "applicant-company",
            label: "Applicant company / studio",
            value: "Studio Joella",
            onChange: vi.fn(),
          },
          {
            id: "contact-email",
            label: "Email",
            value: "joella@example.com",
            onChange: vi.fn(),
          },
          {
            id: "contact-phone",
            label: "Phone",
            value: "+33 6 00 00 00 00",
            onChange: vi.fn(),
          },
          {
            id: "contact-linkedin",
            label: "LinkedIn",
            value: "linkedin.com/in/joella",
            onChange: vi.fn(),
          },
          {
            id: "contact-location",
            label: "City / location",
            value: "Paris",
            onChange: vi.fn(),
          },
          {
            id: "recipient-name",
            label: "Recipient name / team",
            value: "Walter Gropius",
            onChange: vi.fn(),
          },
          {
            id: "recipient-role",
            label: "Recipient role / contact title",
            value: "Director",
            onChange: vi.fn(),
          },
          {
            id: "recipient-company",
            label: "Recipient company",
            value: "Bauhaus Dessau",
            onChange: vi.fn(),
          },
          {
            id: "recipient-address",
            label: "Recipient address",
            value: "Gropiusallee 38",
            onChange: vi.fn(),
          },
          {
            id: "recipient-email",
            label: "Recipient email",
            value: "office@bauhaus.de",
            onChange: vi.fn(),
          },
          {
            id: "recipient-city",
            label: "Recipient city / location",
            value: "Berlin",
            onChange: vi.fn(),
          },
          {
            id: "proposal-subject",
            label: "Subject line",
            value: "Application for Design Lead",
            onChange: vi.fn(),
          },
          {
            id: "letter-date",
            label: "Date",
            value: "May 30, 2026",
            onChange: vi.fn(),
          },
          {
            id: "salutation",
            label: "Salutation",
            value: "Dear Hiring Manager,",
            onChange: vi.fn(),
          },
          {
            id: "signature-signoff",
            label: "Signature / politeness formula",
            value: "Kind regards,",
            onChange: vi.fn(),
          },
        ]}
      />,
    );

    const groupLabels = (groupTitle: string) => {
      const group = screen
        .getByText(groupTitle)
        .closest(".dasti-proposal-skeleton-rail__variable-group");
      expect(group).toBeTruthy();
      return Array.from(
        (group as HTMLElement).querySelectorAll("input, textarea"),
      ).map((field) => field.getAttribute("aria-label"));
    };

    expect(groupLabels("Applicant details")).toEqual([
      "Full name",
      "Target role",
      "Applicant company / studio",
      "Email",
      "Phone",
      "LinkedIn",
      "City / location",
    ]);
    expect(groupLabels("Recipient details")).toEqual([
      "Recipient name / team",
      "Recipient role / contact title",
      "Recipient company",
      "Recipient email",
      "Recipient address",
      "Recipient city / location",
    ]);
    expect(groupLabels("Letter details")).toEqual([
      "Subject line",
      "Date",
      "Salutation",
      "Signature / politeness formula",
    ]);
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

  it("keeps cursor position when editing a controlled heading field", () => {
    function ControlledHeading(): JSX.Element {
      const [name, setName] = React.useState("Alex Martin");
      return (
        <ProposalHeadingFields
          variableFields={[
            {
              id: "applicant-name",
              label: "Full name",
              value: name,
              onChange: setName,
            },
          ]}
        />
      );
    }

    render(<ControlledHeading />);

    const input = screen.getByLabelText("Full name") as HTMLInputElement;
    input.focus();
    input.setSelectionRange(4, 4);

    fireEvent.change(input, {
      target: {
        value: "Alex  Martin",
        selectionStart: 5,
        selectionEnd: 5,
      },
    });

    expect(input).toHaveValue("Alex  Martin");
    expect(document.activeElement).toBe(input);
    expect(input.selectionStart).toBe(5);
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
