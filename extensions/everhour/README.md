<p align="center">
    <img src="./assets/everhour-logo.svg" width="200" height="200" />
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

This builds and copies the extension into Tinycast Dev's extension directory when Tinycast Dev is running, otherwise into stable Tinycast. If both apps are running, Dev wins. Enable extensions in the target app and restart it if the commands don't appear. Configure your Everhour token in that app's extension preferences.

For local development:

```sh
npm run tinycast-install-dev
```

This builds, symlinks `dist` into Tinycast, and watches `src`, `assets`, `package.json` and `tsconfig.json` for rebuilds. **Close and reopen the Tinycast command after a rebuild**; this is not live UI reload. Restart Tinycast after changing command definitions. Ctrl+C stops the watcher but leaves the symlink installed. Run `npm run tinycast-install` to switch back to a standalone copy.

Both commands choose the target channel when they start; `tinycast-install-dev` controls symlinking and watching, not the target app. Keep Tinycast Dev running to target `com.tinycast.app.dev`; quit it to target stable (`com.tinycast.app`). Existing installs are replaced without keeping backups; extension preferences are left untouched. Run `npm test` to check the installer without touching your real Tinycast installation.

## Upstream

This extension was copied from the original [Everhour extension for Raycast](https://github.com/raycast/extensions/tree/main/extensions/everhour) at [revision `2a6e784`](https://github.com/raycast/extensions/tree/2a6e784a92be54884ddc4714b148eb2669030692/extensions/everhour) for use with Tinycast. Credit belongs to the original authors and contributors. The original MIT license is preserved in [LICENSE](../../LICENSE).