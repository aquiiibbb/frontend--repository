// Export Utilities for Excel, PDF, and Word documents

export function exportToExcel(filename, title, headers, data) {
  let tableHtml = `
    <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
    <head>
      <meta charset="utf-8" />
      <!--[if gte mso 9]><xml><x:ExcelWorkbook><x:ExcelWorksheets><x:ExcelWorksheet><x:Name>Hotel PMS Report</x:Name><x:WorksheetOptions><x:DisplayGridlines/></x:WorksheetOptions></x:ExcelWorksheet></x:ExcelWorksheets></x:ExcelWorkbook></xml><![endif]-->
      <style>
        table { border-collapse: collapse; width: 100%; font-family: Arial, sans-serif; }
        th { background-color: #1e293b; color: #ffffff; font-weight: bold; padding: 10px; border: 1px solid #cbd5e1; text-align: left; }
        td { padding: 8px; border: 1px solid #e2e8f0; font-size: 13px; }
        .title { font-size: 18px; font-weight: bold; margin-bottom: 15px; color: #0f172a; }
      </style>
    </head>
    <body>
      <div class="title">${title} - ${new Date().toLocaleDateString()}</div>
      <table>
        <thead>
          <tr>
            ${headers.map((h) => `<th>${h}</th>`).join("")}
          </tr>
        </thead>
        <tbody>
          ${data
            .map(
              (row) => `
            <tr>
              ${row.map((cell) => `<td>${cell != null ? String(cell) : ""}</td>`).join("")}
            </tr>
          `
            )
            .join("")}
        </tbody>
      </table>
    </body>
    </html>
  `;

  const blob = new Blob([tableHtml], { type: "application/vnd.ms-excel;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${filename}_${new Date().toISOString().slice(0, 10)}.xls`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function exportToWord(filename, title, headers, data, subtitle = "") {
  let docHtml = `
    <html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
    <head>
      <meta charset="utf-8">
      <title>${title}</title>
      <style>
        body { font-family: 'Calibri', 'Segoe UI', Arial, sans-serif; padding: 20px; }
        h1 { color: #1e293b; font-size: 22px; border-bottom: 2px solid #3b82f6; padding-bottom: 8px; }
        .meta { color: #64748b; font-size: 12px; margin-bottom: 20px; }
        table { border-collapse: collapse; width: 100%; margin-top: 15px; }
        th { background-color: #0f172a; color: #ffffff; font-weight: bold; padding: 10px; border: 1px solid #94a3b8; font-size: 12px; text-align: left; }
        td { padding: 8px 10px; border: 1px solid #cbd5e1; font-size: 12px; }
        tr:nth-child(even) { background-color: #f8fafc; }
      </style>
    </head>
    <body>
      <h1>📄 ${title}</h1>
      <div class="meta">${subtitle || "Official Hotel Operations Audit Report"} — Generated: ${new Date().toLocaleString()}</div>
      <table>
        <thead>
          <tr>
            ${headers.map((h) => `<th>${h}</th>`).join("")}
          </tr>
        </thead>
        <tbody>
          ${data
            .map(
              (row) => `
            <tr>
              ${row.map((cell) => `<td>${cell != null ? String(cell) : ""}</td>`).join("")}
            </tr>
          `
            )
            .join("")}
        </tbody>
      </table>
    </body>
    </html>
  `;

  const blob = new Blob(["\ufeff" + docHtml], { type: "application/msword;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${filename}_${new Date().toISOString().slice(0, 10)}.doc`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function exportToPDF(title, headers, data, subtitle = "") {
  const printHtml = `
      <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:2px solid #e2e8f0; padding-bottom:12px; margin-bottom:20px;">
        <div>
          <h1 style="margin:0; font-size:20px; color:#0f172a;">📊 ${title}</h1>
          <p style="margin: 4px 0 0; font-size: 12px; color: #64748b;">${subtitle || "Official Hotel Operations Audit Report"}</p>
        </div>
        <div style="font-size: 12px; color: #64748b;">
          Generated: ${new Date().toLocaleDateString()}
        </div>
      </div>

      <table style="width:100%; border-collapse:collapse; margin-top:10px;">
        <thead>
          <tr style="background:#1e293b; color:#ffffff;">
            ${headers.map((h) => `<th style="padding:9px 12px; font-size:11px; font-weight:700; text-transform:uppercase; text-align:left; border:1px solid #334155;">${h}</th>`).join("")}
          </tr>
        </thead>
        <tbody>
          ${data
            .map(
              (row, idx) => `
            <tr style="background:${idx % 2 === 1 ? '#f8fafc' : '#ffffff'};">
              ${row.map((cell) => `<td style="padding:8px 12px; font-size:12px; border:1px solid #cbd5e1; color:#334155;">${cell != null ? String(cell) : ""}</td>`).join("")}
            </tr>
          `
            )
            .join("")}
        </tbody>
      </table>
  `;

  printViaIframe(printHtml, title);
}

/**
 * Clean & bulletproof printing using a hidden iframe to prevent popup blocking & blank pages.
 */
export function printViaIframe(htmlContent, title = "Print Document") {
  // Remove any legacy print iframe
  const oldIframe = document.getElementById("pms-print-iframe");
  if (oldIframe) {
    oldIframe.remove();
  }

  // Create isolated print iframe
  const iframe = document.createElement("iframe");
  iframe.id = "pms-print-iframe";
  iframe.style.position = "fixed";
  iframe.style.right = "0";
  iframe.style.bottom = "0";
  iframe.style.width = "0";
  iframe.style.height = "0";
  iframe.style.border = "0";
  iframe.style.opacity = "0";
  iframe.style.pointerEvents = "none";

  document.body.appendChild(iframe);

  const doc = iframe.contentWindow.document;
  doc.open();
  doc.write(`
    <!DOCTYPE html>
    <html>
      <head>
        <title>${title}</title>
        <style>
          @page {
            size: A4 portrait;
            margin: 10mm 12mm;
          }
          *, *::before, *::after {
            box-sizing: border-box;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
            background: #ffffff !important;
            color: #0f172a !important;
            margin: 0 !important;
            padding: 16px !important;
          }
          .invoice-paper, .grc-paper, .booking-slip, .printable-area {
            background: #ffffff !important;
            color: #0f172a !important;
            box-shadow: none !important;
            border: none !important;
            padding: 0 !important;
            margin: 0 !important;
            width: 100% !important;
          }
          .no-print, button {
            display: none !important;
          }
          img {
            max-height: 65px !important;
            max-width: 220px !important;
            object-fit: contain !important;
            display: block !important;
            visibility: visible !important;
          }
          table {
            width: 100% !important;
            border-collapse: collapse !important;
          }
          th, td {
            padding: 8px 10px !important;
          }
        </style>
      </head>
      <body>
        ${htmlContent}
      </body>
    </html>
  `);
  doc.close();

  const doPrint = () => {
    try {
      iframe.contentWindow.focus();
      iframe.contentWindow.print();
    } catch (err) {
      console.error("Print via iframe error:", err);
    }
    setTimeout(() => {
      try {
        if (iframe && iframe.parentNode) {
          iframe.parentNode.removeChild(iframe);
        }
      } catch (e) {}
    }, 60000);
  };

  try {
    const images = iframe.contentWindow.document.images;
    if (images && images.length > 0) {
      let loadedCount = 0;
      let printCalled = false;
      const trigger = () => {
        if (!printCalled) {
          printCalled = true;
          doPrint();
        }
      };

      for (let i = 0; i < images.length; i++) {
        if (images[i].complete) {
          loadedCount++;
        } else {
          images[i].onload = () => {
            loadedCount++;
            if (loadedCount >= images.length) trigger();
          };
          images[i].onerror = () => {
            loadedCount++;
            if (loadedCount >= images.length) trigger();
          };
        }
      }
      if (loadedCount >= images.length) {
        setTimeout(trigger, 150);
      } else {
        setTimeout(trigger, 600); // Fallback
      }
    } else {
      setTimeout(doPrint, 200);
    }
  } catch (err) {
    setTimeout(doPrint, 250);
  }
}

/**
 * Enterprise In-Place Document Printer for GRC Cards, Invoices, and Folios.
 * Appends a clean #pms-in-place-print-container directly to document.body,
 * triggers window.print(), and cleans up automatically.
 */
export function printElementInPlace(htmlContent, title = "Document") {
  const oldContainer = document.getElementById("pms-in-place-print-container");
  if (oldContainer) {
    oldContainer.remove();
  }

  const container = document.createElement("div");
  container.id = "pms-in-place-print-container";
  container.className = "grc-paper printable-area pms-print-container";
  container.innerHTML = htmlContent;

  document.body.appendChild(container);
  document.body.classList.add("pms-printing-active");

  const cleanup = () => {
    document.body.classList.remove("pms-printing-active");
    if (container && container.parentNode) {
      container.parentNode.removeChild(container);
    }
  };

  if (typeof window !== "undefined") {
    window.addEventListener("afterprint", cleanup, { once: true });
  }

  const triggerPrint = () => {
    try {
      window.focus();
      window.print();
    } catch (e) {
      console.error("In-place print error:", e);
    }
    setTimeout(cleanup, 3000);
  };

  const images = container.getElementsByTagName("img");
  if (images && images.length > 0) {
    let loaded = 0;
    const checkAll = () => {
      loaded++;
      if (loaded >= images.length) setTimeout(triggerPrint, 100);
    };
    for (let i = 0; i < images.length; i++) {
      if (images[i].complete) {
        checkAll();
      } else {
        images[i].onload = checkAll;
        images[i].onerror = checkAll;
      }
    }
    setTimeout(triggerPrint, 400); // Safety fallback timeout
  } else {
    setTimeout(triggerPrint, 150);
  }
}
