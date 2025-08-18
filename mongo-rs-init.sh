#!/bin/bash
set -euo pipefail

HOST="${MONGO_HOST:-mongo}"
ROOT_USER="${MONGO_INITDB_ROOT_USERNAME:-root}"
ROOT_PWD="${MONGO_INITDB_ROOT_PASSWORD:-secret}"
RS_NAME="${MONGO_REPLICA_SET_NAME:-rs0}"

echo "[rs-init] Waiting for mongod on $HOST:27017 to have replication enabled"
ATTEMPTS=0
MAX_ATTEMPTS=120
while true; do
  ATTEMPTS=$((ATTEMPTS+1))
  if mongosh --quiet --host "$HOST" -u "$ROOT_USER" -p "$ROOT_PWD" --authenticationDatabase admin --eval 'db.hello().setName' 2>/dev/null | grep -q "$RS_NAME"; then
    echo "[rs-init] mongod reports setName=$RS_NAME (already initiated)"; exit 0; fi
  # Check if rs.status gives NotYetInitialized (code 94) or node is reachable
  if mongosh --quiet --host "$HOST" -u "$ROOT_USER" -p "$ROOT_PWD" --authenticationDatabase admin --eval 'try { st=rs.status(); printjson(st); } catch(e){ printjson(e); }' | grep -q 'NotYetInitialized'; then
    echo "[rs-init] Replica set not yet initialized, proceeding"; break
  fi
  if [ "$ATTEMPTS" -ge "$MAX_ATTEMPTS" ]; then
    echo "[rs-init] Timed out waiting for mongod to become reachable with replication enabled" >&2; exit 1; fi
  sleep 1
done

echo "[rs-init] Running rs.initiate({_id: \"$RS_NAME\", members:[{_id:0, host: \"$HOST:27017\"}]})"
set +e
INIT_OUTPUT=$(mongosh --quiet --host "$HOST" -u "$ROOT_USER" -p "$ROOT_PWD" --authenticationDatabase admin --eval "try { rs.initiate({_id:'$RS_NAME',members:[{_id:0,host:'$HOST:27017'}]}) } catch(e){ printjson(e); }")
RC=$?
set -e

echo "$INIT_OUTPUT"
if echo "$INIT_OUTPUT" | grep -q 'already initialized'; then
  echo "[rs-init] Replica set already initialized"; exit 0; fi
if [ $RC -ne 0 ]; then
  echo "[rs-init] rs.initiate returned non-zero exit code $RC" >&2
  # Still continue to check status below
fi

sleep 3
mongosh --quiet --host "$HOST" -u "$ROOT_USER" -p "$ROOT_PWD" --authenticationDatabase admin --eval 'try { st=rs.status(); printjson({myState:st.myState, members: st.members.map(m=>({id:m._id,name:m.name,state:m.stateStr}))}) } catch(e){ printjson(e); }'

# Wait until PRIMARY state (1) to exit success so dependents can rely on full readiness
ATTEMPTS=0
while true; do
  STATE=$(mongosh --quiet --host "$HOST" -u "$ROOT_USER" -p "$ROOT_PWD" --authenticationDatabase admin --eval 'try { rs.status().myState } catch(e){ print(-1) }') || true
  if [ "$STATE" = "1" ]; then
    echo "[rs-init] PRIMARY achieved"; break; fi
  ATTEMPTS=$((ATTEMPTS+1))
  if [ $ATTEMPTS -ge 60 ]; then
    echo "[rs-init] Timed out waiting for PRIMARY state (current $STATE)" >&2; exit 1; fi
  sleep 2
  echo "[rs-init] Waiting for PRIMARY (current state=$STATE)"

done

echo "[rs-init] Replica set initialization completed successfully"
