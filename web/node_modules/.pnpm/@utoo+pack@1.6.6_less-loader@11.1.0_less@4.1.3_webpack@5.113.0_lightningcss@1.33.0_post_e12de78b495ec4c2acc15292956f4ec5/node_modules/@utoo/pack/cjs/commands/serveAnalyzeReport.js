"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.serveAnalyzeReport = serveAnalyzeReport;
const node_fs_1 = require("node:fs");
const promises_1 = require("node:fs/promises");
const node_http_1 = require("node:http");
const node_path_1 = __importDefault(require("node:path"));
const contentTypes = {
    ".html": "text/html; charset=utf-8",
    ".js": "text/javascript; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".json": "application/json; charset=utf-8",
    ".svg": "image/svg+xml",
    ".png": "image/png",
    ".ico": "image/x-icon",
    ".woff2": "font/woff2",
};
/** Serve an exported report on loopback, without keeping a compiler alive. */
async function serveAnalyzeReport(outputPath, port = 4000) {
    if (!Number.isInteger(port) || port < 0 || port > 65535) {
        throw new Error("Analyzer port must be an integer between 0 and 65535.");
    }
    const root = await (0, promises_1.realpath)(outputPath);
    const server = (0, node_http_1.createServer)(async (request, response) => {
        if (request.method !== "GET" && request.method !== "HEAD") {
            response.writeHead(405, { Allow: "GET, HEAD" }).end();
            return;
        }
        try {
            const pathname = decodeURIComponent(new URL(request.url || "/", "http://localhost").pathname);
            const filename = await (0, promises_1.realpath)(node_path_1.default.resolve(root, `.${pathname === "/" ? "/index.html" : pathname}`));
            const relative = node_path_1.default.relative(root, filename);
            if (relative === ".." ||
                relative.startsWith(`..${node_path_1.default.sep}`) ||
                node_path_1.default.isAbsolute(relative)) {
                response.writeHead(404).end();
                return;
            }
            const info = await (0, promises_1.stat)(filename);
            if (!info.isFile()) {
                response.writeHead(404).end();
                return;
            }
            response.writeHead(200, {
                "Content-Type": contentTypes[node_path_1.default.extname(filename)] || "application/octet-stream",
                "Content-Length": info.size,
                "Cache-Control": "no-cache",
                "X-Content-Type-Options": "nosniff",
            });
            if (request.method === "HEAD") {
                response.end();
            }
            else {
                const stream = (0, node_fs_1.createReadStream)(filename);
                stream.on("error", () => response.destroy());
                response.on("close", () => stream.destroy());
                stream.pipe(response);
            }
        }
        catch (_a) {
            response.writeHead(404).end();
        }
    });
    await new Promise((resolve, reject) => {
        server.once("error", reject);
        server.listen(port, "127.0.0.1", () => {
            server.off("error", reject);
            resolve();
        });
    });
    const address = server.address();
    if (!address || typeof address === "string") {
        server.close();
        throw new Error("Unable to determine Analyzer server address.");
    }
    return {
        url: `http://127.0.0.1:${address.port}`,
        close: () => new Promise((resolve, reject) => {
            server.close((error) => (error ? reject(error) : resolve()));
        }),
    };
}
