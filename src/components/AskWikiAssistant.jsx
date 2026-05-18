import React, { useRef, useState } from 'react';
import { mcpHandlers } from '../lib/ipc-client';

function extractSearchResults(result) {
  if (!result) return [];
  if (Array.isArray(result.results)) return result.results;
  if (Array.isArray(result.data?.results)) return result.data.results;
  return [];
}

async function streamAnswer(text, onChunk, isCancelled) {
  const chunks = String(text || '').match(/.{1,18}/g) || [];
  for (const chunk of chunks) {
    if (isCancelled()) {
      return;
    }
    onChunk(chunk);
    await new Promise((resolve) => setTimeout(resolve, 8));
  }
}

export function AskWikiAssistant({ novelPath }) {
  const [showDialog, setShowDialog] = useState(false);
  const [query, setQuery] = useState('');
  const [answer, setAnswer] = useState('');
  const [citations, setCitations] = useState([]);
  const [error, setError] = useState(null);
  const [isAsking, setIsAsking] = useState(false);
  const [statusText, setStatusText] = useState('Idle');
  const requestSeqRef = useRef(0);
  const activeRequestIdRef = useRef(0);
  const cancelledRequestsRef = useRef(new Set());

  if (!novelPath) {
    return null;
  }

  const closeDialog = () => {
    if (isAsking) {
      cancelledRequestsRef.current.add(activeRequestIdRef.current);
    }
    setShowDialog(false);
    setError(null);
  };

  const handleCancel = () => {
    cancelledRequestsRef.current.add(activeRequestIdRef.current);
    setIsAsking(false);
    setStatusText('Cancelled');
  };

  const handleAsk = async () => {
    const trimmed = query.trim();
    if (!trimmed || isAsking) {
      return;
    }

    const requestId = ++requestSeqRef.current;
    activeRequestIdRef.current = requestId;
    cancelledRequestsRef.current.delete(requestId);
    const isStaleOrCancelled = () =>
      activeRequestIdRef.current !== requestId || cancelledRequestsRef.current.has(requestId);
    const setCancelledStatusIfActive = () => {
      if (activeRequestIdRef.current === requestId) {
        setStatusText('Cancelled');
      }
    };

    setIsAsking(true);
    setAnswer('');
    setCitations([]);
    setError(null);
    setStatusText('Searching wiki...');

    try {
      await mcpHandlers.startServer(novelPath);

      const searchResult = await mcpHandlers.callTool(
        'wiki_search',
        { query: trimmed, limit: 5 },
        { timeoutMs: 5000, retries: 1 }
      );

      if (isStaleOrCancelled()) {
        setCancelledStatusIfActive();
        return;
      }

      const results = extractSearchResults(searchResult);
      setCitations(results.map((item) => ({ slug: item.slug, title: item.title })));

      let fullAnswer;
      if (results.length === 0) {
        fullAnswer = 'I could not find relevant wiki context for that question yet.';
      } else {
        const bullets = results
          .map((item) => `- ${item.title || item.slug}: ${(item.snippet || '').trim()}`)
          .join('\n');
        fullAnswer = `Based on current wiki context:\n${bullets}`;
      }

      setStatusText('Streaming answer...');
      await streamAnswer(
        fullAnswer,
        (chunk) => {
          if (isStaleOrCancelled()) {
            return;
          }
          setAnswer((current) => `${current}${chunk}`);
        },
        isStaleOrCancelled
      );

      if (isStaleOrCancelled()) {
        setCancelledStatusIfActive();
      } else {
        setStatusText('Done');
      }
    } catch (err) {
      if (isStaleOrCancelled()) {
        return;
      }
      setError(err.message || 'Failed to ask wiki assistant');
      setStatusText('Error');
    } finally {
      if (activeRequestIdRef.current === requestId) {
        setIsAsking(false);
      }
      cancelledRequestsRef.current.delete(requestId);
    }
  };

  return (
    <>
      <button className="btn ghost" data-testid="ask-wiki-button" onClick={() => setShowDialog(true)}>
        Ask Wiki
      </button>

      {showDialog && (
        <div className="snapshot-overlay" data-testid="ask-wiki-overlay" onClick={closeDialog}>
          <div
            className="snapshot-dialog settings-dialog"
            data-testid="ask-wiki-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="ask-wiki-title"
            onClick={(event) => event.stopPropagation()}
          >
            <h3 id="ask-wiki-title">Ask Wiki Assistant</h3>
            <label className="settings-field" htmlFor="ask-wiki-input">
              <span>Question</span>
              <input
                id="ask-wiki-input"
                data-testid="ask-wiki-input"
                className="snapshot-label-input"
                type="text"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Ask about your worldbuilding..."
              />
            </label>

            <div className="snapshot-dialog-actions">
              <button className="btn ghost" data-testid="ask-wiki-cancel-dialog" onClick={closeDialog}>
                Close
              </button>
              {isAsking ? (
                <button className="btn ghost" data-testid="ask-wiki-cancel" onClick={handleCancel}>
                  Cancel
                </button>
              ) : (
                <button className="btn primary" data-testid="ask-wiki-submit" onClick={handleAsk} disabled={!query.trim()}>
                  Ask
                </button>
              )}
            </div>

            <div className="push-guidance" data-testid="ask-wiki-status">
              Status: {statusText}
            </div>

            {error && (
              <div className="snapshot-error" data-testid="ask-wiki-error">
                {error}
              </div>
            )}

            {answer && (
              <div className="export-log-entry" data-testid="ask-wiki-answer">
                {answer}
              </div>
            )}

            {citations.length > 0 && (
              <ul data-testid="ask-wiki-citations">
                {citations.map((citation) => (
                  <li key={`${citation.slug}-${citation.title}`}>{citation.title} ({citation.slug})</li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </>
  );
}
