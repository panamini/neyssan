import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom/client';
import type { PlasmoContentScript } from 'plasmo';

export const config: PlasmoContentScript = {
  matches: ["https://*.upwork.com/*", "https://*.indeed.com/*", "https://*.linkedin.com/*", "https://*.fiverr.com/*"]
};

interface JobData {
  platform: string;
  title: string;
  description?: string;
  url: string;
}

function Toast({ message, onClose }: { message: string | null; onClose: () => void }) {
  useEffect(() => {
    if (!message) return;
    const t = setTimeout(onClose, 3000);
    return () => clearTimeout(t);
  }, [message, onClose]);

  if (!message) return null;
  return (
    <div style={{
      position: 'fixed',
      right: 24,
      bottom: 24,
      background: '#0f172a',
      color: 'white',
      padding: '10px 14px',
      borderRadius: 8,
      boxShadow: '0 6px 18px rgba(2,6,23,0.6)',
      zIndex: 99999
    }}>
      {message}
    </div>
  );
}

export function ProposalPreview() {
  const [jobData, setJobData] = useState<JobData>({
    platform: "manual",
    title: "Untitled",
    url: window.location.href,
  });
  const [proposal, setProposal] = useState<string | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    const platform = detectPlatform(window.location.href);
    if (platform) setJobData(scrapeJobData(platform));

    chrome.storage.local.get(['authToken'], (result) => setToken(result.authToken || null));

    const updateAuth = (changes: { [key: string]: chrome.storage.StorageChange }) => {
      if (changes.authToken) setToken(changes.authToken.newValue);
    };
    chrome.storage.onChanged.addListener(updateAuth);
    return () => chrome.storage.onChanged.removeListener(updateAuth);
  }, []);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  };

  const handleGenerate = () => {
    if (!token) {
      showToast("Please authenticate via the extension popup.");
      return;
    }
    setIsLoading(true);
    chrome.runtime.sendMessage({ action: "generateProposal", jobData }, (response) => {
      setIsLoading(false);
      if (response && response.success) {
        setProposal(response.proposal);
        showToast("Proposal generated");
      } else {
        const err = response?.error || 'Unknown error';
        showToast(`Failed to generate: ${err}`);
      }
    });
  };

  const handleSave = () => {
    if (!token || !proposal) {
      showToast("Please authenticate and generate a proposal first.");
      return;
    }
    setIsSaving(true);
    chrome.runtime.sendMessage({ action: "saveProposal", jobData, proposalText: proposal }, (response) => {
      setIsSaving(false);
      if (response && response.success) {
        showToast("Proposal saved successfully!");
      } else {
        const err = response?.error || 'Unknown error';
        showToast(`Failed to save: ${err}`);
      }
    });
  };

  const handleExportText = () => {
    if (proposal) {
      navigator.clipboard.writeText(proposal);
      showToast("Proposal copied to clipboard!");
    }
  };

  const handleExportPDF = () => {
    if (proposal) {
      const win = window.open();
      if (win) {
        win.document.write(`<html><body><pre>${escapeHtml(proposal)}</pre></body></html>`);
        win.document.close();
        win.print();
      }
    }
  };

  return (
    <>
      <div id="proposal-preview-root" style={{ position: "fixed", bottom: "20px", right: "20px", width: "420px", padding: "18px", background: "white", border: "1px solid #e5e7eb", borderRadius: "10px", boxShadow: "0 8px 30px rgba(2,6,23,0.2)", zIndex: 99999, fontFamily: "inter, ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto" }}>
        <h3 style={{ margin: 0, marginBottom: 8, fontSize: 16 }}>Proposal Preview</h3>

        <label style={{ display: "block", fontSize: 12, color: "#374151", marginBottom: 6 }}>Job Title:</label>
        <input
          value={jobData.title}
          onChange={(e) => setJobData({ ...jobData, title: e.target.value })}
          style={{ width: "100%", padding: "8px", marginBottom: "10px", borderRadius: 6, border: "1px solid #e5e7eb" }}
          name="jobTitle"
        />

        <label style={{ display: "block", fontSize: 12, color: "#374151", marginBottom: 6 }}>Job Description:</label>
        <textarea
          value={jobData.description || ""}
          onChange={(e) => setJobData({ ...jobData, description: e.target.value })}
          style={{ width: "100%", height: "100px", padding: "8px", marginBottom: "10px", borderRadius: 6, border: "1px solid #e5e7eb" }}
          name="jobDescription"
        />

        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <button
            onClick={handleGenerate}
            disabled={!token || isLoading}
            style={{
              padding: "10px 14px",
              background: token ? (isLoading ? "#60a5fa" : "#3b82f6") : "#cbd5e1",
              color: "white",
              border: "none",
              borderRadius: 8,
              cursor: token ? "pointer" : "not-allowed",
              display: "inline-flex",
              alignItems: "center",
              gap: 8
            }}
          >
            {isLoading ? <Spinner /> : "Generate"}
          </button>
        </div>

        {proposal && (
          <div style={{ marginTop: 14 }}>
            <textarea
              value={proposal}
              onChange={(e) => setProposal(e.target.value)}
              style={{ width: "100%", height: "150px", padding: "8px", borderRadius: 6, border: "1px solid #e5e7eb" }}
            />
            <div style={{ display: "flex", gap: 8, marginTop: 8, alignItems: "center" }}>
              <button
                onClick={handleSave}
                disabled={!token || isSaving}
                style={{
                  padding: "8px 12px",
                  background: isSaving ? "#f59e0b" : "#f59e0b",
                  color: "black",
                  border: "none",
                  borderRadius: 6,
                  cursor: !token ? "not-allowed" : "pointer",
                }}
              >
                {isSaving ? <Spinner small /> : "Save"}
              </button>

              <button
                onClick={handleExportText}
                disabled={!proposal}
                style={{ padding: "8px 10px", background: "#10b981", color: "white", border: "none", borderRadius: 6, cursor: proposal ? "pointer" : "not-allowed" }}
              >
                Copy
              </button>

              <button
                onClick={handleExportPDF}
                disabled={!proposal}
                style={{ padding: "8px 10px", background: "#06b6d4", color: "white", border: "none", borderRadius: 6, cursor: proposal ? "pointer" : "not-allowed" }}
              >
                PDF
              </button>

              <div style={{ marginLeft: "auto", color: "#6b7280", fontSize: 12 }}>{token ? "Signed in" : "Not signed in"}</div>
            </div>
          </div>
        )}
      </div>

      <Toast message={toast} onClose={() => setToast(null)} />
    </>
  );
}

