const STORE_KEY = "defectiq_inspections_v1";

const state = {
  image: null,
  fileName: "",
  fileSize: 0,
  originalWidth: 0,
  originalHeight: 0,
  candidates: [],
  currentInspection: null
};

const pages = document.querySelectorAll(".page");
const navLinks = document.querySelectorAll(".nav-link");

document.querySelectorAll(".nav-link").forEach(button => {
  button.addEventListener("click", () => showPage(button.dataset.page, button));
});

function showPage(pageName, activeButton) {
  pages.forEach(page => page.classList.remove("active"));
  navLinks.forEach(link => link.classList.remove("active"));
  document.getElementById(`page-${pageName}`).classList.add("active");
  if (activeButton) activeButton.classList.add("active");
  if (pageName === "dashboard") renderDashboard();
  if (pageName === "history") renderHistory();
}

document.querySelectorAll(".tab").forEach(tab => {
  tab.addEventListener("click", () => {
    document.querySelectorAll(".tab").forEach(item => item.classList.remove("active"));
    document.querySelectorAll(".tab-panel").forEach(panel => panel.classList.remove("active"));
    tab.classList.add("active");
    document.getElementById(`tab-${tab.dataset.tab}`).classList.add("active");
  });
});

document.getElementById("camera-button").addEventListener("click", () => {
  document.getElementById("camera-input").click();
});

document.getElementById("fabric-input").addEventListener("change", event => {
  handleFile(event.target.files[0]);
});

document.getElementById("camera-input").addEventListener("change", event => {
  handleFile(event.target.files[0]);
});

function handleFile(file) {
  if (!file) return;

  const validTypes = ["image/jpeg", "image/jpg", "image/png"];
  if (!validTypes.includes(file.type)) {
    alert("Please upload a JPG, JPEG, or PNG image.");
    return;
  }

  if (file.size > 15 * 1024 * 1024) {
    alert("File is too large. Maximum size is 15 MB.");
    return;
  }

  const reader = new FileReader();
  reader.onload = event => {
    const image = new Image();
    image.onload = () => {
      state.image = image;
      state.fileName = file.name;
      state.fileSize = file.size;
      state.originalWidth = image.naturalWidth;
      state.originalHeight = image.naturalHeight;
      state.candidates = [];
      state.currentInspection = null;

      const details = document.getElementById("file-details");
      details.classList.remove("hidden");
      details.innerHTML = `
        <div><strong>File</strong>${escapeHtml(file.name)}</div>
        <div><strong>Size</strong>${(file.size / 1024).toFixed(1)} KB</div>
        <div><strong>Original dimensions</strong>${image.naturalWidth} × ${image.naturalHeight} px</div>
        <div><strong>Status</strong>Ready for inspection</div>
      `;

      document.getElementById("inspection-controls").classList.remove("hidden");
      document.getElementById("results-card").classList.add("hidden");
      document.getElementById("save-card").classList.add("hidden");
      document.getElementById("save-status").innerHTML = "";
      document.getElementById("download-report").classList.add("hidden");

      drawImageToCanvas(document.getElementById("original-canvas"), image);
    };
    image.src = event.target.result;
  };
  reader.readAsDataURL(file);
}

document.getElementById("sensitivity").addEventListener("input", event => {
  document.getElementById("sensitivity-value").textContent = event.target.value;
});

document.getElementById("run-inspection").addEventListener("click", () => {
  if (!state.image) {
    alert("Upload or capture an image first.");
    return;
  }
  runInspection();
});

function runInspection() {
  const sensitivity = Number(document.getElementById("sensitivity").value);
  const maxWidth = 900;
  const scale = Math.min(1, maxWidth / state.image.naturalWidth);
  const width = Math.max(1, Math.round(state.image.naturalWidth * scale));
  const height = Math.max(1, Math.round(state.image.naturalHeight * scale));

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  context.drawImage(state.image, 0, 0, width, height);

  const imageData = context.getImageData(0, 0, width, height);
  const gray = toGrayscale(imageData.data, width, height);
  const deviation = localDeviation(gray, width, height);
  const threshold = Math.max(0.08, Math.min(0.30, 0.26 - (sensitivity / 100) * 0.13));

  const mask = new Uint8Array(width * height);
  for (let i = 0; i < deviation.length; i++) {
    if (deviation[i] > threshold) mask[i] = 255;
  }

  const boxes = findCandidateBoxes(mask, width, height, threshold, deviation);
  state.candidates = boxes;

  const annotated = document.getElementById("annotated-canvas");
  annotated.width = width;
  annotated.height = height;
  const annotatedContext = annotated.getContext("2d");
  annotatedContext.putImageData(imageData, 0, 0);

  boxes.forEach((box, index) => {
    annotatedContext.strokeStyle = "#00AAFF";
    annotatedContext.lineWidth = Math.max(2, Math.round(width / 450));
    annotatedContext.strokeRect(box.x, box.y, box.width, box.height);

    annotatedContext.fillStyle = "#00AAFF";
    annotatedContext.font = `${Math.max(13, Math.round(width / 55))}px Inter, sans-serif`;
    annotatedContext.fillText(`C${index + 1}`, box.x + 4, Math.max(18, box.y - 6));
  });

  document.getElementById("candidate-count").textContent = `${boxes.length} candidate${boxes.length === 1 ? "" : "s"}`;
  document.getElementById("results-card").classList.remove("hidden");
  document.getElementById("save-card").classList.remove("hidden");
  renderCandidates();
}

