// Metro pour le monorepo pnpm : depuis le SDK 52, `expo/metro-config` trouve
// seul la racine du dépôt (watchFolders, node_modules isolés de pnpm). Ne pas
// ajouter watchFolders ni nodeModulesPaths à la main.
const { getDefaultConfig } = require("expo/metro-config");

module.exports = getDefaultConfig(__dirname);
