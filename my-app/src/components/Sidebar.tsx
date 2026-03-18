import React, { useRef, useState } from 'react';
import { Plus, Trash2, Menu, Pencil } from 'lucide-react';
import { useCvLibrary } from '../contexts/CvLibraryContext';
import { Button } from './ui/button';
import { normalizeAndValidateCvDocument } from '../lib/normalize-cv';
import CvRenameDialog from './CvRenameDialog';

/**
 * Sidebar
 *
 * Lightweight sidebar showing the CV library, with compact create / rename / delete
 * actions wired into the current CvLibraryContext.
 */

export const Sidebar: React.FC = () => {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [renameTarget, setRenameTarget] = useState<{ id: string; title: string } | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const { cvs, currentCv, loadCv, createNewCv, importCv, deleteCv, renameCv } = useCvLibrary();

  const handleDrawerToggle = () => {
    setMobileOpen(!mobileOpen);
  };

  const handleLoadCv = (id: string) => {
    try {
      loadCv(id);
      setMobileOpen(false);
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error("[Sidebar] loadCv failed", e);
    }
  };

  const closeRenameDialog = () => {
    setRenameTarget(null);
  };

  const handleRenameOpen = (id: string, title: string) => {
    setError(null);
    setRenameTarget({ id, title });
  };

  const handleRenameSave = (nextTitle: string) => {
    if (!renameTarget) return;
    try {
      renameCv(renameTarget.id, nextTitle);
      closeRenameDialog();
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error("[Sidebar] renameCv failed", err);
      setError("Failed to rename CV");
    }
  };

  const drawerContent = (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-bo">
        <h2 className="text-lg font-semibold text-foreground">CV Library</h2>
        <div className="flex items-center space-x-2">
          <Button
            onClick={() => {
              try {
                // Force v1 so the sidebar's New CV path is consistent with Header/CvToolbar
                createNewCv(undefined, { forceV1: true });
              } catch (err) {
                // eslint-disable-next-line no-console
                console.error("[Sidebar] createNewCv failed", err);
              }
            }}
            variant="ghost"
            size="sm"
            title="Create New CV"
            ariaLabel="Create New CV"
          >
            <Plus size={18} />
          </Button>
        </div>
      </div>

      {/* CV List */}
      <div className="flex-1 overflow-y-auto">
        {cvs.length === 0 && (
          <div className="p-4 text-sm text-muted-foreground">
            No CVs yet. Use + to create one, then upload or edit it in the workspace.
          </div>
        )}

        <div className="p-2 space-y-1">
          {cvs.map((cv) => {
            const isActive = currentCv?.id === cv.id;
            return (
              <div
                key={cv.id}
                className={`p-3 rounded-rs cursor-pointer [transition:all_.12s_var(--ez)] ${
                  isActive
                    ? '[background:var(--sfr)] [color:var(--ti)] font-semibold border border-bo [box-shadow:var(--sha)]'
                    : '[color:var(--tm2)] hover:[background:var(--sf2)] hover:[color:var(--ti)]'
                }`}
                onClick={() => handleLoadCv(cv.id)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">{cv.title}</div>
                    <div className="text-xs text-muted-foreground">
                      Updated: {new Date(cv.metadata?.updatedAt ?? cv.metadata?.createdAt ?? Date.now()).toLocaleDateString()}
                    </div>
                  </div>

                  <div className="flex items-center gap-1 ml-2">
                    <Button
                      onClick={(e?: React.MouseEvent<HTMLButtonElement>) => {
                        e?.stopPropagation();
                        handleRenameOpen(cv.id, cv.title);
                      }}
                      variant="ghost"
                      size="sm"
                      title="Rename CV"
                      ariaLabel="Rename CV"
                    >
                      <Pencil size={14} />
                    </Button>
                    <Button
                      onClick={(e?: React.MouseEvent<HTMLButtonElement>) => {
                        e?.stopPropagation();
                        if (!window.confirm(`Delete "${cv.title}"?`)) return;
                        try {
                          deleteCv(cv.id);
                        } catch (err) {
                          // eslint-disable-next-line no-console
                          console.error("[Sidebar] deleteCv failed", err);
                          setError("Failed to delete CV");
                        }
                      }}
                      variant="ghost"
                      size="sm"
                      title="Delete CV"
                      ariaLabel="Delete CV"
                    >
                      <Trash2 size={14} />
                    </Button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
        {error ? (
          <div className="px-4 pb-3 text-ts text-ert">
            {error}
          </div>
        ) : null}
      </div>

      <CvRenameDialog
        open={renameTarget !== null}
        currentTitle={renameTarget?.title ?? ""}
        onClose={closeRenameDialog}
        onSave={handleRenameSave}
      />

      {/* Hidden file input for JSON import (legacy) */}
      <input
        ref={fileRef}
        type="file"
        accept="application/json,text/json"
        className="hidden"
        onChange={(e) => {
          void (async () => {
            setError(null);
            const file = e.target.files?.[0];
            if (!file) return;
            try {
              const text = await file.text();
              const parsed: unknown = JSON.parse(text);
              const norm = normalizeAndValidateCvDocument(parsed, file.name);
              if (!norm.success) {
                setError(norm.errors.join("; "));
                return;
              }
              await importCv(norm.document);
              setMobileOpen(false);
            } catch (err: unknown) {
              setError(err instanceof Error ? err.message : "Failed to import file");
            } finally {
              // reset input for future imports
              if (fileRef.current) fileRef.current.value = "";
            }
          })();
        }}
      />

      {/* No preview modal in the new UX — import occurs automatically once server-normalized is ready */}
    </div>
  );

  return (
    <>
      {/* Mobile toggle button */}
      <div className="fixed z-40 sm:hidden top-4 left-4">
        <Button
          onClick={handleDrawerToggle}
          variant="secondary"
          size="sm"
          ariaLabel="Toggle sidebar"
        >
          <Menu size={18} />
        </Button>
      </div>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-30 sm:hidden backdrop-blur-sm"
          style={{ background: 'hsla(30,12%,11%,.32)' }}
          onClick={() => setMobileOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Sidebar */}
      <div
        className={`
          fixed top-0 left-0 h-full w-64 [background:var(--sf1)] border-r border-bo
          transform [transition:transform_.22s_var(--ez)] z-40
          ${mobileOpen ? 'translate-x-0' : '-translate-x-full'}
          sm:translate-x-0 sm:static sm:z-auto
        `}
      >
        {drawerContent}
      </div>
    </>
  );
};
