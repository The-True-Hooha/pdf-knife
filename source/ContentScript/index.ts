import { browser, Runtime } from "webextension-polyfill-ts";
import { jsPDF } from "jspdf";

declare global {
  interface Window {
    jspdf: {
      jsPDF: any;
    };
  }
}

(function () {
  let processed = false;
  let debug = true;

  function log(...args: any[]) {
    if (debug) console.log("PDF Knife:", ...args);
  }

  function findPdfUrl(): string | null {
    const iframes = Array.from(document.querySelectorAll("iframe"));
    for (const f of iframes) {
      const src = f.getAttribute("src");
      if (
        (src && src.endsWith(".pdf")) ||
        src?.includes(".pdf") ||
        src?.includes("/pdf/")
      ) {
        return src;
      }
    }

    const embeds = Array.from(
      document.querySelectorAll(
        'embed[type="application/pdf"], object[type="application/pdf"]'
      )
    );
    for (const e of embeds) {
      const src = e.getAttribute("src") || e.getAttribute("data");
      if (src) return src;
    }

    const pdfLinks = Array.from(
      document.querySelectorAll(
        'a[href*=".pdf"], a[download*=".pdf"], a[href*="/download/"], a[href*="/downloads/"]'
      )
    );
    for (const e of pdfLinks) {
      const href = (e as HTMLAnchorElement).href;
      const text = e.textContent?.toLowerCase() || "";
      if (
        (text.includes("pdf") && text.includes("download")) ||
        text.includes("save")
      ) {
        return href;
      }
    }

    for (const link of pdfLinks) {
      const href = (link as HTMLAnchorElement).href;
      if (href.endsWith(".pdf") || href.includes(".pdf")) {
        return href;
      }
    }

    const scripts = Array.from(
      document.querySelectorAll(
        'script[type="application/ld+json"], script[type="application/json"]'
      )
    );

    for (const script of scripts) {
      try {
        const data = JSON.parse(script.textContent || "{}");
        if (data.contentUrl?.endsWith(".pdf")) {
          return data.contentUrl;
        }

        if (data.downloadUrl?.endsWith(".pdf")) {
          return data.downloadUrl;
        }
        const findPdfInObject = (obj: any): string | null => {
          if (!obj || typeof obj !== "object") return null;

          for (const key in obj) {
            const value = obj[key];

            if (
              typeof value === "string" &&
              (value.endsWith(".pdf") || value.includes(".pdf?")) &&
              (value.startsWith("http") || value.startsWith("/"))
            ) {
              return value;
            }

            if (typeof value === "object") {
              const result = findPdfInObject(value);
              if (result) return result;
            }
          }

          return null;
        };

        const pdfUrl = findPdfInObject(data);
        if (pdfUrl) return pdfUrl;
      } catch (err: any) {
        log(err.message);
      }
    }

    const elements = Array.from(
      document.querySelectorAll(
        "[data-pdf-url], [data-download-url], [data-src]"
      )
    );

    for (const el of elements) {
      const url =
        el.getAttribute("data-pdf-url") ||
        el.getAttribute("data-download-url") ||
        el.getAttribute("data-src");

      if (url && (url.endsWith(".pdf") || url.includes(".pdf?"))) {
        return url;
      }
    }

    if (window.location.pathname.endsWith(".pdf")) {
      return window.location.href;
    }

    return null;
  }

  async function shouldExclude() {
    const { settings } = await browser.storage.local.get("settings");
    if (!settings?.exclusionDomains) return false;

    const currentDomain = window.location.hostname;
    const exclusions = settings.exclusionDomains
      .split("\n")
      .map((d: string) => d.trim())
      .filter(Boolean);

    return exclusions.some((domain: string) => currentDomain.includes(domain));
  }

  async function generateFilename() {
    const { settings } = await browser.storage.local.get("settings");
    let fileName = "download.pdf";

    if (settings?.autoRename && document.title) {
      fileName = document.title.replace(/[/\\?%*:|"<>]/g, "-").trim();
      if (fileName.length > 100) fileName = fileName.substring(0, 100);
      if (!fileName.endsWith(".pdf")) fileName += ".pdf";
    }

    return fileName;
  }

  async function createPDF(force = false) {
    log("Creating PDF", { force, processed });
    log("Document type:", document.contentType);
    log("URL:", window.location.href);

    if (processed && !force) {
      log("Already processed, skipping");
      return false;
    }

    if (!force) {
      const { enabled } = await browser.storage.local.get("enabled");
      if (enabled === false) {
        log("Extension disabled");
        return false;
      }

      if (await shouldExclude()) {
        log("Domain excluded");
        return false;
      }
    }
    processed = true;

    const pdfUrl = findPdfUrl();
    if (pdfUrl) {
      log("Found PDF URL:", pdfUrl);
      browser.runtime.sendMessage({
        action: "downloadDirectPdf",
        url: pdfUrl,
      });
      return true;
    }

    return new Promise((resolve, reject) => {
      const jspdf = document.createElement("script");

      jspdf.onload = async function () {
        try {
          log("jsPDF loaded");
          let pdf = new jsPDF({
            orientation: "portrait",
            unit: "px",
            format: "a4",
          });

          let elements = Array.from(
            document.getElementsByTagName("img")
          ).filter((img) => /^blob:/.test(img.src));

          log(`Found ${elements.length} blob images`);

          if (elements.length === 0) {
            log("No blob images found to process");
            resolve(false);
            return;
          }

          let processedImages = 0;

          for (let i = 0; i < elements.length; i++) {
            let img = elements[i];
            if (processedImages > 0) pdf.addPage();

            let canvasElement = document.createElement("canvas");
            let ctx = canvasElement.getContext("2d", { alpha: false });

            if (!ctx) {
              log("Failed to get canvas context");
              continue;
            }

            await new Promise<void>((res) => {
              if (img.complete) res();
              else img.onload = () => res();
            });

            canvasElement.width = img.naturalWidth || img.width;
            canvasElement.height = img.naturalHeight || img.height;

            ctx.imageSmoothingEnabled = true;
            ctx.imageSmoothingQuality = "high";
            ctx.drawImage(img, 0, 0, canvasElement.width, canvasElement.height);

            let imgData = canvasElement.toDataURL("image/jpeg", 0.92);

            let pdfWidth = pdf.internal.pageSize.getWidth();
            let pdfHeight = pdf.internal.pageSize.getHeight();

            let ratio = Math.min(
              pdfWidth / canvasElement.width,
              pdfHeight / canvasElement.height
            );

            let finalWidth = canvasElement.width * ratio;
            let finalHeight = canvasElement.height * ratio;

            let x = (pdfWidth - finalWidth) / 2;
            let y = (pdfHeight - finalHeight) / 2;

            pdf.addImage(
              imgData,
              "JPEG",
              x,
              y,
              finalWidth,
              finalHeight,
              undefined,
              "FAST"
            );

            browser.runtime.sendMessage({
              action: "downloadProgress",
              progress: Math.round(((i + 1) / elements.length) * 100),
            });

            processedImages++;
          }

          if (processedImages > 0) {
            const fileName = await generateFilename();
            pdf.save(fileName);

            browser.runtime.sendMessage({
              action: "pdfCreated",
              fileName,
            });

            log(`PDF created with ${processedImages} images`);
            resolve(true);
          } else {
            resolve(false);
          }
        } catch (error: any) {

          browser.runtime.sendMessage({
            action: "pdfError",
            error: error.message,
          });

          reject(error);
        }
      };

      jspdf.onerror = (e) => {
        reject(e);
      };

      try {
        if (window.trustedTypes && window.trustedTypes.createPolicy) {
          const policy = window.trustedTypes.createPolicy("pdf-policy", {
            createScriptURL: (string) => {
              if (
                string ===
                "https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js"
              ) {
                return string;
              }
              throw new Error("Unauthorized URL");
            },
          });
          jspdf.src = policy.createScriptURL(
            "https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js"
          ) as any;
        } else {
          jspdf.src =
            "https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js";
        }
        document.body.appendChild(jspdf);
      } catch (e) {
        reject(e);
      }
    });
  }

  browser.storage.local.get("enabled").then(({ enabled }) => {
    if (enabled !== false) {
      if (document.readyState === "complete") {
        createPDF(false);
      } else {
        window.addEventListener("load", () => createPDF(false));
      }
    }
  });

  browser.runtime.onMessage.addListener(
    (message: any, _sender: Runtime.MessageSender): Promise<any> | void => {
      if (message.action === "manualDownload") {
        log("Manual download triggered");
        processed = false;
        return createPDF(true);
      }
    }
  );
})();

export {};
