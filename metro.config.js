const path = require('path');
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

const PI_ENV_KEYS_STUB = path.resolve(__dirname, 'lib/runtime/pi-env-api-keys.stub.js');

/** pi-ai lazy-loads built-in HTTP providers we never call. Stub them so Expo
 *  does not pull OpenAI/Anthropic/Bedrock SDKs into the wallet bundle. */
const PI_LAZY_PROVIDERS = new Set([
  './anthropic.js',
  './azure-openai-responses.js',
  './google.js',
  './google-vertex.js',
  './mistral.js',
  './openai-codex-responses.js',
  './openai-completions.js',
  './openai-responses.js',
  './amazon-bedrock.js',
]);

const NODE_STUBS = new Set([
  'fs',
  'os',
  'path',
  'http',
  'https',
  'net',
  'tls',
  'child_process',
  'node:fs',
  'node:os',
  'node:path',
  'node:http',
  'node:https',
  'node:net',
  'node:tls',
  'node:child_process',
]);

function fromPiAi(originModulePath, suffix) {
  return (
    typeof originModulePath === 'string' &&
    originModulePath.includes(`${path.sep}@mariozechner${path.sep}pi-ai${path.sep}`) &&
    originModulePath.endsWith(suffix)
  );
}

config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName === 'crypto' || moduleName === 'node:crypto') {
    return context.resolveRequest(context, 'react-native-quick-crypto', platform);
  }
  if (
    moduleName === './env-api-keys.js' &&
    typeof context.originModulePath === 'string' &&
    context.originModulePath.includes(`${path.sep}@mariozechner${path.sep}pi-ai${path.sep}`)
  ) {
    return { type: 'sourceFile', filePath: PI_ENV_KEYS_STUB };
  }
  if (
    moduleName === './providers/register-builtins.js' &&
    typeof context.originModulePath === 'string' &&
    context.originModulePath.includes(`${path.sep}@mariozechner${path.sep}pi-ai${path.sep}`)
  ) {
    return { type: 'empty' };
  }
  if (fromPiAi(context.originModulePath, `${path.sep}register-builtins.js`) && PI_LAZY_PROVIDERS.has(moduleName)) {
    return { type: 'empty' };
  }
  if (NODE_STUBS.has(moduleName)) {
    return { type: 'empty' };
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
