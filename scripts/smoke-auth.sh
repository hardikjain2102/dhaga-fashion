#!/usr/bin/env bash
# Black-box test of auth-svc over HTTP. Needs jq and a running server with the dev admin created.
set -u
command -v jq >/dev/null || { echo "jq is required: sudo apt-get install -y jq"; exit 1; }
BASE="${BASE:-http://localhost:8080}"
ADMIN_EMAIL="${ADMIN_EMAIL:-admin@dhaga.test}"
ADMIN_PASSWORD="${ADMIN_PASSWORD:-Admin@12345678}"
STAMP=$(date +%s)
PASS=0; FAIL=0; CODE=""; BODY=""
JSON=(-H "Content-Type: application/json")
JAR=$(mktemp); trap 'rm -f "$JAR" "$JAR.old"' EXIT

req()    { local m=$1 p=$2; shift 2; local out; out=$(curl -s -w $'\n%{http_code}' -X "$m" "$BASE$p" "$@"); CODE=${out##*$'\n'}; BODY=${out%$'\n'*}; }
check()  { if [ "$CODE" = "$2" ]; then echo "PASS  $1"; PASS=$((PASS+1)); else echo "FAIL  $1 (expected $2, got $CODE): $BODY"; FAIL=$((FAIL+1)); fi; }
expect() { if [ "$2" = "$3" ]; then echo "PASS  $1"; PASS=$((PASS+1)); else echo "FAIL  $1 (expected '$3', got '$2')"; FAIL=$((FAIL+1)); fi; }
b64()    { printf '%s' "$1" | base64 | tr -d '=\n' | tr '+/' '-_'; }

req GET /healthz; check "liveness" 200
req GET /readyz;  check "readiness (database reachable)" 200

# ----- signup rules -----
CEMAIL="cust$STAMP@dhaga.test"
req POST /api/auth/signup "${JSON[@]}" -d "{\"name\":\"Test Customer\",\"email\":\"$CEMAIL\",\"password\":\"Customer@1234\",\"role\":\"customer\"}"
check "signup customer" 201
expect "signup returns role customer" "$(echo "$BODY" | jq -r .user.role)" customer
CID=$(echo "$BODY" | jq -r .user.id)
req POST /api/auth/signup "${JSON[@]}" -d "{\"name\":\"Test Customer\",\"email\":\"$CEMAIL\",\"password\":\"Customer@1234\",\"role\":\"customer\"}"
check "duplicate email rejected" 409
req POST /api/auth/signup "${JSON[@]}" -d "{\"name\":\"Evil\",\"email\":\"evil$STAMP@dhaga.test\",\"password\":\"Customer@1234\",\"role\":\"admin\"}"
check "signup as admin rejected" 400
req POST /api/auth/signup "${JSON[@]}" -d "{\"name\":\"Evil\",\"email\":\"evil2$STAMP@dhaga.test\",\"password\":\"Customer@1234\",\"role\":\"seller\",\"sellerStatus\":\"approved\"}"
check "unknown fields rejected" 400
req POST /api/auth/signup "${JSON[@]}" -d "{\"name\":\"Short\",\"email\":\"short$STAMP@dhaga.test\",\"password\":\"abc\",\"role\":\"customer\"}"
check "short password rejected" 400
req POST /api/auth/signup "${JSON[@]}" -d '{"name":'
check "malformed JSON rejected" 400

# ----- login and tokens -----
req POST /api/auth/login "${JSON[@]}" -d "{\"email\":\"$CEMAIL\",\"password\":\"wrong-password\"}"
check "wrong password" 401
req POST /api/auth/login "${JSON[@]}" -d "{\"email\":\"nobody$STAMP@dhaga.test\",\"password\":\"whatever123\"}"
check "unknown email gives the same 401" 401
req POST /api/auth/login "${JSON[@]}" -c "$JAR" -d "{\"email\":\"$CEMAIL\",\"password\":\"Customer@1234\"}"
check "customer login" 200
TOKEN=$(echo "$BODY" | jq -r .accessToken)

req GET /api/auth/me -H "Authorization: Bearer $TOKEN";          check "me with token" 200
req GET /api/auth/me;                                             check "me without token" 401
req GET /api/auth/me -H "Authorization: Bearer ${TOKEN}x";        check "tampered token rejected" 401
FORGED="$(b64 '{"alg":"none","typ":"JWT"}').$(b64 '{"sub":"x","role":"admin","name":"x"}')."
req GET /api/auth/users -H "Authorization: Bearer $FORGED";       check "unsigned (alg=none) admin token rejected" 401
req GET /api/auth/users -H "Authorization: Bearer $TOKEN";        check "customer cannot list users" 403

# ----- refresh rotation and logout -----
cp "$JAR" "$JAR.old"
req POST /api/auth/refresh -b "$JAR" -c "$JAR";  check "refresh with cookie" 200
req POST /api/auth/refresh -b "$JAR.old";         check "already-used refresh token rejected" 401
req POST /api/auth/refresh;                        check "refresh without cookie" 401
req POST /api/auth/logout -b "$JAR" -c "$JAR";    check "logout" 204
req POST /api/auth/refresh -b "$JAR";              check "refresh after logout rejected" 401

# ----- admin and seller approval -----
req POST /api/auth/login "${JSON[@]}" -d "{\"email\":\"$ADMIN_EMAIL\",\"password\":\"$ADMIN_PASSWORD\"}"
check "admin login" 200
ATOKEN=$(echo "$BODY" | jq -r .accessToken)
req GET /api/auth/users -H "Authorization: Bearer $ATOKEN"; check "admin lists users" 200

SEMAIL="seller$STAMP@dhaga.test"
req POST /api/auth/signup "${JSON[@]}" -d "{\"name\":\"Test Seller\",\"email\":\"$SEMAIL\",\"password\":\"Seller@1234\",\"role\":\"seller\"}"
check "signup seller" 201
expect "new seller is pending" "$(echo "$BODY" | jq -r .user.sellerStatus)" pending
SID=$(echo "$BODY" | jq -r .user.id)
STOKEN=$(echo "$BODY" | jq -r .accessToken)

req PATCH "/api/auth/users/$SID/seller-status" "${JSON[@]}" -H "Authorization: Bearer $STOKEN" -d '{"status":"approved"}'
check "seller cannot approve themselves" 403
req PATCH "/api/auth/users/$SID/seller-status" "${JSON[@]}" -H "Authorization: Bearer $TOKEN" -d '{"status":"approved"}'
check "customer cannot approve a seller" 403
req PATCH "/api/auth/users/$SID/seller-status" "${JSON[@]}" -H "Authorization: Bearer $ATOKEN" -d '{"status":"pending"}'
check "status 'pending' cannot be set" 400
req PATCH "/api/auth/users/$SID/seller-status" "${JSON[@]}" -H "Authorization: Bearer $ATOKEN" -d '{"status":"approved"}'
check "admin approves seller" 200
req PATCH "/api/auth/users/$SID/seller-status" "${JSON[@]}" -H "Authorization: Bearer $ATOKEN" -d '{"status":"approved"}'
check "approving twice gives 409" 409
req PATCH "/api/auth/users/$CID/seller-status" "${JSON[@]}" -H "Authorization: Bearer $ATOKEN" -d '{"status":"approved"}'
check "customer has no seller status" 400
req PATCH "/api/auth/users/00000000-0000-4000-8000-000000000000/seller-status" "${JSON[@]}" -H "Authorization: Bearer $ATOKEN" -d '{"status":"approved"}'
check "unknown user" 404
req PATCH "/api/auth/users/not-a-uuid/seller-status" "${JSON[@]}" -H "Authorization: Bearer $ATOKEN" -d '{"status":"approved"}'
check "bad id format" 400
req PATCH "/api/auth/users/$SID/seller-status" "${JSON[@]}" -H "Authorization: Bearer $ATOKEN" -d '{"status":"suspended"}'
check "admin suspends seller" 200
req POST /api/auth/login "${JSON[@]}" -d "{\"email\":\"$SEMAIL\",\"password\":\"Seller@1234\"}"
check "suspended seller cannot log in" 403
req GET /nope; check "unknown route" 404

echo; echo "Passed: $PASS   Failed: $FAIL"
[ "$FAIL" -eq 0 ]
