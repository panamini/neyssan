import React from "react";

interface ProposalDisplayProps {
  proposalContent: string | null;
  loading: boolean;
  error: string | null;
}

const parseMarkdown = (content: string) => {
  const lines = content.split("\n");
  const elements = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (line.startsWith("# ")) {
      elements.push(
        <h1 key={i} className="mb-6 text-4xl font-bold">
          {React.createElement('span', {
            dangerouslySetInnerHTML: {
              __html: line.substring(2).replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>").replace(/\*(.*?)\*/g, "<em>$1</em>")
            }
          })}
        </h1>
      );
    } else if (line.startsWith("## ")) {
      elements.push(
        <h2 key={i} className="mb-4 text-2xl font-semibold">
          {React.createElement('span', {
            dangerouslySetInnerHTML: {
              __html: line.substring(3).replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>").replace(/\*(.*?)\*/g, "<em>$1</em>")
            }
          })}
        </h2>
      );
    } else if (line.trim() === "") {
      elements.push(<div key={i} className="h-4" />);
    } else {
      elements.push(
        <p key={i} className="mb-4 text-base leading-relaxed">
          {React.createElement('span', {
            dangerouslySetInnerHTML: {
              __html: line.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>").replace(/\*(.*?)\*/g, "<em>$1</em>")
            }
          })}
        </p>
      );
    }
  }

  return <>{elements}</>;
};

const ProposalDisplay: React.FC<ProposalDisplayProps> = ({
  proposalContent,
  loading,
  error,
}) => {
  if (loading) {
    return <div className="p-6 text-center">Loading...</div>;
  }

  if (error) {
    return <div className="p-6 text-danger">Error: {error}</div>;
  }

  if (!proposalContent) {
    return <div className="p-6 text-center text-muted">Generate a proposal to see the results here.</div>;
  }

  return (
    <div className="p-6 bg-background">
      <div className="prose prose-lg prose-gray dark:prose-invert max-w-none">
        {parseMarkdown(proposalContent)}
      </div>
    </div>
  );
};

export default ProposalDisplay;
