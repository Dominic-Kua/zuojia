import React, { useState, useRef, useEffect } from 'react';
import { llmHandlers, mcpHandlers } from '../lib/ipc-client';

export function LlmChatWindow({ novelPath }) {
  const [showWindow, setShowWindow] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isLlmRunning, setIsLlmRunning] = useState(false);
  const [llmStatus, setLlmStatus] = useState('stopped');
  const [isMcpRunning, setIsMcpRunning] = useState(false);
  const [isQueryingWiki, setIsQueryingWiki] = useState(false);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    const checkLlmStatus = async () => {
      try {
        const health = await llmHandlers.health();
        setIsLlmRunning(health.status === 'running');
        setLlmStatus(health.status);
      } catch (err) {
        console.error('Failed to check LLM status:', err);
        setIsLlmRunning(false);
        setLlmStatus('error');
      }
    };

    const checkMcpStatus = async () => {
      try {
        const health = await mcpHandlers.health();
        setIsMcpRunning(health.status === 'running');
      } catch (err) {
        console.error('Failed to check MCP status:', err);
        setIsMcpRunning(false);
      }
    };

    checkLlmStatus();
    checkMcpStatus();
    const interval = setInterval(() => {
      checkLlmStatus();
      checkMcpStatus();
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const isWikiRelatedQuery = (query) => {
    // Simple heuristic for wiki-related queries
    const wikiKeywords = [
      'character', 'characters', 'world', 'setting', 'location', 'locations',
      'plot', 'story', 'novel', 'wiki', 'page', 'pages', 'who is', 'what is',
      'when is', 'where is', 'how does', 'why does', 'describe', 'explain',
      'background', 'history', 'lore', 'timeline', 'relationship', 'relationships'
    ];
    
    const lowercaseQuery = query.toLowerCase();
    return wikiKeywords.some(keyword => lowercaseQuery.includes(keyword));
  };

  const queryWikiForContext = async (query) => {
    if (!isMcpRunning) {
      return null;
    }

    try {
      setIsQueryingWiki(true);
      // Start MCP server if not running
      await mcpHandlers.startServer(novelPath);
      
      // Try Neo4j search first
      const result = await mcpHandlers.callTool(
        'wiki_neo4j_search',
        { query, limit: 5 },
        { timeoutMs: 10000, retries: 1 }
      );

      if (result.status === 'ok' && result.data && result.data.results && result.data.results.length > 0) {
        return result.data.results;
      }

      // Fallback to basic wiki search
      const fallbackResult = await mcpHandlers.callTool(
        'wiki_search',
        { query, limit: 5 },
        { timeoutMs: 10000, retries: 1 }
      );

      if (fallbackResult.status === 'ok' && fallbackResult.data && fallbackResult.data.results) {
        return fallbackResult.data.results;
      }

      return null;
    } catch (error) {
      console.error('Failed to query wiki:', error);
      return null;
    } finally {
      setIsQueryingWiki(false);
    }
  };

  const handleSendMessage = async () => {
    if (!inputText.trim() || isLoading || !isLlmRunning) return;

    const userMessage = inputText.trim();
    setInputText('');

    setMessages(prev => [...prev, {
      role: 'user',
      content: userMessage,
      timestamp: new Date().toISOString()
    }]);

    setIsLoading(true);

    setMessages(prev => [...prev, {
      role: 'assistant',
      content: '...',
      timestamp: new Date().toISOString(),
      isLoading: true
    }]);

    try {
      // Check if query is wiki-related and MCP is available
      let wikiContext = null;
      if (isWikiRelatedQuery(userMessage) && isMcpRunning) {
        wikiContext = await queryWikiForContext(userMessage);
      }

      const conversation = messages
        .filter(message => message.role === 'user' || message.role === 'assistant')
        .map(message => ({ role: message.role, content: message.content }));
      
      // Add system prompt for wiki context if available
      const systemPrompt = `You are a writing assistant for a novel. ${
        wikiContext 
          ? `Here is relevant context from the novel's wiki knowledge graph:\n${JSON.stringify(wikiContext, null, 2)}\n\nUse this context to answer the user's question about the novel's world, characters, plot, or setting. If the context doesn't contain the answer, say so and ask for clarification.`
          : 'Use the MCP tools to research wiki topics before answering questions about the novel\'s world, characters, plot, or setting.'
      }`;

      conversation.unshift({
        role: 'system',
        content: systemPrompt
      });
      
      conversation.push({ role: 'user', content: userMessage });

      const response = await llmHandlers.chat(conversation);

      setMessages(prev => {
        const newMessages = [...prev];
        const lastIdx = newMessages.length - 1;
        if (newMessages[lastIdx]?.role === 'assistant' && newMessages[lastIdx]?.isLoading) {
          newMessages[lastIdx] = {
            ...newMessages[lastIdx],
            content: response || 'No response from LLM.',
            isLoading: false
          };
        }
        return newMessages;
      });
    } catch (err) {
      console.error('Failed to send message:', err);
      setMessages(prev => {
        const newMessages = [...prev];
        const lastIdx = newMessages.length - 1;
        if (newMessages[lastIdx]?.role === 'assistant' && newMessages[lastIdx]?.isLoading) {
          newMessages[lastIdx] = {
            ...newMessages[lastIdx],
            content: `Error: ${err.message || 'Failed to get response'}`,
            isLoading: false,
            isError: true
          };
        }
        return newMessages;
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleStartLlm = async () => {
    try {
      setIsLoading(true);
      const config = await llmHandlers.getConfig();
      if (config.status === 'ok') {
        await llmHandlers.startRuntime(config.data);
        setIsLlmRunning(true);
        setLlmStatus('running');
        setMessages(prev => [...prev, {
          role: 'system',
          content: 'LLM runtime started. You can now ask questions.',
          timestamp: new Date().toISOString()
        }]);
      }
    } catch (err) {
      console.error('Failed to start LLM:', err);
      setMessages(prev => [...prev, {
        role: 'system',
        content: `Failed to start LLM: ${err.message}`,
        timestamp: new Date().toISOString(),
        isError: true
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleStopLlm = async () => {
    try {
      setIsLoading(true);
      await llmHandlers.stopRuntime();
      setIsLlmRunning(false);
      setLlmStatus('stopped');
      setMessages(prev => [...prev, {
        role: 'system',
        content: 'LLM runtime stopped.',
        timestamp: new Date().toISOString()
      }]);
    } catch (err) {
      console.error('Failed to stop LLM:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const clearMessages = () => {
    setMessages([]);
  };

  if (!novelPath) {
    return null;
  }

  return (
    <>
      <button 
        className="btn ghost" 
        data-testid="llm-chat-button"
        onClick={() => setShowWindow(true)}
        title="Open LLM Chat"
      >
        LLM Chat
      </button>

      {showWindow && (
        <div className="llm-chat-overlay" data-testid="llm-chat-overlay" onClick={() => setShowWindow(false)}>
          <div 
            className={`llm-chat-window${isCollapsed ? ' collapsed' : ''}`}
            data-testid="llm-chat-window"
            role="dialog"
            aria-modal="true"
            aria-labelledby="llm-chat-title"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="llm-chat-header">
              <h3 id="llm-chat-title">LLM Assistant</h3>
               <div className="llm-chat-header-actions">
                 <div className="llm-status-indicator" data-status={llmStatus}>
                   LLM: {llmStatus === 'running' ? 'Running' : llmStatus === 'error' ? 'Error' : 'Stopped'}
                 </div>
                 <div className="mcp-status-indicator" data-status={isMcpRunning ? 'running' : 'stopped'}>
                   Wiki: {isMcpRunning ? 'Ready' : 'Offline'}
                 </div>
                <button 
                  className="btn ghost btn-sm"
                  onClick={() => setIsCollapsed(!isCollapsed)}
                  aria-label={isCollapsed ? 'Expand chat' : 'Collapse chat'}
                >
                  {isCollapsed ? '◢' : '◥'}
                </button>
                <button 
                  className="btn ghost btn-sm"
                  onClick={() => setShowWindow(false)}
                  aria-label="Close chat"
                >
                  ×
                </button>
              </div>
            </div>

            {!isCollapsed && (
              <>
                <div className="llm-chat-messages" data-testid="llm-chat-messages">
                  {messages.length === 0 ? (
                    <div className="llm-chat-placeholder">
                      {isLlmRunning ? (
                        <p>Ask me anything about your novel...</p>
                      ) : (
                        <p>LLM runtime is stopped. Click "Start LLM" to begin.</p>
                      )}
                    </div>
                  ) : (
                    messages.map((msg, idx) => (
                      <div 
                        key={idx}
                        className={`llm-message ${msg.role}${msg.isLoading ? ' loading' : ''}${msg.isError ? ' error' : ''}`}
                        data-testid={`llm-message-${msg.role}`}
                      >
                        <div className="llm-message-role">{msg.role === 'user' ? 'You' : 'Assistant'}</div>
                        <div className="llm-message-content">
                          {msg.isLoading ? (
                            <div className="llm-thinking">Thinking...</div>
                          ) : (
                            msg.content
                          )}
                        </div>
                        {msg.timestamp && (
                          <div className="llm-message-time">
                            {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </div>
                        )}
                      </div>
                    ))
                  )}
                  <div ref={messagesEndRef} />
                </div>

                <div className="llm-chat-input-area">
                  <div className="llm-chat-controls">
                    <button
                      className="btn ghost btn-sm"
                      onClick={clearMessages}
                      disabled={messages.length === 0 || isLoading}
                      data-testid="llm-clear-messages"
                    >
                      Clear
                    </button>
                    {isLlmRunning ? (
                      <button
                        className="btn ghost btn-sm btn-danger"
                        onClick={handleStopLlm}
                        disabled={isLoading}
                        data-testid="llm-stop-button"
                      >
                        Stop LLM
                      </button>
                    ) : (
                      <button
                        className="btn ghost btn-sm"
                        onClick={handleStartLlm}
                        disabled={isLoading}
                        data-testid="llm-start-button"
                      >
                        Start LLM
                      </button>
                    )}
                  </div>
                  <div className="llm-input-wrapper">
                    <textarea
                      ref={inputRef}
                      className="llm-chat-input"
                      data-testid="llm-chat-input"
                      value={inputText}
                      onChange={(e) => setInputText(e.target.value)}
                      onKeyPress={handleKeyPress}
                      placeholder={isLlmRunning ? "Ask about your novel..." : "Start LLM first to chat..."}
                      disabled={!isLlmRunning || isLoading}
                      rows={3}
                    />
                    <button
                      className="btn primary llm-send-button"
                      data-testid="llm-send-button"
                      onClick={handleSendMessage}
                      disabled={!inputText.trim() || !isLlmRunning || isLoading}
                      aria-label="Send message"
                    >
                      Send
                    </button>
                  </div>
                   <div className="llm-input-status">
                     {isQueryingWiki ? 'Querying wiki...' : isLoading ? 'Thinking...' : isLlmRunning ? 'Ready' : 'LLM stopped'}
                   </div>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}