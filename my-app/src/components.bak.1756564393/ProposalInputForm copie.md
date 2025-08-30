"use client";

import React from "react";
import { useForm } from "react-hook-form";
import styles from "./ProposalInputForm.module.css";
import { zodResolver } from "@hookform/resolvers/zod";
import clsx from "clsx";

import { api } from "../../convex/_generated/api";
import { useAction } from "convex/react";
import { formSchema, FormValues } from "./ProposalInputForm.schemas";

interface ProposalInputFormProps {
  onSubmit: (values: FormValues, proposalContent: string) => void;
}

const ProposalInputForm: React.FC<ProposalInputFormProps> = ({ onSubmit }) => {
  const generateProposalAction = useAction(api.functions.generateProposal);
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
        onSubmit(values, result.proposalContent);
      }
    } catch (error: any) {
      console.error("Error generating proposal:", error);
      setErrorMessage("Failed to generate proposal. Please try again.");
    } finally {
      setIsGenerating(false);
    }
  }

  const inputClasses = clsx(
    "w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-gray-300",
    "dark:bg-gray-700 dark:border-gray-600 dark:placeholder-gray-400 dark:text-gray-200 dark:focus:ring-gray-500 dark:focus:border-gray-500"
  );

    const containerClasses = clsx(
    "flex flex-col gap-4",
    "dark:bg-gray-800 dark:text-gray-200"
  );


  return (
    <div className={containerClasses}>
      <form
  onSubmit={(e) => {
    void form.handleSubmit(handleSubmit)(e);
  }}
>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {/* Main inputs */}
          <div className="space-y-4 md:col-span-2">
            <div>
              <input
                type="text"
                id="jobTitle"
                {...form.register("jobTitle")}
                className={inputClasses}
                placeholder="Enter Job Title"
              />
              {form.formState.errors.jobTitle && (
                <p className={styles.errorMessage}>{form.formState.errors.jobTitle.message}</p>
              )}
            </div>
            <div>
              <textarea
                id="jobDescription"
                rows={2}
                {...form.register("jobDescription")}
                className={inputClasses}
                placeholder="Paste Job Description"
              />
              {form.formState.errors.jobDescription && (
                <p className={styles.errorMessage}>{form.formState.errors.jobDescription.message}</p>
              )}
            </div>
          </div>
          {/* Controls row */}
          <div className="flex flex-wrap items-center gap-2 md:col-span-2">
            {/* Model Type */}
            <div className="flex-1 min-w-[100px]">
              <div className="relative">
                <select
                  id="modelType"
                  {...form.register("modelType")}
                  className={inputClasses}
                >
                  <option value="chatgpt">ChatGPT</option>
                  <option value="mistral-small-latest">Mistral Small</option>
                  <option value="mistral-large-latest">Mistral Large</option>
                  <option value="mistral-agent">Mistral Agent</option>
                </select>
                </div>
            </div>

            {/* Proposal Type */}
            <div className="flex-1 min-w-[100px]">
              <div className="relative">
                <select
                  id="proposalType"
                  {...form.register("proposalType")}
                  className={inputClasses}
                >
                  <option value="technical">🔧 Technical</option>
                  <option value="creative">🎨 Creative</option>
                </select>
              </div>
            </div>

            {/* Formality Level */}
            <div className="flex-1 min-w-[100px]">
              <div className="relative">
                <select
                  id="formalityLevel"
                  {...form.register("formalityLevel")}
                  className={inputClasses}
                >
                  <option value="informal">😊 Informal</option>
                  <option value="neutral">😐 Neutral</option>
                  <option value="formal">🎩 Formal</option>
                </select>
              </div>
            </div>

            {/* Creativity Level */}
            <div className="flex-1 min-w-[100px]">
              <div className="relative">
                <select
                  id="creativity"
                  {...form.register("creativity")}
                  className={inputClasses}
                >
                  <option value="low">💡 Low</option>
                  <option value="medium">💡💡 Medium</option>
                  <option value="high">💡💡💡 High</option>
                </select>
              </div>
            </div>

            {/* Generate Button */}
            <button
              type="submit"
              disabled={isGenerating}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-500 rounded-lg hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50"
            >
              {isGenerating ? "✨..." : "✨ Generate"}
            </button>
          </div>
        </div>
        {errorMessage && <p className={styles.errorMessage}>{errorMessage}</p>}
      </form>
    </div>
  );
};

export default ProposalInputForm;
