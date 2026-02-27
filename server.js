import express from "express";

const app = express();
app.use(express.json({ type: "*/*", limit: "2mb" }));

const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET || "";

let latest = { receivedAt: null, payload: null };

app.post("/webhook", (req, res) => {
  if (WEBHOOK_SECRET) {
    const secret = req.header("x-webhook-secret");
    if (secret !== WEBHOOK_SECRET) {
      return res.status(401).json({ ok: false, message: "Unauthorized" });
    }
  }

  latest = { receivedAt: new Date().toISOString(), payload: req.body };
  console.log("✅ Webhook received:", latest.receivedAt);

  res.status(200).json({ ok: true });
});

app.get("/latest", (_req, res) => res.json(latest));

app.get("/", (_req, res) => {
  res.setHeader("content-type", "text/html; charset=utf-8");
  res.end(`<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Webhook Viewer</title>
  <style>
    body { font-family: system-ui, -apple-system; margin: 24px; }
    .pill { display: inline-block; padding: 6px 10px; border-radius: 999px; background: #f2f2f2; font-size: 13px; margin-right: 8px; }
    .grid { display: grid; gap: 12px; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); margin-top: 16px; }
    .card { border: 1px solid #eee; border-radius: 12px; padding: 12px; }
    .label { font-size: 12px; color: #666; margin-bottom: 6px; }
    .value { font-weight: 600; word-break: break-word; }
    pre { background: #0b1020; color: #e7e7e7; padding: 16px; border-radius: 10px; overflow: auto; }
    img { max-width: 100%; border-radius: 10px; border: 1px solid #eee; }
    .muted { color: #666; font-size: 14px; }
  </style>
</head>
<body>
  <h2 style="margin:0">Webhook Viewer</h2>
  <div style="margin-top:10px">
    <span class="pill">POST /webhook</span>
    <span class="pill">GET /latest</span>
    <span class="pill" id="lastSeen">Last received: —</span>
  </div>

  <p class="muted">This page auto-updates. When the sender calls <b>/webhook</b>, you’ll see it here.</p>

  <div class="grid" id="summary"></div>

  <h3>Raw Payload</h3>
  <pre id="raw">Waiting for webhook...</pre>

  <script>
    function safeGet(obj, path, fallback=null) {
      try { return path.split(".").reduce((a,k)=>a && a[k], obj) ?? fallback; }
      catch { return fallback; }
    }

    function render(payloadWrapper) {
      const root = payloadWrapper?.payload || {};
      const nfc = safeGet(root, "data.data.nfc", {});
      const datapage = safeGet(root, "data.data.datapage", {});
      const live = safeGet(root, "data.data.live", {});
      const face = safeGet(root, "data.verificationResult.faceComparison", {});
      const status = safeGet(root, "data.status", "—");
      const clientUniqueId = safeGet(root, "data.clientUniqueId", "—");
      const msg = safeGet(root, "message", "—");

      const cards = [
        ["Status", status],
        ["Message", msg],
        ["Client Unique ID", clientUniqueId],
        ["Full Name", nfc.fullName || "—"],
        ["Document No (NFC)", nfc.documentNo || "—"],
        ["Nationality", nfc.nationality || datapage.nationality || "—"],
        ["Date of Birth", nfc.dateOfBirth || datapage.dateOfBirth || "—"],
        ["Gender", nfc.gender || datapage.gender || "—"],
        ["Expiry", nfc.dateOfExpiration || datapage.dateOfExpiration || "—"],
        ["Face Match", face.match === true ? "✅ Match" : face.match === false ? "❌ No Match" : "—"],
        ["Similarity", typeof face.similarity === "number" ? face.similarity + "%" : "—"]
      ];

      const summary = document.getElementById("summary");
      summary.innerHTML = cards.map(([label, value]) => \`
        <div class="card">
          <div class="label">\${label}</div>
          <div class="value">\${String(value)}</div>
        </div>
      \`).join("");

      const storedPortrait = nfc.storedPortrait;
      const livePortrait = live.livePortrait;

      if (storedPortrait || livePortrait) {
        summary.innerHTML += \`
          <div class="card">
            <div class="label">Stored Portrait</div>
            \${storedPortrait ? \`<img src="\${storedPortrait}" />\` : "<div class='muted'>—</div>"}
          </div>
          <div class="card">
            <div class="label">Live Portrait</div>
            \${livePortrait ? \`<img src="\${livePortrait}" />\` : "<div class='muted'>—</div>"}
          </div>
        \`;
      }
    }

    async function refresh() {
      const res = await fetch("/latest");
      const data = await res.json();

      document.getElementById("lastSeen").textContent =
        "Last received: " + (data.receivedAt || "—");

      document.getElementById("raw").textContent =
        data.payload ? JSON.stringify(data.payload, null, 2) : "Waiting for webhook...";

      render(data);
    }

    refresh();
    setInterval(refresh, 1500);
  </script>
</body>
</html>`);
});

const port = process.env.PORT || 3000;
app.listen(port, () => console.log("✅ Running on port", port));