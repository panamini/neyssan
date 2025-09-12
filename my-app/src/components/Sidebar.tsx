import React, { useRef, useState } from 'react';
import { Plus, Copy, Trash2, Edit, Menu, Upload } from 'lucide-react';
import { v4 as uuidv4 } from "uuid";
import type { CvDocument } from '../schemas/cvDocument.schema';
import { useCvLibrary } from '../contexts/CvLibraryContext';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { normalizeAndValidateCvDocument } from '../lib/normalize-cv';
import { ImportCvPreviewModal } from './ImportCvPreviewModal';
import { UploadCvButton } from './UploadCvButton';
import { ensureRemirrorDoc } from './remirror-editor/utils/conversion';

/**
 * Sidebar
 *
 * Lightweight sidebar showing the CV library. The legacy create/duplicate/rename/delete
 * flows are not yet migrated to the new CvLibraryContext; those controls are rendered
 * but disabled to avoid runtime type errors until we implement full CRUD in the new API.
 *
 * This keeps the sidebar usable for loading CVs while preventing accidental runtime errors.
 */

export const Sidebar: React.FC = () => {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [previewDoc, setPreviewDoc] = useState<CvDocument | null>(null);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const { cvs, currentCv, loadCv, createNewCv } = useCvLibrary();

  const handleDrawerToggle = () => {
    setMobileOpen(!mobileOpen);
  };

  const handleLoadCv = async (id: string) => {
    try {
      await loadCv(id);
      setMobileOpen(false);
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error("[Sidebar] loadCv failed", e);
    }
  };

  const drawerContent = (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-accent">
        <h2 className="text-lg font-semibold text-foreground">CV Library</h2>
        <div className="flex items-center space-x-2">
          <Button
            onClick={() => {
              try {
                createNewCv();
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

          {/* PDF Upload button (uses internal useCvParser) */}
          <UploadCvButton
            className=""
            onFileParsed={(suggestions, mappedSections) => {
              // Build a minimal candidate CvDocument from mappedSections for preview/validation
              try {
                const now = new Date().toISOString();
                const candidate: any = {
                  id: uuidv4(),
                  title: suggestions?.summary ? `Imported CV` : `Imported CV`,
                  metadata: { createdAt: now, updatedAt: now, version: 1 },
                  sections: mappedSections.map((s: any, si: number) => ({
                    id: s.id ?? uuidv4(),
                    title: s.title ?? `Section ${si + 1}`,
                    type: "text",
                    blocks: [
                      {
                        id: uuidv4(),
                        type: "text",
                        title: s.title ?? "Block",
                        content: ensureRemirrorDoc(s.content ?? ""),
                        plainText: String(s.content ?? "").slice(0, 200),
                        order: 0,
                      },
                    ],
                    collapsed: false,
                  })),
                  tags: [],
                  summary: suggestions?.summary ?? undefined,
                };
                const norm = normalizeAndValidateCvDocument(candidate, "uploaded.pdf");
                if (norm.success) {
                  setPreviewDoc(norm.document);
                  setIsPreviewOpen(true);
                } else {
                  setError(norm.errors.join("; "));
                }
              } catch (err: any) {
                setError(String(err ?? "Failed to prepare import preview"));
              }
            }}
          />

        </div>
      </div>

      {/* CV List */}
      <div className="flex-1 overflow-y-auto">
        {cvs.length === 0 && (
          <div className="p-4 text-sm text-muted-foreground">
            No CVs yet. Creation is coming soon.
          </div>
        )}

        <div className="p-2 space-y-1">
          {cvs.map((cv) => {
            const isActive = currentCv?.id === cv.id;
            return (
              <div
                key={cv.id}
                className={`p-3 rounded-md cursor-pointer transition-colors ${
                  isActive ? 'bg-accent text-background' : 'hover:bg-accent/10 text-foreground'
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
                        // rename not yet available in migrated context
                        // eslint-disable-next-line no-console
                        console.warn("[Sidebar] renameCv not implemented");
                      }}
                      variant="ghost"
                      size="sm"
                      title="Rename (disabled)"
                      ariaLabel="Rename CV"
                      disabled
                    >
                      <Edit size={14} />
                    </Button>

                    <Button
                      onClick={(e?: React.MouseEvent<HTMLButtonElement>) => {
                        e?.stopPropagation();
                        // duplicate not yet available in migrated context
                        // eslint-disable-next-line no-console
                        console.warn("[Sidebar] duplicateCv not implemented");
                      }}
                      variant="ghost"
                      size="sm"
                      title="Duplicate (disabled)"
                      ariaLabel="Duplicate CV"
                      disabled
                    >
                      <Copy size={14} />
                    </Button>

                    <Button
                      onClick={(e?: React.MouseEvent<HTMLButtonElement>) => {
                        e?.stopPropagation();
                        // delete not yet available in migrated context
                        // eslint-disable-next-line no-console
                        console.warn("[Sidebar] deleteCv not implemented");
                      }}
                      variant="ghost"
                      size="sm"
                      title="Delete (disabled)"
                      ariaLabel="Delete CV"
                      disabled
                    >
                      <Trash2 size={14} />
                    </Button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Hidden file input for JSON import (legacy) */}
      <input
        ref={fileRef}
        type="file"
        accept="application/json,text/json"
        className="hidden"
        onChange={async (e) => {
          setError(null);
          const file = e.target.files?.[0];
          if (!file) return;
          try {
            const text = await file.text();
            const parsed = JSON.parse(text);
            const norm = normalizeAndValidateCvDocument(parsed, file.name);
            if (!norm.success) {
              setError(norm.errors.join("; "));
              return;
            }
            setPreviewDoc(norm.document);
            setIsPreviewOpen(true);
          } catch (err: any) {
            setError(String(err ?? "Failed to import file"));
          } finally {
            // reset input for future imports
            if (fileRef.current) fileRef.current.value = "";
          }
        }}
      />

      {/* Import preview modal */}
      <ImportCvPreviewModal
        isOpen={isPreviewOpen}
        document={previewDoc ?? ({} as CvDocument)}
        onClose={() => {
          setIsPreviewOpen(false);
          setPreviewDoc(null);
        }}
        onReplace={() => {
          setIsPreviewOpen(false);
          setPreviewDoc(null);
        }}
      />
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
          className="fixed inset-0 z-30 sm:hidden bg-foreground/50 backdrop-blur-sm"
          onClick={() => setMobileOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Sidebar */}
      <div
        className={`
          fixed top-0 left-0 h-full w-64 bg-background border-r border-accent
          transform transition-transform duration-300 ease-in-out z-40
          ${mobileOpen ? 'translate-x-0' : '-translate-x-full'}
          sm:translate-x-0 sm:static sm:z-auto
        `}
      >
        {drawerContent}
      </div>
    </>
  );
};