import {browser, Downloads} from 'webextension-polyfill-ts';

browser.runtime.onInstalled.addListener((): void => {

  browser.storage.local.get('settings').then((result) => {
    if (!result.settings) {
      browser.storage.local.set({
        settings: {
          downloadPath: '',
          autoRename: true,
          conflictAction: 'uniquify',
          showNotifications: true,
          exclusionDomains: '',
        },
        enabled: true,
      });
    }
  });

  browser.contextMenus.create({
    id: 'download-pdf',
    title: 'Download PDF with PDF Knife',
    contexts: ['link'],
    targetUrlPatterns: ['*://*/*.pdf*'],
  });
});

browser.runtime.onMessage.addListener(async (message) => {
  if (message.action === 'pdfCreated') {
    const {settings} = await browser.storage.local.get('settings');

    if (settings?.showNotifications) {
      browser.notifications.create({
        type: 'basic',
        iconUrl: browser.runtime.getURL('icon-48.png'),
        title: 'PDF Knife',
        message: `PDF downloaded: ${message.fileName}`,
      });
    }
  }
});

async function downloadPdf(url: string): Promise<void> {
  try {
    const { settings } = await browser.storage.local.get("settings");

    const filename =
      url.split("/").pop()?.split("#")[0].split("?")[0] || "download.pdf";

    const downloadOptions = {
      url,
      filename: settings?.downloadPath
        ? `${settings.downloadPath}/${filename}`
        : filename,
      conflictAction:
        (settings?.conflictAction as Downloads.FilenameConflictAction) ||
        "uniquify",
    };

    browser.downloads.download(downloadOptions);

    if (settings?.showNotifications) {
      browser.notifications.create({
        type: "basic",
        iconUrl: browser.runtime.getURL("icon-48.png"),
        title: "PDF Knife",
        message: `PDF download started: ${filename}`,
      });
    }
  } catch (error) {
    console.error("Error downloading PDF:", error);
  }
}

browser.contextMenus.onClicked.addListener((info, _tab) => {
  if (info.menuItemId === 'download-pdf' && info.linkUrl) {
    downloadPdf(info.linkUrl);
  }
});


