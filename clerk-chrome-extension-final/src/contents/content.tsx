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

export function ProposalPreview() {
  const [jobData, setJobData] = useState<JobData>({
    platform: "manual",
    title: "Untitled",
    url: window.location.href,
  });
  const [proposal, setProposal] = useState<string | null>(null);
  const [token, setToken] = useState<string | null>(null);

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

  const handleGenerate = () => {
    if (!token) {
      alert("Please authenticate via the extension popup.");
      return;
    }
    chrome.runtime.sendMessage({ action: "generateProposal", jobData }, (response) => {
      if (response.success) {
        setProposal(response.proposal);
      } else {
        alert(`Failed to generate: ${response.error}`);
      }
    });
  };

  const handleSave = () => {
    if (!token || !proposal) {
      alert("Please authenticate and generate a proposal first.");
      return;
    }
    chrome.runtime.sendMessage({ action: "saveProposal", jobData, proposalText: proposal }, (response) => {
      if (response.success) {
        alert("Proposal saved successfully!");
      } else {
        alert(`Failed to save: ${response.error}`);
      }
    });
  };

  const handleExportText = () => {
    if (proposal) {
      navigator.clipboard.writeText(proposal);
      alert("Proposal copied to clipboard!");
    }
  };

  const handleExportPDF = () => {
    if (proposal) {
      const win = window.open();
      if (win) {
        win.document.write(`<html><body><pre>${proposal}</pre></body></html>`);
        win.document.close();
        win.print();
      }
    }
  };

  return (
    <div style={{ position: "fixed", bottom: "20px", right: "20px", width: "400px", padding: "20px", background: "white", border: "1px solid #ccc", borderRadius: "5px", boxShadow: "0 2px 10px rgba(0,0,0,0.2)", zIndex: "9999" }}>
      <h3>Proposal Preview</h3>
      <label>Job Title:</label>
      <input
        value={jobData.title}
        onChange={(e) => setJobData({ ...jobData, title: e.target.value })}
        style={{ width: "100%", padding: "5px", marginBottom: "10px" }}
      />
      <label>Job Description:</label>
      <textarea
        value={jobData.description || ""}
        onChange={(e) => setJobData({ ...jobData, description: e.target.value })}
        style={{ width: "100%", height: "100px", padding: "5px", marginBottom: "10px" }}
      />
      <button
        onClick={handleGenerate}
        disabled={!token}
        style={{ padding: "10px", background: token ? "#007bff" : "#ccc", color: "white", border: "none", borderRadius: "5px", marginRight: "10px" }}
      >
        Generate
      </button>
      {proposal && (
        <div style={{ marginTop: "20px" }}>
          <textarea
            value={proposal}
            onChange={(e) => setProposal(e.target.value)}
            style={{ width: "100%", height: "150px", padding: "5px", marginBottom: "10px" }}
          />
          <button onClick={handleExportText} style={{ padding: "5px 10px", background: "#28a745", color: "white", border: "none", borderRadius: "5px" }}>
            Copy Text
          </button>
          <button onClick={handleExportPDF} style={{ padding: "5px 10px", background: "#17a2b8", color: "white", border: "none", borderRadius: "5px", marginLeft: "10px" }}>
            Export PDF
          </button>
          <button
            onClick={handleSave}
            disabled={!token}
            style={{ padding: "5px 10px", background: token ? "#ffc107" : "#ccc", color: "black", border: "none", borderRadius: "5px", marginLeft: "10px" }}
          >
            Save
          </button>
        </div>
      )}
    </div>
  );
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