import * as React from "react";
import { browser } from "webextension-polyfill-ts";
import "./styles.scss";

// Default settings
const DEFAULT_SETTINGS = {
  downloadPath: "",
  autoRename: true,
  conflictAction: "uniquify",
  showNotifications: true,
  exclusionDomains: "",
};

const Options: React.FC = () => {
  const [settings, setSettings] = React.useState(DEFAULT_SETTINGS);
  const [saved, setSaved] = React.useState(false);
  const saveTimeout = React.useRef<NodeJS.Timeout | null>(null);

  // Load settings on component mount
  React.useEffect(() => {
    loadSettings();
  }, []);

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

  const handleChange = (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
    >
  ) => {
    const { name, value, type } = e.target;
    const newValue =
      type === "checkbox" ? (e.target as HTMLInputElement).checked : value;

    setSettings((prev) => ({
      ...prev,
      [name]: newValue,
    }));

    // Clear "Saved" message when user makes changes
    setSaved(false);
  };

  const saveSettings = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      await browser.storage.local.set({ settings });

      // Show saved message and clear after delay
      setSaved(true);

      if (saveTimeout.current) {
        clearTimeout(saveTimeout.current);
      }

      saveTimeout.current = setTimeout(() => {
        setSaved(false);
      }, 2000);
    } catch (error) {
      console.error("Failed to save settings:", error);
    }
  };

  return (
    <div className="options-container">
      <h1>PDF Knife Settings</h1>

      <form onSubmit={saveSettings}>
        <div className="setting-group">
          <h2>Download Options</h2>

          <div className="setting-item">
            <label htmlFor="downloadPath">Default Download Path</label>
            <input
              type="text"
              id="downloadPath"
              name="downloadPath"
              value={settings.downloadPath}
              onChange={handleChange}
              placeholder="Leave empty for browser default"
            />
            <div className="hint">
              Example: downloads/pdfs (relative to Downloads folder)
            </div>
          </div>

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
          <div className={`save-status ${saved ? "visible" : ""}`}>
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
