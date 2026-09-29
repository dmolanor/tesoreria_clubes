#!/usr/bin/env bash
# Comparte la app local por ngrok, protegida con usuario/clave.
#   npm run share       → build de producción + next start (estable, recomendado)
#   npm run share:dev   → next dev (recarga en caliente mientras iteramos)
# Variables opcionales: SHARE_USER, SHARE_PASSWORD (≥8 caracteres), NGROK_DOMAIN (dominio estático gratis de ngrok), PORT.
set -euo pipefail
cd "$(dirname "$0")/.."

MODE="${1:-prod}"
PORT="${PORT:-3000}"
SHARE_USER="${SHARE_USER:-raza}"
SHARE_PASSWORD="${SHARE_PASSWORD:-$(LC_ALL=C tr -dc 'a-km-zA-HJ-NP-Z2-9' </dev/urandom | head -c 12)}"

command -v ngrok >/dev/null || { echo "Falta ngrok: brew install ngrok"; exit 1; }
if ! ngrok config check >/dev/null 2>&1; then
  echo "ngrok no tiene authtoken. Corre: ngrok config add-authtoken <token>  (https://dashboard.ngrok.com/get-started/your-authtoken)"
  exit 1
fi
if lsof -ti tcp:"$PORT" >/dev/null 2>&1; then
  echo "El puerto $PORT está ocupado (¿otro 'npm run dev'?). Deténlo o usa PORT=3001 npm run share."
  exit 1
fi

[ -f .data/db.json ] || npm run seed

if [ "$MODE" = "dev" ]; then
  npx next dev -p "$PORT" &
else
  npx next build
  npx next start -p "$PORT" &
fi
APP_PID=$!
trap 'kill $APP_PID 2>/dev/null || true' EXIT INT TERM

echo
echo "────────────────────────────────────────────────"
echo " Usuario: $SHARE_USER"
echo " Clave:   $SHARE_PASSWORD"
echo " La URL pública aparece abajo (Forwarding)."
echo "────────────────────────────────────────────────"
echo

# ngrok v3.3x: la autenticación básica se declara como Traffic Policy.
POLICY="$(mktemp -t raza-ngrok-policy).yml"
cat > "$POLICY" <<YML
on_http_request:
  - actions:
      - type: basic-auth
        config:
          credentials:
            - "$SHARE_USER:$SHARE_PASSWORD"
YML
trap 'kill $APP_PID 2>/dev/null || true; rm -f "$POLICY"' EXIT INT TERM

ARGS=(http "$PORT" --traffic-policy-file "$POLICY")
[ -n "${NGROK_DOMAIN:-}" ] && ARGS+=(--url "$NGROK_DOMAIN")
ngrok "${ARGS[@]}"
