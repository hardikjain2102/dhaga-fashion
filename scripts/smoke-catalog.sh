#!/usr/bin/env bash
# Black-box test of catalog-svc (and its link to auth-svc). Needs jq, both servers running,
# the dev admin created, and INTERNAL_API_SECRET exported.
set -u
command -v jq >/dev/null || { echo "jq is required: sudo apt-get install -y jq"; exit 1; }
: "${INTERNAL_API_SECRET:?export INTERNAL_API_SECRET first (see the instructions)}"
AUTH="${AUTH:-http://localhost:8080}"
CAT="${CAT:-http://localhost:8081}"
ADMIN_EMAIL="${ADMIN_EMAIL:-admin@dhaga.test}"
ADMIN_PASSWORD="${ADMIN_PASSWORD:-Admin@12345678}"
STAMP=$(date +%s)
PASS=0; FAIL=0; CODE=""; BODY=""
JSON=(-H "Content-Type: application/json")
IH=(-H "x-internal-secret: $INTERNAL_API_SECRET")

rq()     { local base=$1 m=$2 p=$3; shift 3; local out; out=$(curl -s -w $'\n%{http_code}' -X "$m" "$base$p" "$@"); CODE=${out##*$'\n'}; BODY=${out%$'\n'*}; }
A()      { rq "$AUTH" "$@"; }
C()      { rq "$CAT" "$@"; }
check()  { if [ "$CODE" = "$2" ]; then echo "PASS  $1"; PASS=$((PASS+1)); else echo "FAIL  $1 (expected $2, got $CODE): $BODY"; FAIL=$((FAIL+1)); fi; }
expect() { if [ "$2" = "$3" ]; then echo "PASS  $1"; PASS=$((PASS+1)); else echo "FAIL  $1 (expected '$3', got '$2')"; FAIL=$((FAIL+1)); fi; }
signup() { A POST /api/auth/signup "${JSON[@]}" -d "{\"name\":\"$1 $STAMP\",\"email\":\"$2\",\"password\":\"Passw0rd@123\",\"role\":\"$3\"}"; TOK=$(echo "$BODY" | jq -r .accessToken); USER_ID=$(echo "$BODY" | jq -r .user.id); }
stock()  { C GET "/api/products/$1"; echo "$BODY" | jq -r --arg s "$2" '.sizes[] | select(.size==$s) | .stock'; }
reserve(){ C POST /internal/stock/reserve "${JSON[@]}" "${IH[@]}" -d "{\"orderId\":\"$1\",\"items\":[{\"productId\":\"$2\",\"size\":\"$3\",\"quantity\":$4}]}"; }
ref()    { C POST "/internal/stock/$1" "${JSON[@]}" "${IH[@]}" -d "{\"orderId\":\"$2\"}"; }

P1='{"name":"Indigo Kurta Test","category":"Kurta","price":1899,"description":"Hand block-printed cotton kurta.","swatch":"#3b4a6b","sizes":[{"size":"S","stock":5},{"size":"M","stock":5}]}'
P1B='{"name":"Indigo Kurta Test","category":"Kurta","price":1899,"description":"Hand block-printed cotton kurta.","swatch":"#3b4a6b","sizes":[{"size":"S","stock":5},{"size":"M","stock":9}]}'
P1ADMIN='{"name":"Indigo Kurta Test","category":"Kurta","price":1999,"description":"Hand block-printed cotton kurta.","swatch":"#3b4a6b","sizes":[{"size":"S","stock":5},{"size":"M","stock":9}]}'
P2='{"name":"Last One Saree","category":"Saree","price":4599,"description":"Only a single piece available.","swatch":"#e9e1cf","sizes":[{"size":"L","stock":1}]}'
P3='{"name":"Moderation Target","category":"Dupatta","price":799,"description":"Will be removed by an admin.","swatch":"#b5573d","sizes":[{"size":"Free","stock":3}]}'
P4='{"name":"Delete Me Shirt","category":"Shirt","price":1499,"description":"Will be removed by its owner.","swatch":"#8a9a7b","sizes":[{"size":"M","stock":2}]}'

C GET /healthz; check "catalog liveness" 200
C GET /readyz;  check "catalog readiness (database reachable)" 200

# ----- accounts -----
A POST /api/auth/login "${JSON[@]}" -d "{\"email\":\"$ADMIN_EMAIL\",\"password\":\"$ADMIN_PASSWORD\"}"
check "admin login" 200; ATOK=$(echo "$BODY" | jq -r .accessToken)
signup "Seller A" "sa$STAMP@dhaga.test" seller;     SATOK=$TOK; SAID=$USER_ID
signup "Seller B" "sb$STAMP@dhaga.test" seller;     SBTOK=$TOK; SBID=$USER_ID
signup "Seller C" "sc$STAMP@dhaga.test" seller;     SCTOK=$TOK
signup "Customer" "cu$STAMP@dhaga.test" customer;   CUTOK=$TOK
for id in "$SAID" "$SBID"; do
  A PATCH "/api/auth/users/$id/seller-status" "${JSON[@]}" -H "Authorization: Bearer $ATOK" -d '{"status":"approved"}'
  check "admin approves a seller" 200
done

# ----- who may create -----
C POST /api/products "${JSON[@]}" -d "$P1";                                    check "create without token" 401
C POST /api/products "${JSON[@]}" -H "Authorization: Bearer ${SATOK}x" -d "$P1"; check "create with tampered token" 401
C POST /api/products "${JSON[@]}" -H "Authorization: Bearer $CUTOK" -d "$P1";   check "customer cannot create" 403
C POST /api/products "${JSON[@]}" -H "Authorization: Bearer $SCTOK" -d "$P1";   check "PENDING seller cannot create" 403
C POST /api/products "${JSON[@]}" -H "Authorization: Bearer $ATOK" -d "$P1";    check "admin cannot create" 403

# ----- validation -----
AUTHH=(-H "Authorization: Bearer $SATOK")
C POST /api/products "${JSON[@]}" "${AUTHH[@]}" -d "${P1/1899/18.5}";             check "fractional price rejected" 400
C POST /api/products "${JSON[@]}" "${AUTHH[@]}" -d "${P1/Indigo Kurta Test/ab}";   check "short name rejected" 400
C POST /api/products "${JSON[@]}" "${AUTHH[@]}" -d "${P1/Kurta\",\"price/Hat\",\"price}"; check "unknown category rejected" 400
C POST /api/products "${JSON[@]}" "${AUTHH[@]}" -d "${P1/#3b4a6b/red}";            check "bad colour rejected" 400
C POST /api/products "${JSON[@]}" "${AUTHH[@]}" -d "${P1/\"size\":\"M\"/\"size\":\"s\"}"; check "duplicate size (case-insensitive) rejected" 400
C POST /api/products "${JSON[@]}" "${AUTHH[@]}" -d "${P1/\"name\"/\"sellerId\":\"$SBID\",\"name\"}"; check "client-supplied sellerId rejected" 400

# ----- create and read -----
C POST /api/products "${JSON[@]}" "${AUTHH[@]}" -d "$P1"; check "approved seller creates product" 201
PID=$(echo "$BODY" | jq -r .id)
expect "owner is taken from the token" "$(echo "$BODY" | jq -r .sellerId)" "$SAID"
expect "two sizes stored in order" "$(echo "$BODY" | jq -r '[.sizes[].size] | join(",")')" "S,M"

C GET "/api/products/$PID";                         check "public read (no token)" 200
C GET "/api/products?q=indigo kurta test";          expect "search finds it" "$(echo "$BODY" | jq --arg id "$PID" 'map(select(.id==$id)) | length')" 1
C GET "/api/products?q=zzzzqqq";                    expect "search with no match" "$(echo "$BODY" | jq length)" 0
C GET "/api/products?q=%25";                        expect "LIKE wildcard is escaped" "$(echo "$BODY" | jq length)" 0
C GET "/api/products?category=Kurta";               expect "category filter" "$(echo "$BODY" | jq --arg id "$PID" 'map(select(.id==$id)) | length')" 1
C GET "/api/products?category=Hat";                 check "invalid category rejected" 400
C GET "/api/products/not-a-uuid";                   check "bad id format" 400
C GET "/api/products/00000000-0000-4000-8000-000000000000"; check "unknown product" 404
C GET /api/products/mine -H "Authorization: Bearer $SATOK"; expect "seller sees own products" "$(echo "$BODY" | jq --arg id "$PID" 'map(select(.id==$id)) | length')" 1
C GET /api/products/mine -H "Authorization: Bearer $SBTOK"; expect "other seller sees none of them" "$(echo "$BODY" | jq length)" 0
C GET /api/products/mine;                           check "mine needs a token" 401

# ----- ownership -----
C PUT "/api/products/$PID" "${JSON[@]}" -H "Authorization: Bearer $SBTOK" -d "$P1B";  check "other seller cannot edit" 403
C DELETE "/api/products/$PID" -H "Authorization: Bearer $SBTOK";                       check "other seller cannot delete" 403
C PUT "/api/products/$PID" "${JSON[@]}" -H "Authorization: Bearer $CUTOK" -d "$P1B";  check "customer cannot edit" 403
C PUT "/api/products/$PID" "${JSON[@]}" "${AUTHH[@]}" -d "$P1B";                      check "owner edits stock" 200
expect "stock M is now 9" "$(stock "$PID" M)" 9
C PUT "/api/products/$PID" "${JSON[@]}" -H "Authorization: Bearer $ATOK" -d "$P1ADMIN"; check "admin can edit any product" 200
expect "admin's price change saved" "$(echo "$BODY" | jq -r .price)" 1999
expect "owner is unchanged by admin edit" "$(echo "$BODY" | jq -r .sellerId)" "$SAID"

C POST /api/products "${JSON[@]}" "${AUTHH[@]}" -d "$P3"; PID3=$(echo "$BODY" | jq -r .id)
C DELETE "/api/products/$PID3" -H "Authorization: Bearer $ATOK"; check "admin removes any product" 204
C GET "/api/products/$PID3"; check "removed product is gone" 404
C POST /api/products "${JSON[@]}" "${AUTHH[@]}" -d "$P4"; PID4=$(echo "$BODY" | jq -r .id)
C DELETE "/api/products/$PID4" "${AUTHH[@]}"; check "owner deletes own product" 204

# ----- internal stock API -----
RES_BODY="{\"orderId\":\"x\",\"items\":[{\"productId\":\"$PID\",\"size\":\"M\",\"quantity\":1}]}"
C POST /internal/stock/reserve "${JSON[@]}" -d "$RES_BODY";                                  check "internal call without secret" 401
C POST /internal/stock/reserve "${JSON[@]}" -H "x-internal-secret: wrong" -d "$RES_BODY";    check "internal call with wrong secret" 401
C POST /internal/stock/reserve "${JSON[@]}" -H "Authorization: Bearer $ATOK" -d "$RES_BODY"; check "an admin token is not an internal secret" 401

reserve "o$STAMP-a" "$PID" M 2;   check "reserve 2 of M" 200
expect "reserve returns the seller snapshot" "$(echo "$BODY" | jq -r '.items[0].sellerId')" "$SAID"
expect "reserve returns the unit price" "$(echo "$BODY" | jq -r '.items[0].unitPrice')" 1999
expect "stock M dropped to 7" "$(stock "$PID" M)" 7
reserve "o$STAMP-a" "$PID" M 1;   check "same order cannot reserve twice" 409
reserve "o$STAMP-b" "$PID" M 99;  check "cannot reserve more than the stock" 409
expect "failed reserve changed nothing" "$(stock "$PID" M)" 7
reserve "o$STAMP-c" "$PID" XXL 1; check "unknown size" 404
ref release "o$STAMP-a";           check "release" 200
expect "stock M is back to 9" "$(stock "$PID" M)" 9
ref release "o$STAMP-a";           check "release twice is safe" 200
expect "second release did not add stock again" "$(stock "$PID" M)" 9
reserve "o$STAMP-d" "$PID" M 1;   check "reserve for a paid order" 200
ref commit "o$STAMP-d";            check "commit" 200
ref release "o$STAMP-d";           check "a paid order cannot be released" 409
expect "paid stock stays sold" "$(stock "$PID" M)" 8
ref release "o$STAMP-nope";        check "release unknown order" 404

# ----- the last-item race: 5 buyers, 1 item -----
C POST /api/products "${JSON[@]}" "${AUTHH[@]}" -d "$P2"; PID2=$(echo "$BODY" | jq -r .id)
T=$(mktemp -d)
for i in 1 2 3 4 5; do
  curl -s -o /dev/null -w '%{http_code}\n' -X POST "$CAT/internal/stock/reserve" "${JSON[@]}" "${IH[@]}" \
    -d "{\"orderId\":\"o$STAMP-race$i\",\"items\":[{\"productId\":\"$PID2\",\"size\":\"L\",\"quantity\":1}]}" > "$T/$i" &
done
wait
expect "exactly one of 5 racing buyers got the last item" "$(cat "$T"/* | grep -c '^200$')" 1
expect "the other four were refused" "$(cat "$T"/* | grep -c '^409$')" 4
rm -rf "$T"
expect "stock never went negative" "$(stock "$PID2" L)" 0

# ----- the 15-minute hole is closed: suspend, then reuse the OLD token -----
A PATCH "/api/auth/users/$SAID/seller-status" "${JSON[@]}" -H "Authorization: Bearer $ATOK" -d '{"status":"suspended"}'
check "admin suspends Seller A" 200
C POST /api/products "${JSON[@]}" "${AUTHH[@]}" -d "$P4";                         check "suspended seller cannot create (old token still valid)" 403
C PUT "/api/products/$PID" "${JSON[@]}" "${AUTHH[@]}" -d "$P1B";                  check "suspended seller cannot edit (old token still valid)" 403
C DELETE "/api/products/$PID" "${AUTHH[@]}";                                       check "suspended seller cannot delete" 403
C GET "/api/products/$PID";                                                        check "browsing still works" 200
A PATCH "/api/auth/users/$SAID/seller-status" "${JSON[@]}" -H "Authorization: Bearer $ATOK" -d '{"status":"approved"}'
check "reinstated" 200
C PUT "/api/products/$PID" "${JSON[@]}" "${AUTHH[@]}" -d "$P1B";                  check "reinstated seller can edit again" 200

# ----- the auth-svc internal endpoint itself -----
A GET "/internal/sellers/$SAID/status";                                            check "auth internal endpoint without secret" 401
A GET "/internal/sellers/$SAID/status" "${IH[@]}";                                 expect "auth internal endpoint answers" "$(echo "$BODY" | jq -r .status)" approved
C GET /nope; check "unknown route" 404

echo; echo "Passed: $PASS   Failed: $FAIL"
[ "$FAIL" -eq 0 ]
