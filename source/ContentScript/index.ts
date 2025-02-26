import { browser, Runtime } from "webextension-polyfill-ts";
import { jsPDF } from "jspdf";

declare global {
  interface Window {
    jspdf: {
      jsPDF: typeof jsPDF;
    };
  }
}

(function () {
  let processed = false;

  async function shouldExclude() {
    const { settings } = await browser.storage.local.get("settings");
    if (!settings || !settings.exclusionDomains) return false;

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

    if (settings && settings.autoRename && document.title) {
      fileName = document.title.replace(/[/\\?%*:|"<>]/g, "-").trim();
      if (fileName.length > 100) fileName = fileName.substring(0, 100);
      if (!fileName.endsWith(".pdf")) fileName += ".pdf";
    }

    return fileName;
  }

  async function createPDF() {
    if (processed) return;

    const { enabled } = await browser.storage.local.get("enabled");
    if (enabled === false || (await shouldExclude())) return;

    processed = true;

    return new Promise((resolve, reject) => {
      const jspdf = document.createElement("script");
      jspdf.onload = async function () {
        try {
          const { jsPDF } = window.jspdf;

          let pdf = new jsPDF({
            orientation: "p",
            unit: "px",
            format: "a4",
          });

          let elements = Array.from(
            document.getElementsByTagName("img")
          ).filter((img) => /^blob:/.test(img.src));

          console.log(`PDF Knife: Found ${elements.length} blob images`);

          if (elements.length === 0) {
            console.warn("PDF Knife: No blob images found to process");
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
              console.error("Failed to get canvas context");
              continue;
            }

            await new Promise<void>((res) => {
              if (img.complete) res();
              else img.onload = () => res;
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

            processedImages++;
          }

          if (processedImages > 0) {
            
            const fileName = await generateFilename();

            pdf.save(fileName);

            browser.runtime.sendMessage({
              action: "pdfCreated",
              fileName,
            });

            console.log(
              `PDF Knife: PDF created with ${processedImages} images`
            );
            resolve(true);
          } else {
            resolve(false);
          }
        } catch (error) {
          console.error("PDF Knife: Error creating PDF:", error);
          reject(error);
        }
      };

      jspdf.onerror = reject;

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
    });
  }

  browser.storage.local.get("enabled").then(({ enabled }) => {
    if (enabled !== false) {
      if (document.readyState === "complete") {
        createPDF();
      } else {
        window.addEventListener("load", createPDF);
      }
    }
  });

  browser.runtime.onMessage.addListener(
    (message: any, _sender: Runtime.MessageSender): Promise<any> | void => {
      if (message.action === "manualDownload") {
        return createPDF();
      }
    }
  );
})();

export {};
