"use client";

import React from "react";
import { Button } from "./ui/button";

type SkillAdderProps = {
  onAdd: (skill: string) => Promise<void> | void;
};
export function SkillAdder({ onAdd }: SkillAdderProps) {
  const [value, setValue] = React.useState("");
  return (
    <div className="flex items-center gap-2">
      <input
        aria-label="New skill"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        className="px-2 py-1 text-sm border [border-color:var(--color-border-strong)] [border-radius:var(--radius-control)] focus:border-[color:var(--ti)] outline-none dasti-field-no-glow"
        placeholder="Add skill"
      />
      <Button
          onClick={() =>{
            const v = value.trim();
            if (!v) return;
            void onAdd(v);
            setValue("");
          }}
        className="px-2 py-1 text-sm bg-surface-muted rounded"
      >
        Add</Button>
    </div>
  );
}

type ExperienceEntry = {
  company?: string;
  title?: string;
  startDate?: number | string;
  endDate?: number | string;
  description?: string;
};

type ExperienceAdderProps = {
  onAdd: (entry: ExperienceEntry) => Promise<void> | void;
};
export function ExperienceAdder({ onAdd }: ExperienceAdderProps) {
  const [company, setCompany] = React.useState("");
  const [title, setTitle] = React.useState("");
  const [startDate, setStartDate] = React.useState("");
  const [endDate, setEndDate] = React.useState("");
  const [description, setDescription] = React.useState("");

  return (
    <div className="p-2 border [border-color:var(--color-border-strong)] [border-radius:var(--radius-control)]">
      <div className="grid gap-2 md:grid-cols-2">
        <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Title" className="px-2 py-1 text-sm border [border-color:var(--color-border-strong)] [border-radius:var(--radius-control)] focus:border-[color:var(--ti)] outline-none dasti-field-no-glow" />
        <input value={company} onChange={(e) => setCompany(e.target.value)} placeholder="Company" className="px-2 py-1 text-sm border [border-color:var(--color-border-strong)] [border-radius:var(--radius-control)] focus:border-[color:var(--ti)] outline-none dasti-field-no-glow" />
        <input value={startDate} onChange={(e) => setStartDate(e.target.value)} placeholder="Start date (YYYY-MM-DD)" className="px-2 py-1 text-sm border [border-color:var(--color-border-strong)] [border-radius:var(--radius-control)] focus:border-[color:var(--ti)] outline-none dasti-field-no-glow" />
        <input value={endDate} onChange={(e) => setEndDate(e.target.value)} placeholder="End date (YYYY-MM-DD or empty)" className="px-2 py-1 text-sm border [border-color:var(--color-border-strong)] [border-radius:var(--radius-control)] focus:border-[color:var(--ti)] outline-none dasti-field-no-glow" />
        <textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Description" rows={2} className="px-2 py-1 text-sm border [border-color:var(--color-border-strong)] [border-radius:var(--radius-control)] focus:border-[color:var(--ti)] outline-none dasti-field-no-glow md:col-span-2" />
      </div>
      <div className="flex gap-2 mt-2">
        <Button
          onClick={() =>{
            const entry: ExperienceEntry = {
              company: company.trim() || undefined,
              title: title.trim() || undefined,
              startDate: startDate ? new Date(startDate).getTime() : undefined,
              endDate: endDate ? new Date(endDate).getTime() : undefined,
              description: description.trim() || undefined,
            };
            void onAdd(entry);
            setCompany("");
            setTitle("");
            setStartDate("");
            setEndDate("");
            setDescription("");
          }}
          className="px-3 py-1 text-sm bg-surface-muted rounded"
        >
          Add experience</Button>
      </div>
    </div>
  );
}

type EducationEntry = {
  school?: string;
  degree?: string;
  fieldOfStudy?: string;
  startDate?: number | string;
  endDate?: number | string;
};

type EducationAdderProps = {
  onAdd: (entry: EducationEntry) => Promise<void> | void;
};
export function EducationAdder({ onAdd }: EducationAdderProps) {
  const [school, setSchool] = React.useState("");
  const [degree, setDegree] = React.useState("");
  const [fieldOfStudy, setFieldOfStudy] = React.useState("");
  const [startDate, setStartDate] = React.useState("");
  const [endDate, setEndDate] = React.useState("");

  return (
    <div className="p-2 border [border-color:var(--color-border-strong)] [border-radius:var(--radius-control)]">
      <div className="grid gap-2 md:grid-cols-2">
        <input value={school} onChange={(e) => setSchool(e.target.value)} placeholder="School" className="px-2 py-1 text-sm border [border-color:var(--color-border-strong)] [border-radius:var(--radius-control)] focus:border-[color:var(--ti)] outline-none dasti-field-no-glow" />
        <input value={degree} onChange={(e) => setDegree(e.target.value)} placeholder="Degree" className="px-2 py-1 text-sm border [border-color:var(--color-border-strong)] [border-radius:var(--radius-control)] focus:border-[color:var(--ti)] outline-none dasti-field-no-glow" />
        <input value={fieldOfStudy} onChange={(e) => setFieldOfStudy(e.target.value)} placeholder="Field of study" className="px-2 py-1 text-sm border [border-color:var(--color-border-strong)] [border-radius:var(--radius-control)] focus:border-[color:var(--ti)] outline-none dasti-field-no-glow" />
        <input value={startDate} onChange={(e) => setStartDate(e.target.value)} placeholder="Start date (YYYY-MM-DD)" className="px-2 py-1 text-sm border [border-color:var(--color-border-strong)] [border-radius:var(--radius-control)] focus:border-[color:var(--ti)] outline-none dasti-field-no-glow" />
        <input value={endDate} onChange={(e) => setEndDate(e.target.value)} placeholder="End date (YYYY-MM-DD or empty)" className="px-2 py-1 text-sm border [border-color:var(--color-border-strong)] [border-radius:var(--radius-control)] focus:border-[color:var(--ti)] outline-none dasti-field-no-glow" />
      </div>
      <div className="flex gap-2 mt-2">
        <Button
          onClick={() =>{
            const entry: EducationEntry = {
              school: school.trim() || undefined,
              degree: degree.trim() || undefined,
              fieldOfStudy: fieldOfStudy.trim() || undefined,
              startDate: startDate ? new Date(startDate).getTime() : undefined,
              endDate: endDate ? new Date(endDate).getTime() : undefined,
            };
            void onAdd(entry);
            setSchool("");
            setDegree("");
            setFieldOfStudy("");
            setStartDate("");
            setEndDate("");
          }}
          className="px-3 py-1 text-sm bg-surface-muted rounded"
        >
          Add education</Button>
      </div>
    </div>
  );
}
