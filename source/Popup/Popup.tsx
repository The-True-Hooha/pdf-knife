import * as React from 'react';
import {browser, Tabs} from 'webextension-polyfill-ts';

import './styles.scss';

function openWebPage(url: string): Promise<Tabs.Tab> {
  return browser.tabs.create({url});
}

const DEFAULT_SETTINGS = {
  downloadPath: '',
  autoRename: true,
  conflictAction: 'uniquify',
  showNotifications: true,
  exclusionDomains: '',
};

const Popup: React.FC = () => {
  const [enabled, setEnabled] = React.useState(true);
  const [settings, setSettings] = React.useState(DEFAULT_SETTINGS);

  React.useEffect(() => {
    // Load enabled state and settings
    const loadState = async () => {
      try {
        const data = await browser.storage.local.get(['enabled', 'settings']);
        setEnabled(data.enabled !== false); // Default to true if not set

        if (data.settings) {
          setSettings(data.settings);
        }
      } catch (error) {
        console.error('Failed to load state:', error);
      }
    };

    loadState();
  }, []);

  const toggleEnabled = async () => {
    const newState = !enabled;
    setEnabled(newState);

    try {
      await browser.storage.local.set({enabled: newState});

      if (newState && settings.showNotifications) {
        browser.notifications.create({
          type: 'basic',
          iconUrl: browser.runtime.getURL('icon-48.png'),
          title: 'PDF Knife',
          message: 'PDF auto-download enabled',
        });
      }
    } catch (error) {
      console.error('Failed to save state:', error);
    }
  };

  return (
    <section id="popup">
      <h2>PDF Knife</h2>
      <div className="toggle-container">
        <span>Auto-download PDFs</span>
        <label className="switch">
          <input
            type="checkbox"
            checked={enabled}
            onChange={toggleEnabled}
            placeholder="checkbox"
          />
          <span className="slider round" />
        </label>
      </div>
      // Add to Popup.tsx after the toggle switch
      <button
        className="download-button"
        type="button"
        onClick={async () => {
          try {
            const [tab] = await browser.tabs.query({
              active: true,
              currentWindow: true,
            });

            if (tab.id) {
              await browser.tabs.sendMessage(tab.id, {
                action: 'manualDownload',
              });
            }
          } catch (error) {
            console.error('Failed to trigger download:', error);
          }
        }}
      >
        Download Current PDF
      </button>
      <button
        className="options-button"
        type="button"
        onClick={(): Promise<Tabs.Tab> => openWebPage('options.html')}
      >
        Settings
      </button>
      <div className="footer">
        <button
          type="button"
          className="help-button"
          onClick={(): Promise<Tabs.Tab> =>
            openWebPage('https://github.com/yourusername/pdf-knife')
          }
        >
          Help
        </button>
      </div>
    </section>
  );
};

export default Popup;