function toGrayscale(data, width, height) {
  const gray = new Float32Array(width * height);
  for (let i = 0, p = 0; i < gray.length; i++, p += 4) {
    gray[i] = 0.299 * data[p] + 0.587 * data[p + 1] + 0.114 * data[p + 2];
  }
  return gray;
}

function localDeviation(gray, width, height) {
  const radius = 7;
  const deviation = new Float32Array(gray.length);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let sum = 0;
      let count = 0;

      for (let dy = -radius; dy <= radius; dy += 2) {
        const ny = y + dy;
        if (ny < 0 || ny >= height) continue;

        for (let dx = -radius; dx <= radius; dx += 2) {
          const nx = x + dx;
          if (nx < 0 || nx >= width) continue;

          sum += gray[ny * width + nx];
          count++;
        }
      }

      const mean = sum / Math.max(1, count);
      deviation[y * width + x] = Math.abs(gray[y * width + x] - mean) / 255;
    }
  }

  return deviation;
}

function findCandidateBoxes(mask, width, height, threshold, deviation) {
  const visited = new Uint8Array(mask.length);
  const boxes = [];
  const imageArea = width * height;
  const minArea = Math.max(180, Math.round(imageArea * 0.00035));
  const maxArea = Math.round(imageArea * 0.20);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const index = y * width + x;

      if (!mask[index] || visited[index]) continue;

      const queue = [index];
      visited[index] = 1;

      let minX = x, maxX = x, minY = y, maxY = y, area = 0, deviationSum = 0;

      while (queue.length) {
        const current = queue.pop();
        const cy = Math.floor(current / width);
        const cx = current % width;

        area++;
        deviationSum += deviation[current];

        if (cx < minX) minX = cx;
        if (cx > maxX) maxX = cx;
        if (cy < minY) minY = cy;
        if (cy > maxY) maxY = cy;

        const neighbours = [
          current - 1, current + 1,
          current - width, current + width
        ];

        for (const neighbour of neighbours) {
          if (
            neighbour >= 0 && neighbour < mask.length &&
            mask[neighbour] && !visited[neighbour]
          ) {
            const ny = Math.floor(neighbour / width);
            const nx = neighbour % width;

            if (Math.abs(nx - cx) <= 1 && Math.abs(ny - cy) <= 1) {
              visited[neighbour] = 1;
              queue.push(neighbour);
            }
          }
        }
      }

      const boxWidth = maxX - minX + 1;
      const boxHeight = maxY - minY + 1;
      const aspect = Math.max(boxWidth, boxHeight) / Math.max(1, Math.min(boxWidth, boxHeight));

      if (area < minArea || area > maxArea || aspect > 8) continue;

      const averageDeviation = deviationSum / area;
      boxes.push({
        x: minX,
        y: minY,
        width: boxWidth,
        height: boxHeight,
        area,
        deviation: Number(averageDeviation.toFixed(4)),
        displayScore: Math.min(99, Number((averageDeviation * 220).toFixed(1))),
        decision: "Pending review",
        note: ""
      });
    }
  }

  boxes.sort((a, b) => b.deviation - a.deviation);
  return boxes.slice(0, 20);
}

