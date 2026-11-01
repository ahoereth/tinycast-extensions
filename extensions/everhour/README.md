<p align="center">
    <img src="./assets/everhour-logo.png" width="200" height="200" />
</p>

# Everhour Time Tracking

## 🚀 Getting Started

You will need your API Token:

1. `Navigate` to "My Profile" (https://app.everhour.com/#/account/profile)
2. `Scroll` to "Application Access"
3. `Copy` "API Token"
4. `Paste` in Extension Preferences

## Tinycast development

Requires macOS, Node.js 20+ and npm. From this extension's directory:

```sh
npm ci
npm run tinycast-install
```

This builds and copies the extension into the release Tinycast app's extension directory. Enable extensions in Tinycast and restart the app if the commands don't appear. Configure your Everhour token in the extension's preferences.

For local development:

```sh
npm run tinycast-install-dev
```

This builds, symlinks `dist` into Tinycast, and watches `src`, `assets`, `package.json` and `tsconfig.json` for rebuilds. **Close and reopen the Tinycast command after a rebuild**; this is not live UI reload. Restart Tinycast after changing command definitions. Ctrl+C stops the watcher but leaves the symlink installed. Run `npm run tinycast-install` to switch back to a standalone copy.

Quit Tinycast before switching installation modes. Existing installs are renamed to `everhour.backup-<timestamp>` alongside the new install; extension preferences are left untouched. These commands target `com.tinycast.app`, not Debug builds. Run `npm test` to check the installer without touching your real Tinycast installation.

## Upstream

This extension was copied from the original [Everhour extension for Raycast](https://github.com/raycast/extensions/tree/main/extensions/everhour) at [revision `2a6e784`](https://github.com/raycast/extensions/tree/2a6e784a92be54884ddc4714b148eb2669030692/extensions/everhour) for use with Tinycast. Credit belongs to the original authors and contributors. The original MIT license is preserved in [LICENSE](../../LICENSE).