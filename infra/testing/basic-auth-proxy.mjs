import { timingSafeEqual } from "node:crypto";
import http from "node:http";

const listenPort = Number(process.env.TEST_PROXY_PORT ?? "4174");
const upstreamHost = process.env.TEST_PROXY_UPSTREAM_HOST ?? "127.0.0.1";
const upstreamPort = Number(process.env.TEST_PROXY_UPSTREAM_PORT ?? "5173");
const username = process.env.TEST_TUNNEL_USER ?? "cdt-test";
const password = process.env.TEST_TUNNEL_PASSWORD;

if (!password || password.length < 12) {
  throw new Error("TEST_TUNNEL_PASSWORD must contain at least 12 characters.");
}

const expectedAuthorization = Buffer.from(
  `Basic ${Buffer.from(`${username}:${password}`).toString("base64")}`,
);

function authorized(request) {
  const supplied = Buffer.from(request.headers.authorization ?? "");
  return (
    supplied.length === expectedAuthorization.length &&
    timingSafeEqual(supplied, expectedAuthorization)
  );
}

function reject(response) {
  response.writeHead(401, {
    "Cache-Control": "no-store",
    "Content-Type": "text/plain; charset=utf-8",
    "WWW-Authenticate": 'Basic realm="CDT test dashboard"',
  });
  response.end("Authentication required.\n");
}

function upstreamHeaders(request) {
  const headers = { ...request.headers };
  delete headers.authorization;
  headers.host = `${upstreamHost}:${upstreamPort}`;
  return headers;
}

const server = http.createServer((request, response) => {
  if (!authorized(request)) {
    reject(response);
    return;
  }

  const upstream = http.request(
    {
      hostname: upstreamHost,
      port: upstreamPort,
      method: request.method,
      path: request.url,
      headers: upstreamHeaders(request),
    },
    (upstreamResponse) => {
      response.writeHead(
        upstreamResponse.statusCode ?? 502,
        upstreamResponse.headers,
      );
      upstreamResponse.pipe(response);
    },
  );

  upstream.on("error", () => {
    if (!response.headersSent) {
      response.writeHead(502, { "Content-Type": "text/plain; charset=utf-8" });
    }
    response.end("The local dashboard is unavailable.\n");
  });

  request.pipe(upstream);
});

server.on("upgrade", (request, socket, head) => {
  if (!authorized(request)) {
    socket.end(
      'HTTP/1.1 401 Unauthorized\r\nWWW-Authenticate: Basic realm="CDT test dashboard"\r\nConnection: close\r\n\r\n',
    );
    return;
  }

  const upstream = http.request({
    hostname: upstreamHost,
    port: upstreamPort,
    method: request.method,
    path: request.url,
    headers: upstreamHeaders(request),
  });

  upstream.on("upgrade", (upstreamResponse, upstreamSocket, upstreamHead) => {
    const statusLine = `HTTP/${upstreamResponse.httpVersion} ${upstreamResponse.statusCode} ${upstreamResponse.statusMessage}\r\n`;
    const headers = upstreamResponse.rawHeaders
      .reduce((lines, value, index, values) => {
        if (index % 2 === 0) lines.push(`${value}: ${values[index + 1]}`);
        return lines;
      }, [])
      .join("\r\n");
    socket.write(`${statusLine}${headers}\r\n\r\n`);
    if (upstreamHead.length) socket.write(upstreamHead);
    if (head.length) upstreamSocket.write(head);
    upstreamSocket.pipe(socket).pipe(upstreamSocket);
  });

  upstream.on("response", (upstreamResponse) => {
    socket.end(`HTTP/1.1 ${upstreamResponse.statusCode ?? 502} Bad Gateway\r\nConnection: close\r\n\r\n`);
  });
  upstream.on("error", () => socket.destroy());
  upstream.end();
});

server.listen(listenPort, "127.0.0.1", () => {
  console.log(
    `Protected test proxy listening on http://127.0.0.1:${listenPort} -> http://${upstreamHost}:${upstreamPort}`,
  );
});
