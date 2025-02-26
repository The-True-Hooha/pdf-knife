import { browser, Downloads } from "webextension-polyfill-ts";

browser.runtime.onInstalled.addListener((): void => {
  browser.storage.local.get("settings").then((result) => {
    if (!result.settings) {
      browser.storage.local.set({
        settings: {
          downloadPath: "",
          autoRename: true,
          conflictAction: "uniquify",
          showNotifications: true,
          exclusionDomains: "",
        },
        enabled: true,
      });
    }
  });

  browser.contextMenus.create({
    id: "download-pdf",
    title: "Download PDF with PDF Knife",
    contexts: ["link"],
    targetUrlPatterns: ["*://*/*.pdf*"],
  });
});

browser.runtime.onMessage.addListener(async (message) => {
  if (message.action === "downloadDirectPdf") {
    try {
      const { settings } = await browser.storage.local.get("settings");
      let url = message.url;

      if (url && url.startsWith("/")) {
        const [tab] = await browser.tabs.query({
          active: true,
          currentWindow: true,
        });

        if (tab.url) {
          const tabUrl = new URL(tab.url);
          url = `${tabUrl.origin}${url}`;
        }
      }

      if (!url) {
        return;
      }

      let filename = url.split("/").pop()?.split("?")[0] || "download.pdf";
      if (!filename.endsWith(".pdf")) filename += ".pdf";

      await browser.downloads.download({
        url: url,
        filename: settings?.downloadPath
          ? `${settings.downloadPath}/${filename}`
          : filename,
        conflictAction: settings?.conflictAction || "uniquify",
      });
    } catch (e) {
      console.error(e);
    }
  }
  if (message.action === "pdfCreated") {
    const { settings } = await browser.storage.local.get("settings");

    if (settings?.showNotifications) {
      browser.notifications.create({
        type: "basic",
        iconUrl: browser.runtime.getURL("icon-48.png"),
        title: "PDF Knife",
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
  }
}

browser.contextMenus.onClicked.addListener((info, _tab) => {
  if (info.menuItemId === "download-pdf" && info.linkUrl) {
    downloadPdf(info.linkUrl);
  }
});
