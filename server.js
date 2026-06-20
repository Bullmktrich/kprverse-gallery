const http = require("http");
const https = require("https");
const url = require("url");
const fs = require("fs");
const path = require("path");

const PORT = parseInt(process.env.PORT) || 10000;
const OPENSEA_API_KEY = process.env.OPENSEA_API_KEY || "";

function serveHTML(res) {
  const filePath = path.join(__dirname, "index.html");
  fs.readFile(filePath, (err, data) => {
    if (err) {
      console.error("Could not read index.html:", err.message);
      res.writeHead(500, { "Content-Type": "text/plain" });
      res.end("Server error: could not load index.html");
      return;
    }
    res.writeHead(200, {
      "Content-Type": "text/html; charset=utf-8",
      "Access-Control-Allow-Origin": "*"
    });
    res.end(data);
  });
}

function proxyToOpenSea(osPath, res) {
  const options = {
    hostname: "api.opensea.io",
    path: osPath,
    method: "GET",
    headers: {
      "x-api-key": OPENSEA_API_KEY,
      "accept": "application/json",
    },
  };

  const req = https.request(options, (osRes) => {
    res.writeHead(osRes.statusCode, {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
    });
    osRes.pipe(res);
  });

  req.on("error", (e) => {
    console.error("OpenSea proxy error:", e.message);
    res.writeHead(502, { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" });
    res.end(JSON.stringify({ error: e.message }));
  });

  req.end();
}

const server = http.createServer((req, res) => {
  const parsed = url.parse(req.url);
  const pathname = parsed.pathname;
  const query = parsed.query || "";

  console.log(`${req.method} ${pathname}`);

  if (req.method === "OPTIONS") {
    res.writeHead(204, {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "*",
      "Access-Control-Allow-Methods": "GET, OPTIONS"
    });
    res.end();
    return;
  }

  // Serve frontend for all non-API routes
  if (!pathname.startsWith("/api/")) {
    serveHTML(res);
    return;
  }

  // GET /api/wallet/:address/nfts
  const walletMatch = pathname.match(/^\/api\/wallet\/([^/]+)\/nfts$/);
  if (walletMatch) {
    const address = walletMatch[1];
    const osPath = `/api/v2/chain/ethereum/account/${address}/nfts${query ? "?" + query : ""}`;
    proxyToOpenSea(osPath, res);
    return;
  }

  // GET /api/collections/:slug/stats
  const statsMatch = pathname.match(/^\/api\/collections\/([^/]+)\/stats$/);
  if (statsMatch) {
    proxyToOpenSea(`/api/v2/collections/${statsMatch[1]}/stats`, res);
    return;
  }

  // GET /api/collections/:slug
  const collMatch = pathname.match(/^\/api\/collections\/([^/]+)$/);
  if (collMatch) {
    proxyToOpenSea(`/api/v2/collections/${collMatch[1]}`, res);
    return;
  }

  res.writeHead(404, { "Content-Type": "application/json" });
  res.end(JSON.stringify({ error: "API route not found: " + pathname }));
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(`KPRVERSE Gallery → http://0.0.0.0:${PORT}`);
  if (!OPENSEA_API_KEY) console.warn("⚠  Set OPENSEA_API_KEY environment variable");
  console.log(`index.html exists: ${fs.existsSync(path.join(__dirname, "index.html"))}`);
});
