// contents/content.tsx
import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom/client';
import type { PlasmoContentScript } from 'plasmo';

export const config: PlasmoContentScript = {
  matches: [
    "https://*.upwork.com/*",
    "https://*.indeed.com/*",
    "https://*.linkedin.com/*",
    "https://*.fiverr.com/*"
  ]
};

interface JobData {
  platform: string;
  title: string;
  description?: string;
  url: string;
}

const ProposalPreview: React.FC = () => {
  const [jobData, setJobData] = useState<JobData>({
    platform: "manual",
    title: "Untitled",
    description: "",
    url: window.location.href,
  });
  const [proposal, setProposal] = useState<string | null>(null);
  const [name, setName] = useState<string>("Your Name");

  useEffect(() => {
    const platform = detectPlatform(window.location.href);
    if (platform) {
      const scrapedData = scrapeJobData(platform);
      setJobData(scrapedData);
      console.log("Scraped data set:", scrapedData);
    }
  }, []);

  const handleGenerate = () => {
    chrome.runtime.sendMessage({
      action: "generateProposal",
      jobData,
      platform: jobData.platform,
    }, (response: { proposal?: string }) => {
      console.log("Response received:", response);
      if (response && response.proposal) {
        setProposal(response.proposal);
      } else {
        alert("Failed to generate proposal");
        console.error("Proposal generation failed:", response);
      }
    });
  };

  const handleSave = () => {
    if (proposal) {
      chrome.runtime.sendMessage({
        action: "saveProposal",
        proposalText: proposal,
        jobData,
      }, (response: { success?: boolean }) => {
        console.log("Save response:", response);
        if (response && response.success) {
          alert("Proposal saved to my-app!");
        } else {
          alert("Failed to save proposal");
        }
      });
    }
  };

  const handleExportText = () => {
    if (proposal) {
      navigator.clipboard.writeText(proposal);
      console.log("Proposal exported as text");
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
        console.log("Proposal exported as PDF");
      }
    }
  };

  return (
    <div style={{
      position: "fixed",
      bottom: "20px",
      right: "20px",
      width: "400px",
      padding: "20px",
      background: "white",
      border: "1px solid #ccc",
      borderRadius: "5px",
      boxShadow: "0 2px 10px rgba(0,0,0,0.2)",
      zIndex: "9999"
    }}>
      <h3 style={{ marginTop: 0 }}>Proposal Preview</h3>
      <div style={{ marginBottom: "10px" }}>
        <label style={{ display: "block", marginBottom: "5px" }}>Job Title:</label>
        <input
          type="text"
          value={jobData.title}
          onChange={(e) => setJobData({ ...jobData, title: e.target.value })}
          style={{ width: "100%", padding: "5px", borderRadius: "3px", border: "1px solid #ccc" }}
        />
      </div>
      <div style={{ marginBottom: "10px" }}>
        <label style={{ display: "block", marginBottom: "5px" }}>Job Description:</label>
        <textarea
          value={jobData.description ?? ""}
          onChange={(e) => setJobData({ ...jobData, description: e.target.value })}
          style={{ width: "100%", height: "100px", padding: "5px", borderRadius: "3px", border: "1px solid #ccc" }}
        />
      </div>
      <div style={{ marginBottom: "10px" }}>
        <label style={{ display: "block", marginBottom: "5px" }}>Your Name:</label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          style={{ width: "100%", padding: "5px", borderRadius: "3px", border: "1px solid #ccc" }}
        />
      </div>
      <button
        onClick={handleGenerate}
        style={{ padding: "10px 20px", background: "#007bff", color: "white", border: "none", borderRadius: "5px", cursor: "pointer" }}
      >
        Generate
      </button>
      {proposal && (
        <div style={{ marginTop: "20px" }}>
          <label style={{ display: "block", marginBottom: "5px" }}>Proposal Preview:</label>
          <textarea
            value={proposal}
            onChange={(e) => setProposal(e.target.value)}
            style={{ width: "100%", height: "150px", padding: "5px", borderRadius: "3px", border: "1px solid #ccc" }}
          />
          <div style={{ marginTop: "10px" }}>
            <button
              onClick={handleExportText}
              style={{ padding: "5px 10px", background: "#28a745", color: "white", border: "none", borderRadius: "5px" }}
            >
              Copy Text
            </button>
            <button
              onClick={handleExportPDF}
              style={{ padding: "5px 10px", background: "#17a2b8", color: "white", border: "none", borderRadius: "5px", marginLeft: "10px" }}
            >
              Export PDF
            </button>
            <button
              onClick={handleSave}
              style={{ padding: "5px 10px", background: "#ffc107", color: "black", border: "none", borderRadius: "5px", marginLeft: "10px" }}
            >
              Save to my-app
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

function detectPlatform(url: string): string | null {
  if (url.includes("upwork.com")) return "upwork";
  if (url.includes("indeed.com")) return "indeed";
  if (url.includes("linkedin.com")) return "linkedin";
  if (url.includes("fiverr.com")) return "fiverr";
  return null;
}

function scrapeJobData(platform: string): JobData {
  const title = document.querySelector("h1")?.textContent?.trim() ?? "Unknown Title";
  const description = document.querySelector("p, div")?.textContent?.trim() ?? "No description";
  return { platform, title, description, url: window.location.href };
}

function injectProposalPreview() {
  const existingRoot = document.querySelector('#proposal-form-root');
  if (existingRoot) return;

  const rootDiv = document.createElement("div");
  rootDiv.id = "proposal-form-root";
  document.body.appendChild(rootDiv);

  console.log("Preview root injected");
  ReactDOM.createRoot(rootDiv).render(<ProposalPreview />);
}

injectProposalPreview();