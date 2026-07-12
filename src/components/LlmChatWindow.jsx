import React, { useState, useRef, useEffect } from 'react';
import { llmHandlers } from '../lib/ipc-client';

export function LlmChatWindow({ novelPath }) {
  const [showWindow, setShowWindow] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isLlmRunning, setIsLlmRunning] = useState(false);
  const [llmStatus, setLlmStatus] = useState('stopped');
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

    checkLlmStatus();
    const interval = setInterval(checkLlmStatus, 5000);
    return () => clearInterval(interval);
  }, []);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

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
      const conversation = messages
        .filter(message => message.role === 'user' || message.role === 'assistant')
        .map(message => ({ role: message.role, content: message.content }));
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
                  {llmStatus === 'running' ? 'Running' : llmStatus === 'error' ? 'Error' : 'Stopped'}
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
                    {isLoading ? 'Thinking...' : isLlmRunning ? 'Ready' : 'LLM stopped'}
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