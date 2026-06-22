import { useState, useRef, useEffect, useCallback } from 'react';
import { useAuth } from '@clerk/clerk-react';
import * as convexReact from 'convex/react';
import { api } from '../../../../convex/_generated/api';
import { useToast } from '../../ui/toast';
import { parseRefinedMarkdown, RefinedContent } from '../../../utils/parseRefinedMarkdown';
import { IReviewerSection, INormalizedProfile } from '../../../types/profile';
import { clientFormatCompleteCV } from '../../../utils/simpleClientParse';

const CONVEX_URL = import.meta.env?.VITE_CONVEX_URL ?? "";
const CONVEX_SITE_URL = CONVEX_URL.replace('.cloud', '.site');
const DEBUG_TOASTS = import.meta.env?.DEV === true;

export function useLlmRefinement(
  rawTextLocal: string,
  handleSave: (notifyParent?: boolean) => Promise<string | null>,
  cvActions: any,
  setReviewerVisible: (visible: boolean) => void,
  setSuggestions: (suggestions: RefinedContent | null) => void,
  setSkipParsedProfileInit: (skip: boolean) => void
) {
  const [jobId, setJobId] = useState<string | null>(null);
  const [status, setStatus] = useState<'idle' | 'refining' | 'enqueued' | 'running' | 'completed' | 'failed'>('idle');
  const [isPolling, setIsPolling] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const { getToken } = useAuth();
  const { showToast } = useToast();
  const startRefineMutation = (convexReact as any).useMutation(api.llm.startRefineByString);
  const formatCompleteRef = (api as any)["actions/formatCompleteCV"]?.formatCompleteCV ?? null;
  const formatCompleteAction = (convexReact as any).useAction && formatCompleteRef
    ? (convexReact as any).useAction(formatCompleteRef)
    : undefined;
  const pendingRefines = useRef<Record<string, Promise<string> | string>>({});

  const authenticatedFetch = async (url: string, options: RequestInit = {}) => {
    if (!getToken) throw new Error('useAuth.getToken not available');
    const token = await getToken({ template: 'convex' });
    if (!token) throw new Error('Authentication token not available');
    const headers = {
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string> || {}),
      Authorization: `Bearer ${token}`,
    };
    const res = await fetch(url, { ...options, headers });
    if (!res.ok) {
      let body = null;
      try { body = await res.json(); } catch (e) {}
      throw new Error((body && (body).message) || `Request failed with status ${res.status}`);
    }
    return res.json();
  };

  const callFormatCompleteCV = useCallback(async (rawText: string) => {
    let skipHttpFallback = false;
    try {
      if (typeof formatCompleteAction === "function") {
        const actionResult = await formatCompleteAction({ rawText });
        if (actionResult) {
          const normalized = (actionResult && typeof actionResult === "object" && "status" in actionResult && (actionResult).status === "ok" && "result" in actionResult)
            ? (actionResult).result
            : actionResult;
          return normalized;
        }
      }
    } catch (e: any) {
      const msg = String(e?.message ?? e);
      if (msg.includes('Could not find public function') || msg.includes('Did you forget to run `npx convex')) {
        skipHttpFallback = true;
        if (DEBUG_TOASTS) {
          try { showToast('Convex action unavailable.', { variant: 'warning' }); } catch (er) {}
        }
      }
    }

    if (!skipHttpFallback) {
      try {
        const res = await authenticatedFetch(`${CONVEX_SITE_URL}/formatCompleteCV`, {
          method: 'POST',
          body: JSON.stringify({ rawText }),
        });
        if (res && res.status === 'ok' && res.result) {
          return res.result;
        }
      } catch (e: any) {
        const msg = String(e?.message ?? e);
        if (msg.includes('Failed to fetch') || msg.includes('403') || msg.includes('CORS') || msg.includes('preflight')) {
          if (DEBUG_TOASTS) {
            try { showToast('Backend parse blocked.', { variant: 'warning' }); } catch (er) {}
          }
        }
      }
    }

    try {
      const client = clientFormatCompleteCV(rawText);
      if (client && client.status === 'ok' && client.result) {
        return client.result;
      }
    } catch (e) {
    }
    return null;
  }, [authenticatedFetch, formatCompleteAction, showToast, CONVEX_SITE_URL]);

  useEffect(() => {
    if (!isPolling || !jobId) return;

    const pollTimeout = setTimeout(() => {
      setMessage({ type: 'error', text: 'Refinement is taking longer than expected. Please check back in a few minutes.' });
      setIsPolling(false);
      setStatus('failed');
    }, 60000);

    const pollInterval = setInterval(async () => {
      if (!isPolling) return;
      try {
        const data = await authenticatedFetch(`${CONVEX_SITE_URL}/llm-refine`, {
          method: 'POST',
          body: JSON.stringify({ jobId }),
        });
        setStatus(data.status);

        if (data.status === 'completed' || data.status === 'finished') {
          setStatus('completed');
          const normalized = data?.result?.patch?.normalized ?? data?.result?.normalized ?? null;
          if (normalized) {
            try {
              // If the normalized content is a string (markdown), parse it into the frontend shape.
              // Otherwise assume it's already in a structured RefinedContent-like shape and pass through.
              const parsedNormalized: RefinedContent | null = typeof normalized === 'string'
                ? parseRefinedMarkdown(normalized)
                : (normalized as RefinedContent);

              setSuggestions(parsedNormalized as RefinedContent | null);
              setReviewerVisible(true);
              setSkipParsedProfileInit(true);
              setMessage({ type: 'success', text: 'AI refinement ready' });
              setStatus('completed');
              setIsPolling(false);
            } catch (parseErr) {
              // Keep existing error handling but log parsing issues and continue flow.
              console.error('Failed to apply normalized refinement to reviewer UI:', parseErr);
              // Don't overwrite the existing message in case the server provided one.
              setMessage({ type: 'error', text: 'Failed to parse AI refinement result' });
              setIsPolling(false);
            }
          }
          setIsPolling(false);
        } else if (data.status === 'failed') {
          setMessage({ type: 'error', text: data.message || 'Job failed' });
          setIsPolling(false);
        }
      } catch (err) {
        console.error('Polling error:', err);
        setMessage({ type: 'error', text: String(err) });
        setIsPolling(false);
      }
    }, 2000);

    return () => {
      clearTimeout(pollTimeout);
      clearInterval(pollInterval);
    };
  }, [isPolling, jobId, authenticatedFetch, callFormatCompleteCV, cvActions, setReviewerVisible, setSuggestions, setSkipParsedProfileInit]);

  const startRefine = async (profileId: string) => {
    setMessage(null);
    setStatus('refining');

    const raw = String(rawTextLocal ?? '');
    const payload = { profileId, rawText: raw };

    // Prefer Convex public mutation: api.llm.startRefineByString
    try {
      if (typeof startRefineMutation === 'function') {
        try {
          const data = await startRefineMutation(payload);
          let jid: string | null = null;

          if (typeof data === 'string') {
            jid = data;
          } else if (data && typeof data === 'object') {
            if ('jobId' in (data as Record<string, unknown>) && (data as Record<string, unknown>)['jobId']) {
              jid = String((data as Record<string, unknown>)['jobId']);
            } else if ('_id' in (data as Record<string, unknown>) || 'id' in (data as Record<string, unknown>)) {
              const maybe = (data as Record<string, unknown>)['_id'] ?? (data as Record<string, unknown>)['id'];
              jid = maybe ? String(maybe) : null;
            }
          }

          if (jid) {
            setJobId(jid);
            setStatus('enqueued');
            try { showToast('Queued.', { variant: 'success' }); } catch { /* no-op */ }
            setIsPolling(true);
            return;
          }

          // If we reach here, mutation returned an unexpected shape
          setMessage({ type: 'error', text: 'Unexpected response from refine enqueue' });
          setStatus('failed');
          return;
        } catch (e: unknown) {
          const msg = String((e as Error)?.message ?? e);
          // Common stub client message when functions are unavailable
          if (msg.includes('Could not find public function') || msg.includes('Did you forget to run `npx convex`')) {
            if (DEBUG_TOASTS) {
              try { showToast('Convex unavailable.', { variant: 'warning' }); } catch { /* no-op */ }
            }
            setMessage({ type: 'error', text: 'Convex functions unavailable' });
            setStatus('failed');
            return;
          }
          console.error('[useLlmRefinement] startRefine mutation error:', e);
          setMessage({ type: 'error', text: 'Failed to enqueue refine job' });
          setStatus('failed');
          return;
        }
      }
    } catch (e) {
      // Defensive guard — should not normally hit
      console.error('[useLlmRefinement] startRefine unexpected error:', e);
      setMessage({ type: 'error', text: 'Failed to enqueue refine job' });
      setStatus('failed');
      return;
    }

    // Optional HTTP fallback (only if a site URL is configured)
    if (!CONVEX_SITE_URL) {
      if (DEBUG_TOASTS) {
        try { showToast('Convex URL missing.', { variant: 'warning' }); } catch { /* no-op */ }
      }
      setStatus('failed');
      return;
    }
    try {
      const data = await authenticatedFetch(`${CONVEX_SITE_URL}/llm-refine`, {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      if (data && data.status === 'enqueued' && data.jobId) {
        const jid = String(data.jobId);
        setJobId(jid);
        setStatus('enqueued');
        try { showToast('Queued.', { variant: 'success' }); } catch { /* no-op */ }
        setIsPolling(true);
        return;
      }
      setMessage({ type: 'error', text: 'Failed to enqueue job' });
      setStatus('failed');
    } catch (err) {
      console.error('[useLlmRefinement] HTTP fallback enqueue error:', err);
      setMessage({ type: 'error', text: 'Failed to enqueue refine job' });
      setStatus('failed');
    }
  };

  const handleRefineClick = async () => {
    setMessage(null);
    const profileIdToRefine = await handleSave(false);

    if (profileIdToRefine) {
      await startRefine(profileIdToRefine);
    }
  };

  return {
    status,
    message,
    jobId,
    handleRefineClick,
  };
}
