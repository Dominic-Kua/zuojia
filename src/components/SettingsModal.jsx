import React, { useState } from 'react';
import { gitHandlers } from '../lib/ipc-client';

const DEFAULT_SETTINGS = {
  remoteUrl: '',
  branch: 'main',
  sshKeyPath: '~/.ssh/id_rsa',
};

export function SettingsModal({ novelPath }) {
  const [showDialog, setShowDialog] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState(null);
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);

  if (!novelPath) {
    return null;
  }

  const handleOpen = async () => {
    setShowDialog(true);
    setIsLoading(true);
    setError(null);
    try {
      const loaded = await gitHandlers.getConfig(novelPath);
      setSettings({ ...DEFAULT_SETTINGS, ...loaded });
    } catch (err) {
      setError(err.message || 'Failed to load git settings');
      setSettings(DEFAULT_SETTINGS);
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
      const saved = await gitHandlers.saveConfig(novelPath, settings);
      setSettings({ ...DEFAULT_SETTINGS, ...saved });
      setShowDialog(false);
    } catch (err) {
      setError(err.message || 'Failed to save git settings');
    } finally {
      setIsSaving(false);
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

            <div className="snapshot-dialog-actions">
              <button className="btn ghost" data-testid="git-settings-cancel" onClick={handleClose} disabled={isSaving}>
                Cancel
              </button>
              <button
                className="btn primary"
                data-testid="git-settings-save"
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