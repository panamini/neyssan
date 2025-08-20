"use client";

import React from "react";
import DOMPurify from "dompurify";

type Experience = {
  company: string;
  title: string;
  startDate?: number;
  endDate?: number;
  description?: string;
};

type Education = {
  school: string;
  degree?: string;
  fieldOfStudy?: string;
  startDate?: number;
  endDate?: number;
};

type Profile = {
  name?: string;
  email?: string;
  summary?: string;
  rawText?: string;
  linkedIn?: string;
  skills?: string[];
  experience?: Experience[];
  education?: Education[];
  preferences?: Record<string, any>;
  metadata?: Record<string, any>;
};

function formatDate(ts?: number) {
  if (!ts) return "";
  try {
    const d = new Date(ts);
    if (isNaN(d.getTime())) return "";
    return d.toLocaleDateString();
  } catch {
    return "";
  }
}

export default function ProfileView({ profile }: { profile: Profile }) {
  const [showRaw, setShowRaw] = React.useState(false);

  if (!profile) return null;

  const summaryHtml = profile.summary
    ? DOMPurify.sanitize(profile.summary)
    : "";

  return (
    <div className="w-full">
      <div className="mb-3">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-lg font-semibold">{profile.name ?? "No name"}</h2>
            {profile.email && <div className="text-sm text-gray-600">{profile.email}</div>}
            {profile.linkedIn && (
              <div className="mt-1">
                <a
                  href={profile.linkedIn}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="text-sm text-blue-600 hover:underline"
                >
                  View LinkedIn profile
                </a>
              </div>
            )}
          </div>

          <div>
            <button
              onClick={() => setShowRaw((s) => !s)}
              className="px-2 py-1 text-sm bg-gray-200 rounded hover:bg-gray-300"
            >
              {showRaw ? "Pretty view" : "Show raw"}
            </button>
          </div>
        </div>
      </div>

      {!showRaw ? (
        <div className="space-y-4">
          {/* Summary */}
          <section>
            <h3 className="mb-1 text-sm font-medium">Summary</h3>
            {profile.summary ? (
              <div
                className="text-sm prose max-w-none"
                // sanitized HTML
                dangerouslySetInnerHTML={{ __html: summaryHtml }}
              />
            ) : (
              <div className="text-sm text-gray-500">No summary provided.</div>
            )}
          </section>

          {/* Skills */}
          <section>
            <h3 className="mb-1 text-sm font-medium">Skills</h3>
            {profile.skills && profile.skills.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {profile.skills.map((s, i) => (
                  <span
                    key={i}
                    className="px-2 py-1 text-xs bg-gray-100 rounded-full dark:bg-gray-700"
                  >
                    {s}
                  </span>
                ))}
              </div>
            ) : (
              <div className="text-sm text-gray-500">No skills recorded.</div>
            )}
          </section>

          {/* Experience */}
          <section>
            <h3 className="mb-1 text-sm font-medium">Experience</h3>
            {profile.experience && profile.experience.length > 0 ? (
              <ol className="space-y-3 list-none">
                {profile.experience.map((exp, idx) => (
                  <li key={idx} className="text-sm">
                    <div className="font-semibold">{exp.title} — {exp.company}</div>
                    <div className="text-xs text-gray-500">
                      {formatDate(exp.startDate)} {exp.startDate && exp.endDate ? "—" : ""} {formatDate(exp.endDate)}
                    </div>
                    {exp.description && <div className="mt-1 text-sm">{exp.description}</div>}
                  </li>
                ))}
              </ol>
            ) : (
              <div className="text-sm text-gray-500">No experience recorded.</div>
            )}
          </section>

          {/* Education */}
          <section>
            <h3 className="mb-1 text-sm font-medium">Education</h3>
            {profile.education && profile.education.length > 0 ? (
              <ul className="pl-5 text-sm list-disc">
                {profile.education.map((ed, idx) => (
                  <li key={idx}>
                    <div className="font-medium">{ed.school} {ed.degree ? `— ${ed.degree}` : ""}</div>
                    {ed.fieldOfStudy && <div className="text-xs text-gray-500">{ed.fieldOfStudy}</div>}
                    <div className="text-xs text-gray-500">
                      {formatDate(ed.startDate)} {ed.startDate && ed.endDate ? "—" : ""} {formatDate(ed.endDate)}
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="text-sm text-gray-500">No education recorded.</div>
            )}
          </section>

          {/* Preferences */}
          {profile.preferences && (
            <section>
              <h3 className="mb-1 text-sm font-medium">Preferences</h3>
              <pre className="p-2 text-xs rounded bg-gray-50">{JSON.stringify(profile.preferences, null, 2)}</pre>
            </section>
          )}
        </div>
      ) : (
        <div className="p-2 overflow-auto rounded bg-gray-50 max-h-64">
          <pre className="text-xs">{JSON.stringify(profile, null, 2)}</pre>
        </div>
      )}
    </div>
  );
}
