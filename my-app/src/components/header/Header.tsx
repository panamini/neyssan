
import React from "react";
import DarkModeToggle from "../dark-mode-toggle/DarkModeToggle";
import { Button } from "../ui/button";
import { Plus } from "lucide-react";
import { useCvLibrary } from "../../contexts/CvLibraryContext";
import { isV1SectionsEnabled } from "../../lib/flags";

const Header: React.FC = () => {
  const { createNewCv } = useCvLibrary();
  const v1 = isV1SectionsEnabled();

  // Navigate SPA-style to a path by pushing history and emitting popstate
  const navigate = (e: React.MouseEvent, path: string) => {
    e.preventDefault();
    if (window.location.pathname !== path) {
      window.history.pushState({}, "", path);
      window.dispatchEvent(new PopStateEvent("popstate"));
    }
  };

  return (
    <header className="p-4 [background:var(--sfr)] [color:var(--ti)] border-b border-bo" style={{ height: 'var(--hdr)', display: 'flex', alignItems: 'center' }}>
      <nav className="flex items-center justify-between max-w-6xl mx-auto">
        <div className="flex items-center space-x-3">
          <a href="/" className="text-lg font-semibold" onClick={(e) => navigate(e, "/")}>
            Neyssan
          </a>
          <div className="ml-2">
            <DarkModeToggle />
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            onClick={() => {
              try {
                createNewCv(undefined, { forceV1: true });
              } catch {
                /* noop */
              }
            }}
            size="sm"
            className="inline-flex items-center gap-2"
            ariaLabel={v1 ? "Create new CV (v1 sections)" : "Create new CV"}
            title={v1 ? "Create new CV (v1 sections)" : "Create new CV"}
          >
            <Plus className="w-4 h-4" />
            <span className="hidden sm:inline">{v1 ? "New CV (v1)" : "New CV"}</span>
            <span className="sm:hidden">New</span>
          </Button>
        </div>
      </nav>
    </header>
  );
};

export default Header;
