const { getDefaultConfig } = require("expo/metro-config");
const { withNativeWind } = require("nativewind/metro");

const config = getDefaultConfig(__dirname);

/**
 * Configuração do Metro APENAS para Mobile (iOS/Android)
 * 
 * Sem suporte a web - evita erro jsdom/paper
 * SDK Identy funciona perfeitamente em mobile
 */

// Remover web da lista de plataformas
config.resolver.platforms = ["ios", "android"];

// Configurar sourceExts apenas para mobile
config.resolver.sourceExts = ["ts", "tsx", "js", "jsx", "json", "mjs"];

module.exports = withNativeWind(config, {
  input: "./global.css",
  forceWriteFileSystem: true,
});
