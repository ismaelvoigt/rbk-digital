import { createServer } from "node:http";
import { it, expect } from "vitest";
import { sendFile } from "../src/lib/auditoria/upload";
it.each([
  { count: 1, size: 25 * 1024 * 1024 },
  { count: 10, size: 25000000 },
])(
  "TUS: $count arquivo(s) de $size bytes, falha e retomada sem perda",
  async ({ count, size }) => {
    const bytes = Buffer.alloc(size, 42);
    let next = 0,
      heads = 0,
      patches = 0;
    const uploads = new Map<string, { offset: number; fail: boolean }>();
    const server = createServer((req, res) => {
      res.setHeader("Tus-Resumable", "1.0.0");
      if (req.method === "POST") {
        const path = "/upload/" + ++next;
        uploads.set(path, { offset: 0, fail: true });
        res.writeHead(201, { Location: path, "Upload-Offset": "0" });
        res.end();
        return;
      }
      const item = uploads.get(req.url!);
      if (!item) {
        res.writeHead(404);
        res.end();
        return;
      }
      if (req.method === "HEAD") {
        heads++;
        res.writeHead(200, {
          "Upload-Offset": String(item.offset),
          "Upload-Length": String(bytes.length),
        });
        res.end();
      } else if (req.method === "PATCH") {
        patches++;
        if (item.fail) {
          item.fail = false;
          req.socket.destroy();
          return;
        }
        const chunks: Buffer[] = [];
        req.on("data", (c) => chunks.push(c));
        req.on("end", () => {
          const data = Buffer.concat(chunks);
          expect(Number(req.headers["upload-offset"])).toBe(item.offset);
          expect(data.every((x) => x === 42)).toBe(true);
          item.offset += data.length;
          res.writeHead(204, { "Upload-Offset": String(item.offset) });
          res.end();
        });
      }
    });
    await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
    const addr = server.address() as { port: number };
    try {
      for (let i = 0; i < count; i++) {
        let progress = 0;
        await sendFile(
          bytes as unknown as File,
          {
            endpoint: `http://127.0.0.1:${addr.port}/upload`,
            token: "synthetic",
            path: `test/${i}.pdf`,
            mime: "application/pdf",
          },
          (n) => (progress = n),
        );
        expect(progress).toBe(bytes.length);
      }
      expect([...uploads.values()].reduce((n, u) => n + u.offset, 0)).toBe(
        count * size,
      );
      expect(heads).toBeGreaterThanOrEqual(count);
      expect(patches).toBeGreaterThan(count * 4);
    } finally {
      server.closeAllConnections();
      await new Promise<void>((r) => server.close(() => r()));
    }
  },
  15000,
);
