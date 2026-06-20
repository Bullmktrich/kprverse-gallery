const http = require("http");
const https = require("https");
const url = require("url");

const PORT = process.env.PORT || 3000;
const OPENSEA_API_KEY = process.env.OPENSEA_API_KEY || "";

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
    res.writeHead(502, { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" });
    res.end(JSON.stringify({ error: e.message }));
  });

  req.end();
}

function serveHTML(res) {
  const fs = require("fs");
  fs.readFile(__dirname + "/index.html", (err, data) => {
    if (err) { res.writeHead(404); res.end("Not found"); return; }
    res.writeHead(200, { "Content-Type": "text/html" });
    res.end(data);
  });
}

const server = http.createServer((req, res) => {
  const parsed = url.parse(req.url);
  const pathname = parsed.pathname;
  const query = parsed.query || "";

  if (req.method === "OPTIONS") {
    res.writeHead(204, { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "*" });
    res.end();
    return;
  }

  if (pathname === "/" || pathname === "/index.html") {
    serveHTML(res);
    return;
  }

  // GET /api/wallet/:address/nfts  →  /api/v2/chain/ethereum/account/:address/nfts
  const walletMatch = pathname.match(/^\/api\/wallet\/([^/]+)\/nfts$/);
  if (walletMatch) {
    const address = walletMatch[1];
    const osPath = `/api/v2/chain/ethereum/account/${address}/nfts${query ? "?" + query : ""}`;
    proxyToOpenSea(osPath, res);
    return;
  }

  // GET /api/collections/:slug  →  /api/v2/collections/:slug
  const collMatch = pathname.match(/^\/api\/collections\/([^/]+)$/);
  if (collMatch) {
    proxyToOpenSea(`/api/v2/collections/${collMatch[1]}`, res);
    return;
  }

  // GET /api/collections/:slug/stats  →  /api/v2/collections/:slug/stats
  const statsMatch = pathname.match(/^\/api\/collections\/([^/]+)\/stats$/);
  if (statsMatch) {
    proxyToOpenSea(`/api/v2/collections/${statsMatch[1]}/stats`, res);
    return;
  }

  res.writeHead(404, { "Content-Type": "application/json" });
  res.end(JSON.stringify({ error: "Not found" }));
});

server.listen(PORT, () => {
  console.log(`KPRVERSE Gallery → http://localhost:${PORT}`);
  if (!OPENSEA_API_KEY) console.warn("⚠  Set OPENSEA_API_KEY environment variable");
});
