#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/../.."
promo_output=build/promo-preview
mkdir -p "$promo_output"
promo_tmp=$(mktemp -d)
trap 'rm -rf "$promo_tmp"; agent-browser --session shimo-promos close >/dev/null 2>&1 || true' EXIT
promo_base=http://127.0.0.1:54093/promo.html
agent-browser --session shimo-promos set viewport 1280 800
for promo_asset in feat1 feat2 feat3 feat4; do
  agent-browser --session shimo-promos open "$promo_base?asset=$promo_asset"
  agent-browser --session shimo-promos wait --fn 'document.body.dataset.ready === "true"'
  agent-browser --session shimo-promos screenshot "$promo_output/$promo_asset.png"
  cwebp -quiet -q 90 "$promo_output/$promo_asset.png" -o "$promo_output/$promo_asset.webp"
done
for promo_asset in banner-L banner-S; do
  if [[ "$promo_asset" == banner-L ]]; then
    agent-browser --session shimo-promos set viewport 1400 560
  else
    agent-browser --session shimo-promos set viewport 440 280
  fi
  agent-browser --session shimo-promos open "$promo_base?asset=$promo_asset"
  agent-browser --session shimo-promos wait --fn 'document.body.dataset.ready === "true"'
  agent-browser --session shimo-promos screenshot "$promo_tmp/$promo_asset.png"
  sips -s format jpeg -s formatOptions 90 "$promo_tmp/$promo_asset.png" --out "$promo_output/$promo_asset.jpg" >/dev/null
done
