// Deterministic asset compilation of the paw mark already used by CuyiElite.
// Run with client/electron/node_modules/.bin/electron.cmd scripts/render-brand.cjs.
const { app, BrowserWindow } = require("electron");
const fs = require("node:fs");
const path = require("node:path");
const root = path.resolve(__dirname, "..");
app.disableHardwareAcceleration();
app
  .whenReady()
  .then(async () => {
    const source = fs.readFileSync(
      path.join(root, "client/node_modules/ionicons/dist/svg/paw-outline.svg"),
      "utf8",
    );
    const paw = source
      .match(/<path[^>]+>/)[0]
      .replace("currentColor", "#ffffff");
    const mark = `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512"><rect width="512" height="512" rx="96" fill="#1d4ed8"/><g transform="translate(96 96) scale(.625)">${paw}</g></svg>`;
    const out = path.join(root, "client/resources");
    fs.mkdirSync(out, { recursive: true });
    fs.writeFileSync(path.join(out, "brand.svg"), mark);
    const win = new BrowserWindow({
      width: 512,
      height: 512,
      show: false,
      frame: false,
      webPreferences: { offscreen: true, sandbox: true },
    });
    const painted = new Promise((resolve, reject) => {
      const timeout = setTimeout(
        () => reject(new Error("No se pudo renderizar la marca")),
        15000,
      );
      win.webContents.once("paint", (_event, _dirty, image) => {
        clearTimeout(timeout);
        resolve(image);
      });
    });
    await win.loadURL(
      "data:text/html;charset=utf-8," +
        encodeURIComponent(
          `<style>html,body{margin:0;width:512px;height:512px;background:transparent}svg{display:block}</style>${mark}`,
        ),
    );
    const image = await painted;
    fs.writeFileSync(
      path.join(out, "brand.png"),
      image.resize({ width: 512, height: 512, quality: "best" }).toPNG(),
    );
    win.destroy();
    app.quit();
  })
  .catch((error) => {
    console.error(error);
    app.exit(1);
  });
