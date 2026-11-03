/** @type {import('electron-builder').Configuration} */
module.exports = {
  appId: 'co.ucc.cuyielite',
  productName: 'CuyiElite',
  directories: {
    output: 'dist',
    buildResources: 'assets',
  },
  files: [
    'build/**/*',
    'app/**/*',
    'generated/**/*',
    // `assets` is also the electron-builder `buildResources` directory, whose
    // contents are NOT packaged by default. Include it explicitly so the
    // splash screen (and any other runtime assets) ship in the app.
    'assets/**/*',
    'package.json',
    // Platform runtime + plugins, prepared by `capacitor-electron vendor`.
    { from: 'vendor/node_modules', to: 'node_modules' },
  ],
  // Explicit Windows x64 NSIS target, per-user installation (no admin rights,
  // no UAC elevation) so the field technician can install without IT support.
  win: {
    target: [
      {
        target: 'nsis',
        arch: ['x64'],
      },
    ],
  },
  nsis: {
    oneClick: true,
    perMachine: false,
    allowElevation: false,
  },
};
