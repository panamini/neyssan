"use client";

import React from "react";
import { useForm } from "react-hook-form";
import styles from "./ProposalInputForm.module.css";
import { zodResolver } from "@hookform/resolvers/zod";
import clsx from "clsx";
import { ArrowUp, Square, Wrench, Palette, Laugh, Smile, SmilePlus } from "lucide-react"; // Importing Lucide-react icons
import CustomToggle from "./CustomToggle";
import { Button } from "./ui/button";

import { api } from "../../convex/_generated/api";
import { useAction, useMutation } from "convex/react";
import { formSchema, FormValues } from "./ProposalInputForm.schemas";

interface ProposalInputFormProps {
  onSubmit: (values: FormValues, proposalContent: string) => void;
}

const ProposalInputForm: React.FC<ProposalInputFormProps> = ({ onSubmit }) => {
  const generateProposalAction = useAction(api.functions.generateProposal);
  const saveJobAndProposalMutation = useMutation(api.saveJobAndProposal.default);
  const [isGenerating, setIsGenerating] = React.useState(false);
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      jobTitle: "",
      jobDescription: "",
      proposalType: "technical" as const,
      formalityLevel: "neutral",
      creativity: "medium",
      modelType: "mistral-small-latest" as const, // Default model type
    },
  });

  async function handleSubmit(values: FormValues) {
    try {
      setIsGenerating(true);
      setErrorMessage(null);

      const result = await generateProposalAction(values);
      if (result) {
        // Attempt to save the generated proposal to the backend as a draft.
        try {
          await saveJobAndProposalMutation({
            jobData: {
              platform: "web",
              title: values.jobTitle,
              description: values.jobDescription,
              url: window.location.href,
            },
            proposalText: result.proposalContent,
          });
          console.log("Saved proposal as draft");
        } catch (saveErr) {
          console.warn("Failed to save proposal draft:", saveErr);
          // don't block showing the proposal if save fails
        }

        onSubmit(values, result.proposalContent);
      } else {
        setErrorMessage("No proposal returned from the server.");
      }
    } catch (error: any) {
      console.error("Error generating proposal:", error);
      setErrorMessage(error?.message ?? "Failed to generate proposal. Please try again.");
    } finally {
      setIsGenerating(false);
    }
  }

  return (
    <div className={styles.container}>
      <form
        onSubmit={(e) => {
          void form.handleSubmit(handleSubmit)(e);
        }}
      >
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {/* Main inputs */}
          <div className="md:col-span-2">
            <div>
              <input
                type="text"
                id="jobTitle"
                {...form.register("jobTitle")}
                className={clsx(styles.inputElement, styles.jobField)}
                placeholder="Enter Job Title"
              />
              {form.formState.errors.jobTitle && (
                <p className={styles.errorMessage}>{form.formState.errors.jobTitle.message}</p>
              )}
            </div>
            <div className="relative mt-2">
              <textarea
                id="jobDescription"
                rows={2}
                {...form.register("jobDescription")}
                className={clsx(styles.inputElement, styles.jobField)}
                placeholder="Paste Job Description"
              />
              <Button
                type="submit"
                disabled={form.watch("jobDescription").length < 10}
                title={form.watch("jobDescription").length < 10 ? "Minimum 10 characters required" : ""}
                className="absolute -translate-y-1/2 right-4 top-1/2"
                variant="primary"
                size="sm"
              >
                {isGenerating ? <Square className="text-red-500" /> : <ArrowUp />}
              </Button>
              {form.formState.errors.jobDescription && (
                <p className={styles.errorMessage}>{form.formState.errors.jobDescription.message}</p>
              )}
            </div>
          </div>
          {/* Controls row */}
          <div className="flex flex-wrap items-center gap-4 md:col-span-2">
            {/* Model Type */}
            {/* Model Type */}
            <div className="flex-1 min-w-[150px] flex items-center gap-2">
              <CustomToggle
                isModelToggle={true}
                options={[
                  { value: "chatgpt", label: "ChatGPT" },
                  { value: "mistral-small-latest", label: "Mistral Small" },
                  { value: "mistral-large-latest", label: "Mistral Large" },
                  { value: "mistral-agent", label: "Mistral Agent" },
                ]}
                value={form.watch("modelType")}
                onChange={(value: string) =>
                  form.setValue(
                    "modelType",
                    value as
                      | "chatgpt"
                      | "mistral-small-latest"
                      | "mistral-large-latest"
                      | "mistral-agent"
                  )
                }
              />
            </div>

            {/* Proposal Type */}
            <div className="flex-1 min-w-[150px] flex items-center gap-2">
              <CustomToggle
                options={[
                  { value: "technical", label: <><Wrench size={16} /></> },
                  { value: "creative", label: <><Palette size={16} /></> },
                ]}
                value={form.watch("proposalType")}
                onChange={(value: string) =>
                  form.setValue("proposalType", value as "technical" | "creative")
                }
              />
            </div>

            {/* Formality Level */}
            <div className="flex-1 min-w-[150px] flex items-center gap-2">
              <CustomToggle
                options={[
                  { value: "formal", label: <><SmilePlus size={16} /></> },
                  { value: "neutral", label: <><Smile size={16} /></> },
                  { value: "informal", label: <><Laugh size={16} /></> },
                ]}
                value={form.watch("formalityLevel")}
                onChange={(value: string) =>
                  form.setValue(
                    "formalityLevel",
                    value as "informal" | "formal" | "neutral"
                  )
                }
              />
            </div>

            {/* Creativity Level */}
            <div className="flex-1 min-w-[150px] flex items-center gap-2">
              <CustomToggle
                isCreativityToggle={true}
                options={[
                  { value: "low", label: "Low" },
                  { value: "medium", label: "Medium" },
                  { value: "high", label: "High" },
                ]}
                value={form.watch("creativity")}
                onChange={(value: string) =>
                  form.setValue("creativity", value as "low" | "medium" | "high")
                }
              />
            </div>
          </div>
        </div>
        {errorMessage && <p className={styles.errorMessage}>{errorMessage}</p>}
      </form>
    </div>
  );
};

export default ProposalInputForm;
