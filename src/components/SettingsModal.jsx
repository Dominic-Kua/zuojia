import React, { useState } from 'react';
import { gitHandlers, llmHandlers } from '../lib/ipc-client';

const DEFAULT_SETTINGS = {
  remoteUrl: '',
  branch: 'main',
  sshKeyPath: '~/.ssh/id_rsa',
};

const DEFAULT_LLM_SETTINGS = {
  executablePath: '/opt/homebrew/bin/ollama',
  modelName: 'codellama:7b',
  host: '127.0.0.1',
  port: 11434,
  temperature: 0.7,
  maxTokens: 4096,
};

export function SettingsModal({ novelPath }) {
  const [showDialog, setShowDialog] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState(null);
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [llmSettings, setLlmSettings] = useState(DEFAULT_LLM_SETTINGS);
  const [activeTab, setActiveTab] = useState('git');

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

  const handleSave = async () => {
    if (isSaving) {
      return;
    }

    setIsSaving(true);
    setError(null);
    try {
      if (activeTab === 'git') {
        const saved = await gitHandlers.saveConfig(novelPath, settings);
        setSettings({ ...DEFAULT_SETTINGS, ...saved });
      } else if (activeTab === 'llm') {
        await llmHandlers.saveConfig(llmSettings);
      }
      setShowDialog(false);
    } catch (err) {
      setError(err.message || `Failed to save ${activeTab} settings`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleLlmChange = (field) => (event) => {
    setLlmSettings(prev => ({
      ...prev,
      [field]: typeof event === 'function' ? event(prev[field]) : event.target.value
    }));
  };

  const handleLlmNumberChange = (field) => (event) => {
    const value = parseFloat(event.target.value);
    if (!isNaN(value)) {
      setLlmSettings(prev => ({
        ...prev,
        [field]: value
      }));
    }
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
                        placeholder="/opt/homebrew/bin/ollama"
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
                        placeholder="codellama:7b"
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
                        placeholder="11434"
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