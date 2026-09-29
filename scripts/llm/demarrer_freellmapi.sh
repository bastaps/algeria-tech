#!/usr/bin/env bash
# Démarre le routeur FreeLLMAPI (image Docker officielle) sur le runner GitHub,
# avec les clés gratuites passées en secrets, puis exporte pour les étapes
# suivantes : FREELLMAPI_URL (compatible OpenAI) et FREELLMAPI_KEY (masquée).
# Le routeur choisit le meilleur modèle disponible et bascule tout seul sur un
# autre fournisseur quand l'un est saturé (Gemini, Groq, Mistral, OpenRouter…).
set -euo pipefail

ADMIN_MAIL="robot@algeria-tech.local"
ADMIN_PASS="$(openssl rand -hex 16)"
export ADMIN_MAIL ADMIN_PASS
CONFIG="$(python3 - <<'EOF'
import json, os
cles = []
for plateforme, var in (("google", "GEMINI_API_KEY"), ("groq", "GROQ_API_KEY"),
                        ("mistral", "MISTRAL_API_KEY"), ("openrouter", "OPENROUTER_API_KEY"),
                        ("huggingface", "HF_TOKEN")):
    v = (os.environ.get(var) or "").strip()
    if v:
        cles.append({"platform": plateforme, "key": v, "label": "algeria-tech"})
print(json.dumps({"admin": {"email": os.environ["ADMIN_MAIL"], "password": os.environ["ADMIN_PASS"]},
                  "keys": cles, "routing": {"strategy": "balanced"}}))
EOF
)"

docker run -d --name freellmapi -p 127.0.0.1:3001:3001 \
  -e ENCRYPTION_KEY="$(openssl rand -hex 32)" -e PORT=3001 -e NODE_ENV=production \
  -e FREEAPI_CONFIG_JSON="$CONFIG" \
  ghcr.io/tashfeenahmed/freellmapi:latest > /dev/null

for i in $(seq 1 60); do
  code=$(curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:3001/v1/models || true)
  [ "$code" = "401" ] || [ "$code" = "200" ] && break
  sleep 3
done

TOKEN=$(curl -s -X POST http://127.0.0.1:3001/api/auth/login -H "Content-Type: application/json" \
  -d "{\"email\":\"$ADMIN_MAIL\",\"password\":\"$ADMIN_PASS\"}" | python3 -c "import json,sys;print(json.load(sys.stdin)['token'])")
CLE=$(curl -s http://127.0.0.1:3001/api/settings/api-key -H "Authorization: Bearer $TOKEN" \
  | python3 -c "import json,sys;print(json.load(sys.stdin)['apiKey'])")
echo "::add-mask::$CLE"
echo "FREELLMAPI_URL=http://127.0.0.1:3001/v1" >> "$GITHUB_ENV"
echo "FREELLMAPI_KEY=$CLE" >> "$GITHUB_ENV"
echo "FreeLLMAPI prêt ($(docker logs freellmapi 2>&1 | grep -ci 'key' ) lignes de configuration)"