function renderCandidates() {
  const container = document.getElementById("candidate-list");
  container.innerHTML = "";

  if (!state.candidates.length) {
    container.innerHTML = `<div class="notice">No candidate regions met the current threshold. Human review is still recommended.</div>`;
    return;
  }

  state.candidates.forEach((candidate, index) => {
    const element = document.createElement("article");
    element.className = "candidate";
    element.innerHTML = `
      <div>
        <strong>Candidate C${index + 1}</strong>
        <div class="meta">
          Location: x=${candidate.x}, y=${candidate.y}, width=${candidate.width}, height=${candidate.height}<br>
          Area: ${candidate.area} px<br>
          Visual-deviation indicator: ${candidate.displayScore}
        </div>
      </div>
      <div>
        <div class="review-options">
          <label><input type="radio" name="decision-${index}" value="Confirmed Defect"> Confirmed defect</label>
          <label><input type="radio" name="decision-${index}" value="Rejected / No Defect"> Rejected</label>
          <label><input type="radio" name="decision-${index}" value="Needs Further Inspection"> Needs review</label>
        </div>
        <input type="text" placeholder="Inspector note for C${index + 1}" data-note="${index}">
      </div>
    `;
    container.appendChild(element);
  });

  container.querySelectorAll("input[type=radio]").forEach(input => {
    input.addEventListener("change", event => {
      const index = Number(event.target.name.split("-")[1]);
      state.candidates[index].decision = event.target.value;
    });
  });

  container.querySelectorAll("input[type=text]").forEach(input => {
    input.addEventListener("input", event => {
      const index = Number(event.target.dataset.note);
      state.candidates[index].note = event.target.value;
    });
  });
}

