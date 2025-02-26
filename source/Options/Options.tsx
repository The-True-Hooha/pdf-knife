import * as React from 'react';
import {browser} from 'webextension-polyfill-ts';
import './styles.scss';

const DEFAULT_SETTINGS = {
  downloadPath: '',
  autoRename: true,
  conflictAction: 'uniquify',
  showNotifications: true,
  exclusionDomains: '',
};

const Options: React.FC = () => {
  const [settings, setSettings] = React.useState(DEFAULT_SETTINGS);
  const [saved, setSaved] = React.useState(false);
  const saveTimeout = React.useRef<NodeJS.Timeout | null>(null);


  const loadSettings = async () => {
    try {
      const result = await browser.storage.local.get("settings");
      if (result.settings) {
        setSettings(result.settings);
      }
    } catch (error) {
      console.error("Failed to load settings:", error);
    }
  };

  
  React.useEffect(() => {
    loadSettings();
  }, []);

  

  const handleChange = (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
    >
  ) => {
    const {name, value, type} = e.target;
    const newValue =
      type === 'checkbox' ? (e.target as HTMLInputElement).checked : value;

    setSettings((prev) => ({
      ...prev,
      [name]: newValue,
    }));

    setSaved(false);
  };

  const saveSettings = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      await browser.storage.local.set({settings});
      setSaved(true);

      if (saveTimeout.current) {
        clearTimeout(saveTimeout.current);
      }

      saveTimeout.current = setTimeout(() => {
        setSaved(false);
      }, 2000);
    } catch (error) {
      console.error('Failed to save settings:', error);
    }
  };

  return (
    <div className="options-container">
      <h1>PDF Knife Settings</h1>

      <form onSubmit={saveSettings}>
        <div className="setting-group">
          <h2>Download Location</h2>

          <div className="default-path-notice">
            <div className="info-icon">ℹ️</div>
            <div>
              PDFs will be saved to your browser's default download folder if no
              path is specified.
            </div>
          </div>

          <div className="setting-item">
            <label htmlFor="downloadPath">Custom Download Path</label>
            <div className="path-input-container">
              <input
                type="text"
                id="downloadPath"
                name="downloadPath"
                value={settings.downloadPath}
                onChange={handleChange}
                placeholder="e.g., PDFs or Research/Papers"
              />
            </div>
            <div className="hint">
              <ul>
                <li>Path is relative to your browser's download folder</li>
                <li>
                  No leading slashes needed (e.g., "PDFs/Work" not "/PDFs/Work")
                </li>
                <li>
                  New folders will be created automatically if they don't exist
                </li>
              </ul>
            </div>
          </div>

          <div className="path-examples">
            <span className="path-examples-label">Examples:</span>
            <button
              type="button"
              className="path-example-button"
              onClick={() => setSettings({...settings, downloadPath: 'PDFs'})}
            >
              PDFs
            </button>
            <button
              type="button"
              className="path-example-button"
              onClick={() =>
                setSettings({...settings, downloadPath: 'Documents/Research'})
              }
            >
              Documents/Research
            </button>
            <button
              type="button"
              className="path-example-button"
              onClick={() => setSettings({...settings, downloadPath: ''})}
            >
              Default
            </button>
          </div>
        </div>

        <div className="setting-group">
          <h2>Download Options</h2>

          <div className="setting-item checkbox">
            <label>
              <input
                type="checkbox"
                name="autoRename"
                checked={settings.autoRename}
                onChange={handleChange}
              />
              Auto-rename files using document title
            </label>
          </div>

          <div className="setting-item">
            <label htmlFor="conflictAction">When files already exist:</label>
            <select
              id="conflictAction"
              name="conflictAction"
              value={settings.conflictAction}
              onChange={handleChange}
            >
              <option value="uniquify">Create unique name</option>
              <option value="overwrite">Overwrite</option>
              <option value="prompt">Ask me</option>
            </select>
          </div>
        </div>

        <div className="setting-group">
          <h2>Notifications</h2>
          <div className="setting-item checkbox">
            <label>
              <input
                type="checkbox"
                name="showNotifications"
                checked={settings.showNotifications}
                onChange={handleChange}
              />
              Show download notifications
            </label>
          </div>
        </div>

        <div className="setting-group">
          <h2>Exclusions</h2>
          <div className="hint">Enter domains to ignore (one per line)</div>
          <textarea
            name="exclusionDomains"
            value={settings.exclusionDomains}
            onChange={handleChange}
            rows={5}
            placeholder="example.com&#10;docs.google.com"
          />
        </div>

        <div className="actions">
          <div className={`save-status ${saved ? 'visible' : ''}`}>
            Settings saved!
          </div>
          <button type="submit" className="save-button">
            Save
          </button>
        </div>
      </form>
    </div>
  );
};

export default Options;
