import React, { useState, useEffect } from 'react';
import { gitHandlers, llmHandlers } from '../lib/ipc-client';
import {
  LLM_EXECUTABLE_PATH,
  LLM_MODEL_NAME,
  LLM_HOST,
  LLM_PORT,
  LLM_TEMPERATURE,
  LLM_MAX_TOKENS,
} from '../../electron/llm-defaults.js';

const DEFAULT_SETTINGS = {
  remoteUrl: '',
  branch: 'main',
  sshKeyPath: '~/.ssh/id_rsa',
};

const DEFAULT_LLM_SETTINGS = {
  executablePath: LLM_EXECUTABLE_PATH,
  modelName: LLM_MODEL_NAME,
  host: LLM_HOST,
  port: LLM_PORT,
  temperature: LLM_TEMPERATURE,
  maxTokens: LLM_MAX_TOKENS,
};

export function SettingsModal({ novelPath }) {
  const [showDialog, setShowDialog] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState(null);
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [llmSettings, setLlmSettings] = useState(DEFAULT_LLM_SETTINGS);
  const [llmStatus, setLlmStatus] = useState('stopped');
  const [activeTab, setActiveTab] = useState('git');

  useEffect(() => {
    const checkLlmStatus = async () => {
      try {
        const health = await llmHandlers.health();
        setLlmStatus(health.status);
      } catch (err) {
        console.error('Failed to check LLM status:', err);
        setLlmStatus('error');
      }
    };

    if (showDialog && activeTab === 'llm') {
      checkLlmStatus();
      const interval = setInterval(checkLlmStatus, 3000);
      return () => clearInterval(interval);
    }
  }, [showDialog, activeTab]);

  if (!novelPath) {
    return null;
  }

  const handleOpen = async () => {
    setShowDialog(true);
    setIsLoading(true);
    setError(null);
    try {
      const [loadedGit, loadedLlm] = await Promise.allSettled([
        gitHandlers.getConfig(novelPath),
        llmHandlers.getConfig(),
      ]);
      
      setSettings({ ...DEFAULT_SETTINGS, ...(loadedGit.status === 'fulfilled' ? loadedGit.value : {}) });
      
      if (loadedLlm.status === 'fulfilled') {
        setLlmSettings({ ...DEFAULT_LLM_SETTINGS, ...loadedLlm.value });
      }
    } catch (err) {
      setError(err.message || 'Failed to load settings');
      setSettings(DEFAULT_SETTINGS);
      setLlmSettings(DEFAULT_LLM_SETTINGS);
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    if (isSaving) {
      return;
    }
    setShowDialog(false);
    setError(null);
  };

  const handleChange = (field) => (event) => {
    setSettings((current) => ({
      ...current,
      [field]: event.target.value,
    }));
  };

  // Numeric LLM fields are kept as local strings so clearing the input works;
  // they are parsed (and validated) on save.
  const NUMERIC_LLM_FIELDS = ['port', 'temperature', 'maxTokens'];

  const handleSave = async () => {
    if (isSaving) {
      return;
    }

    setIsSaving(true);
    setError(null);

    const parsedLlmSettings = { ...llmSettings };
    for (const field of NUMERIC_LLM_FIELDS) {
      const parsed = Number(parsedLlmSettings[field]);
      if (!Number.isFinite(parsed)) {
        setError(`${field} must be a valid number`);
        setIsSaving(false);
        return;
      }
      parsedLlmSettings[field] = parsed;
    }

    try {
      // Save BOTH configs unconditionally so switching tabs never leaves one
      // side's edits silently unsaved.
      const results = await Promise.allSettled([
        gitHandlers.saveConfig(novelPath, settings),
        llmHandlers.saveConfig(parsedLlmSettings),
      ]);

      const firstRejection = results.find((result) => result.status === 'rejected');
      if (firstRejection) {
        throw firstRejection.reason;
      }

      if (results[0].status === 'fulfilled' && results[0].value) {
        setSettings({ ...DEFAULT_SETTINGS, ...results[0].value });
      }
      setShowDialog(false);
    } catch (err) {
      setError(err.message || 'Failed to save settings');
    } finally {
      setIsSaving(false);
    }
  };

  const handleStartLlm = async () => {
    try {
      setIsLoading(true);
      setError(null);
      await llmHandlers.startRuntime(llmSettings);
      setLlmStatus('running');
    } catch (err) {
      setError(`Failed to start LLM: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleStopLlm = async () => {
    try {
      setIsLoading(true);
      setError(null);
      await llmHandlers.stopRuntime();
      setLlmStatus('stopped');
    } catch (err) {
      setError(`Failed to stop LLM: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleLlmChange = (field) => (event) => {
    setLlmSettings(prev => ({
      ...prev,
      [field]: event.target.value
    }));
  };

  const handleLlmNumberChange = (field) => (event) => {
    // Store the raw string so partial/cleared input stays editable; parsing
    // and validation happen in handleSave.
    setLlmSettings(prev => ({
      ...prev,
      [field]: event.target.value
    }));
  };

  return (
    <>
      <button className="btn ghost" data-testid="settings-button" onClick={handleOpen}>
        Settings
      </button>

      {showDialog && (
        <div className="snapshot-overlay" data-testid="settings-overlay" onClick={handleClose}>
          <div
            className="snapshot-dialog settings-dialog"
            data-testid="settings-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="settings-dialog-title"
            onClick={(event) => event.stopPropagation()}
          >
            <h3 id="settings-dialog-title">Settings</h3>
            
            <div className="settings-tabs">
              <button
                className={`settings-tab ${activeTab === 'git' ? 'active' : ''}`}
                onClick={() => setActiveTab('git')}
              >
                Git Settings
              </button>
              <button
                className={`settings-tab ${activeTab === 'llm' ? 'active' : ''}`}
                onClick={() => setActiveTab('llm')}
              >
                LLM Settings
              </button>
            </div>

            {activeTab === 'git' && (
              <div className="settings-section" data-testid="git-settings-section">
                <h4>Git</h4>

              {isLoading ? (
                <div className="commit-loading" data-testid="git-settings-loading">Loading git settings...</div>
              ) : (
                <>
                  <label className="settings-field" htmlFor="git-remote-url-input">
                    <span>Remote URL</span>
                    <input
                      id="git-remote-url-input"
                      data-testid="git-remote-url-input"
                      className="snapshot-label-input"
                      type="text"
                      value={settings.remoteUrl}
                      onChange={handleChange('remoteUrl')}
                      placeholder="git@github.com:user/novel.git"
                    />
                  </label>

                  <label className="settings-field" htmlFor="git-branch-input">
                    <span>Branch</span>
                    <input
                      id="git-branch-input"
                      data-testid="git-branch-input"
                      className="snapshot-label-input"
                      type="text"
                      value={settings.branch}
                      onChange={handleChange('branch')}
                    />
                  </label>

                  <label className="settings-field" htmlFor="git-ssh-key-input">
                    <span>SSH key path</span>
                    <input
                      id="git-ssh-key-input"
                      data-testid="git-ssh-key-input"
                      className="snapshot-label-input"
                      type="text"
                      value={settings.sshKeyPath}
                      onChange={handleChange('sshKeyPath')}
                    />
                  </label>
                </>
              )}

              {error && (
                <div className="snapshot-error" data-testid="git-settings-error">{error}</div>
              )}
            </div>
            )}

             {activeTab === 'llm' && (
               <div className="settings-section" data-testid="llm-settings-section">
                 <h4>LLM Configuration</h4>

                 <div className="llm-runtime-controls">
                   <div className="llm-status-indicator" data-status={llmStatus}>
                     Status: {llmStatus === 'running' ? 'Running' : llmStatus === 'error' ? 'Error' : 'Stopped'}
                   </div>
                   <div className="llm-runtime-buttons">
                     {llmStatus === 'running' ? (
                       <button
                         className="btn ghost btn-sm btn-danger"
                         onClick={handleStopLlm}
                         disabled={isLoading}
                         data-testid="llm-settings-stop"
                       >
                         Stop LLM
                       </button>
                     ) : (
                       <button
                         className="btn ghost btn-sm"
                         onClick={handleStartLlm}
                         disabled={isLoading}
                         data-testid="llm-settings-start"
                       >
                         Start LLM
                       </button>
                     )}
                   </div>
                 </div>

                 {isLoading ? (
                   <div className="commit-loading" data-testid="llm-settings-loading">Loading LLM settings...</div>
                 ) : (
                   <>
                     <label className="settings-field" htmlFor="llm-executable-path-input">
                       <span>Executable Path</span>
                       <input
                         id="llm-executable-path-input"
                         data-testid="llm-executable-path-input"
                         className="snapshot-label-input"
                         type="text"
                         value={llmSettings.executablePath}
                         onChange={handleLlmChange('executablePath')}
                          placeholder={LLM_EXECUTABLE_PATH}
                       />
                     </label>

                     <label className="settings-field" htmlFor="llm-model-input">
                       <span>Model Name</span>
                       <input
                         id="llm-model-input"
                         data-testid="llm-model-input"
                         className="snapshot-label-input"
                         type="text"
                         value={llmSettings.modelName}
                         onChange={handleLlmChange('modelName')}
                          placeholder={LLM_MODEL_NAME}
                       />
                     </label>

                     <label className="settings-field" htmlFor="llm-host-input">
                       <span>Host</span>
                       <input
                         id="llm-host-input"
                         data-testid="llm-host-input"
                         className="snapshot-label-input"
                         type="text"
                         value={llmSettings.host}
                         onChange={handleLlmChange('host')}
                         placeholder="127.0.0.1"
                       />
                     </label>

                     <label className="settings-field" htmlFor="llm-port-input">
                       <span>Port</span>
                       <input
                         id="llm-port-input"
                         data-testid="llm-port-input"
                         className="snapshot-label-input"
                         type="number"
                         value={llmSettings.port}
                         onChange={handleLlmNumberChange('port')}
                          placeholder={LLM_PORT}
                       />
                     </label>

                     <label className="settings-field" htmlFor="llm-temperature-input">
                       <span>Temperature (0.0 - 2.0)</span>
                       <input
                         id="llm-temperature-input"
                         data-testid="llm-temperature-input"
                         className="snapshot-label-input"
                         type="number"
                         step="0.1"
                         min="0"
                         max="2"
                         value={llmSettings.temperature}
                         onChange={handleLlmNumberChange('temperature')}
                         placeholder="0.7"
                       />
                     </label>

                     <label className="settings-field" htmlFor="llm-max-tokens-input">
                       <span>Max Tokens</span>
                       <input
                         id="llm-max-tokens-input"
                         data-testid="llm-max-tokens-input"
                         className="snapshot-label-input"
                         type="number"
                         value={llmSettings.maxTokens}
                         onChange={handleLlmNumberChange('maxTokens')}
                         placeholder="4096"
                       />
                     </label>
                   </>
                 )}

                 {error && (
                   <div className="snapshot-error" data-testid="llm-settings-error">{error}</div>
                 )}
               </div>
             )}

            <div className="snapshot-dialog-actions">
              <button className="btn ghost" data-testid="settings-cancel" onClick={handleClose} disabled={isSaving}>
                Cancel
              </button>
              <button
                className="btn primary"
                data-testid="settings-save"
                onClick={handleSave}
                disabled={isLoading || isSaving}
              >
                {isSaving ? 'Saving...' : 'Save Settings'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}