document.getElementById("save-inspection").addEventListener("click", () => {
  if (!state.image || state.currentInspection) return;

  const id = `DIQ-${new Date().toISOString().slice(0, 10).replace(/-/g, "")}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
  const annotatedCanvas = document.getElementById("annotated-canvas");

  const inspection = {
    id,
    createdAt: new Date().toLocaleString(),
    fileName: state.fileName,
    originalWidth: state.originalWidth,
    originalHeight: state.originalHeight,
    sensitivity: Number(document.getElementById("sensitivity").value),
    candidateCount: state.candidates.length,
    candidates: state.candidates,
    decision: document.getElementById("overall-decision").value,
    notes: document.getElementById("overall-notes").value,
    annotatedImage: annotatedCanvas.toDataURL("image/png")
  };

  const records = getRecords();
  records.unshift(inspection);
  localStorage.setItem(STORE_KEY, JSON.stringify(records));

  state.currentInspection = inspection;

  document.getElementById("save-status").innerHTML =
    `<div class="notice">Inspection saved locally. Inspection ID: <strong>${id}</strong></div>`;
  document.getElementById("download-report").classList.remove("hidden");
  renderDashboard();
});

document.getElementById("download-report").addEventListener("click", () => {
  if (!state.currentInspection) return;
  generatePrintableReport(state.currentInspection);
});

document.getElementById("export-csv").addEventListener("click", exportCsv);

function getRecords() {
  try {
    return JSON.parse(localStorage.getItem(STORE_KEY)) || [];
  } catch {
    return [];
  }
}

function renderDashboard() {
  const records = getRecords();
  document.getElementById("metric-total").textContent = records.length;
  document.getElementById("metric-confirmed").textContent =
    records.filter(item => item.decision === "Confirmed Defect").length;
  document.getElementById("metric-rejected").textContent =
    records.filter(item => item.decision === "Rejected / No Defect").length;
  document.getElementById("metric-review").textContent =
    records.filter(item => item.decision === "Marked for Further Inspection").length;

  const tbody = document.getElementById("recent-table");
  tbody.innerHTML = "";

  if (!records.length) {
    tbody.innerHTML = `<tr><td colspan="5">No inspections saved yet.</td></tr>`;
    return;
  }

  records.slice(0, 8).forEach(record => {
    tbody.innerHTML += `
      <tr>
        <td>${record.id}</td>
        <td>${record.createdAt}</td>
        <td>${escapeHtml(record.fileName)}</td>
        <td>${record.candidateCount}</td>
        <td>${record.decision}</td>
      </tr>
    `;
  });
}

function renderHistory() {
  const records = getRecords();
  const tbody = document.getElementById("history-table");
  tbody.innerHTML = "";

  if (!records.length) {
    tbody.innerHTML = `<tr><td colspan="7">No inspection records available yet.</td></tr>`;
    return;
  }

  records.forEach(record => {
    tbody.innerHTML += `
      <tr>
        <td>${record.id}</td>
        <td>${record.createdAt}</td>
        <td>${escapeHtml(record.fileName)}</td>
        <td>${record.candidateCount}</td>
        <td>${record.decision}</td>
        <td>${escapeHtml(record.notes || "—")}</td>
        <td><button class="button secondary" onclick="generatePrintableReportById('${record.id}')">PDF</button></td>
      </tr>
    `;
  });
}

function generatePrintableReportById(id) {
  const record = getRecords().find(item => item.id === id);
  if (record) generatePrintableReport(record);
}

function generatePrintableReport(record) {
  const rows = record.candidates.map((candidate, index) => `
    <tr>
      <td>C${index + 1}</td>
      <td>${candidate.x}, ${candidate.y}, ${candidate.width}, ${candidate.height}</td>
      <td>${candidate.displayScore}</td>
      <td>${candidate.decision}</td>
      <td>${escapeHtml(candidate.note || "—")}</td>
    </tr>
  `).join("");

  const reportWindow = window.open("", "_blank");
  reportWindow.document.write(`
    <html>
      <head>
        <title>DefectIQ Lite Report - ${record.id}</title>
        <style>
          body{font-family:Arial,sans-serif;color:#22303C;padding:34px}
          h1{color:#0B2545;margin:0}
          h2{color:#0B2545;margin-top:26px;font-size:1.1rem}
          .subtitle{color:#0E7C86;margin:4px 0 24px}
          table{width:100%;border-collapse:collapse;margin-top:10px;font-size:12px}
          th{background:#0B2545;color:white;text-align:left;padding:8px}
          td{border:1px solid #D8E1E8;padding:8px}
          .details td:first-child{background:#F4F7FA;font-weight:bold;width:180px}
          .disclaimer{background:#FFF8E6;border-left:4px solid #D9A400;padding:12px;margin-top:24px;font-size:12px}
          img{max-width:100%;border:1px solid #D8E1E8;margin-top:10px}
        </style>
      </head>
      <body>
        <h1>DefectIQ Lite</h1>
        <div class="subtitle">Experimental Fabric Inspection Assistant • v0.1</div>

        <h2>Inspection details</h2>
        <table class="details">
          <tr><td>Inspection ID</td><td>${record.id}</td></tr>
          <tr><td>Date and time</td><td>${record.createdAt}</td></tr>
          <tr><td>Original filename</td><td>${escapeHtml(record.fileName)}</td></tr>
          <tr><td>Original dimensions</td><td>${record.originalWidth} × ${record.originalHeight} px</td></tr>
          <tr><td>Candidate regions</td><td>${record.candidateCount}</td></tr>
          <tr><td>Human review decision</td><td>${record.decision}</td></tr>
          <tr><td>Inspector comments</td><td>${escapeHtml(record.notes || "No notes provided.")}</td></tr>
        </table>

        <h2>Annotated inspection image</h2>
        <img src="${record.annotatedImage}" alt="Annotated fabric image">

        <h2>Candidate regions</h2>
        <table>
          <tr><th>Region</th><th>Location (x, y, w, h)</th><th>Visual deviation</th><th>Human decision</th><th>Note</th></tr>
          ${rows || `<tr><td colspan="5">No candidate regions identified.</td></tr>`}
        </table>

        <div class="disclaimer">
          <strong>Important limitations:</strong> DefectIQ Lite v0.1 is an experimental image-inspection assistant.
          It uses browser-based image processing to identify visually unusual local regions. It is not a trained AI defect
          classifier and does not provide a defect probability. Highlighted regions may include normal texture variation,
          shadows, folds, stains, or camera artefacts. Every result must be reviewed by a qualified human inspector.
        </div>

        <script>window.onload = () => setTimeout(() => window.print(), 400);<\/script>
      </body>
    </html>
  `);
  reportWindow.document.close();
}

function exportCsv() {
  const records = getRecords();

  if (!records.length) {
    alert("No inspection records available to export.");
    return;
  }

  const header = "Inspection ID,Date and Time,Uploaded Filename,Candidate Regions,Human Review Decision,Inspector Notes,Sensitivity";
  const rows = records.map(record => [
    record.id,
    record.createdAt,
    record.fileName,
    record.candidateCount,
    record.decision,
    record.notes || "",
    record.sensitivity
  ].map(csvEscape).join(","));

  const blob = new Blob(["\ufeff" + [header, ...rows].join("\n")], { type: "text/csv;charset=utf-8;" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = "defectiq_inspection_history.csv";
  link.click();
  URL.revokeObjectURL(link.href);
}

function csvEscape(value) {
  const text = String(value);
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function drawImageToCanvas(canvas, image) {
  const maxWidth = 900;
  const scale = Math.min(1, maxWidth / image.naturalWidth);
  canvas.width = Math.round(image.naturalWidth * scale);
  canvas.height = Math.round(image.naturalHeight * scale);
  canvas.getContext("2d").drawImage(image, 0, 0, canvas.width, canvas.height);
}

renderDashboard();
renderHistory();
