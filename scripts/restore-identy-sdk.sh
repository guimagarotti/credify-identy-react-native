#!/bin/bash
#
# restore-identy-sdk.sh
# Garante que o dist/ do @identy/identy-face está completo.
#
# O pacote privado do JFrog às vezes instala com dist/ vazio.
# Este script verifica e baixa novamente se necessário.

SDK_DIR="node_modules/@identy/identy-face/dist"
SDK_MAIN="$SDK_DIR/identy-face.js"

if [ -f "$SDK_MAIN" ] && [ -s "$SDK_MAIN" ]; then
  echo "[restore-identy-sdk] ✅ SDK dist/identy-face.js já existe ($(wc -c < "$SDK_MAIN") bytes)"
  exit 0
fi

echo "[restore-identy-sdk] ⚠️  dist/identy-face.js ausente ou vazio. Tentando restaurar..."

# Ler credenciais do .npmrc
NPMRC_FILE=".npmrc"
if [ ! -f "$NPMRC_FILE" ]; then
  echo "[restore-identy-sdk] ❌ .npmrc não encontrado"
  exit 1
fi

# Extrair senha base64 e username do .npmrc
PASSWORD_B64=$(grep '_password=' "$NPMRC_FILE" | head -1 | sed 's/.*_password=//')
USERNAME=$(grep 'username=' "$NPMRC_FILE" | head -1 | sed 's/.*username=//')

if [ -z "$PASSWORD_B64" ] || [ -z "$USERNAME" ]; then
  echo "[restore-identy-sdk] ❌ Credenciais JFrog não encontradas no .npmrc"
  exit 1
fi

PASSWORD=$(echo "$PASSWORD_B64" | base64 -d 2>/dev/null)

TARBALL_URL="https://identy.jfrog.io/identy/api/npm/identy-npm/@identy/identy-face/-/@identy/identy-face-6.3.0-b01.tgz"
TMP_FILE=$(mktemp /tmp/identy-face-XXXXXX.tgz)
TMP_DIR=$(mktemp -d /tmp/identy-extract-XXXXXX)

echo "[restore-identy-sdk] Baixando de JFrog..."
HTTP_CODE=$(curl -sL -o "$TMP_FILE" -w "%{http_code}" "$TARBALL_URL" -u "$USERNAME:$PASSWORD" 2>/dev/null)

if [ "$HTTP_CODE" != "200" ]; then
  echo "[restore-identy-sdk] ❌ Falha ao baixar (HTTP $HTTP_CODE)"
  rm -f "$TMP_FILE"
  rm -rf "$TMP_DIR"
  exit 1
fi

echo "[restore-identy-sdk] Extraindo..."
tar xzf "$TMP_FILE" -C "$TMP_DIR" 2>/dev/null

if [ ! -f "$TMP_DIR/package/dist/identy-face.js" ]; then
  echo "[restore-identy-sdk] ❌ identy-face.js não encontrado no tarball"
  rm -f "$TMP_FILE"
  rm -rf "$TMP_DIR"
  exit 1
fi

mkdir -p "$SDK_DIR"
cp -r "$TMP_DIR/package/dist/"* "$SDK_DIR/"

echo "[restore-identy-sdk] ✅ SDK restaurado com sucesso"
ls -la "$SDK_DIR/"

rm -f "$TMP_FILE"
rm -rf "$TMP_DIR"