function Spinner({ small }: { small?: boolean } = { small: false }) {
  const size = small ? 12 : 16;
  return (
    <svg width={size} height={size} viewBox="0 0 50 50" style={{ display: "inline-block" }}>
      <circle cx="25" cy="25" r="20" stroke="#e5e7eb" strokeWidth="6" fill="none" />
      <path d="M45 25a20 20 0 0 1-20 20" stroke="#111827" strokeWidth="6" strokeLinecap="round" fill="none">
        <animateTransform attributeName="transform" attributeType="XML" type="rotate" from="0 25 25" to="360 25 25" dur="0.9s" repeatCount="indefinite" />
      </path>
    </svg>
  );
}

function escapeHtml(unsafe: string) {
  return unsafe.replace(/[&<"'>]/g, function (m) {
    switch (m) {
      case '&': return '&';
      case '<': return '<';
      case '>': return '>';
      case '"': return '"';
      case "'": return '&#039;';
      default: return m;
    }
  });
}

function detectPlatform(url: string): string | null {
  if (url.includes("upwork.com")) return "upwork";
  if (url.includes("indeed.com")) return "indeed";
  if (url.includes("linkedin.com")) return "linkedin";
  if (url.includes("fiverr.com")) return "fiverr";
  return null;
}

function scrapeJobData(platform: string): JobData {
  const title = document.querySelector("h1")?.textContent?.trim() || "Untitled";
  const description = document.querySelector("p, div")?.textContent?.trim();
  return { platform, title, description, url: window.location.href };
}

function injectProposalPreview() {
  if (document.querySelector('#proposal-form-root')) return;
  const rootDiv = document.createElement("div");
  rootDiv.id = "proposal-form-root";
  document.body.appendChild(rootDiv);
  ReactDOM.createRoot(rootDiv).render(<ProposalPreview />);
}

injectProposalPreview();
export default ProposalPreview;
