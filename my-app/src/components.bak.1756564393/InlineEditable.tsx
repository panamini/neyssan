import React, { useRef, useEffect } from "react";
import DOMPurify from "dompurify";

type Props = {
  value: string; // HTML string
  onChange: (sanitizedHtml: string) => void;
  disabled?: boolean;
  className?: string;
  placeholder?: string;
};

export default function InlineEditable({ value, onChange, disabled, className, placeholder }: Props) {
  const ref = useRef<HTMLDivElement | null>(null);
  const composingRef = useRef(false);

  useEffect(() => {
    if (ref.current && ref.current.innerHTML !== value) {
      ref.current.innerHTML = value || (placeholder ? `<i>${placeholder}</i>` : "");
    }
  }, [value, placeholder]);

  function handleInput() {
    if (!ref.current || composingRef.current) return;
    const raw = ref.current.innerHTML;
    const sanitized = DOMPurify.sanitize(raw, {
      ALLOWED_TAGS: ['b','i','strong','em','p','br','ul','ol','li','pre','code','a'],
      ALLOWED_ATTR: ['href','target','rel']
    });
    onChange(sanitized);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
      (e.target as HTMLElement).blur();
    }
  }

  return (
    <div
      ref={ref}
      contentEditable={!disabled}
      suppressContentEditableWarning
      onInput={handleInput}
      onCompositionStart={() => (composingRef.current = true)}
      onCompositionEnd={() => { composingRef.current = false; handleInput(); }}
      onKeyDown={handleKeyDown}
      className={className}
      style={{ outline: disabled ? "none" : undefined, whiteSpace: "pre-wrap" }}
      role="textbox"
      aria-multiline="true"
    />
  );
}
