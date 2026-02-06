#!/bin/bash
set -euo pipefail

HOST1="${MONGO_HOST1:-mongo-1}"
HOST2="${MONGO_HOST2:-mongo-2}"
HOST3="${MONGO_HOST3:-mongo-3}"
ROOT_USER="${MONGO_INITDB_ROOT_USERNAME:-root}"
ROOT_PWD="${MONGO_INITDB_ROOT_PASSWORD:-secret}"
RS_NAME="${MONGO_REPLICA_SET_NAME:-rs0}"

echo "[rs-init] Waiting for mongod instances..."

# Wait for all hosts
for HOST in "$HOST1" "$HOST2" "$HOST3"; do
  echo "Checking $HOST..."
  until mongosh --quiet --host "$HOST" -u "$ROOT_USER" -p "$ROOT_PWD" --authenticationDatabase admin --eval 'db.runCommand("ping")' &>/dev/null; do
    echo "Waiting for $HOST..."
    sleep 2
  done
done

echo "[rs-init] All hosts are up. initiating replica set..."

# Check if already initialized
if mongosh --quiet --host "$HOST1" -u "$ROOT_USER" -p "$ROOT_PWD" --authenticationDatabase admin --eval 'rs.status().ok' 2>/dev/null | grep -q "1"; then
  echo "[rs-init] Replica set already initialized."
  exit 0
fi

# Initiate
mongosh --quiet --host "$HOST1" -u "$ROOT_USER" -p "$ROOT_PWD" --authenticationDatabase admin <<EOF
try {
  rs.initiate({
    _id: "$RS_NAME",
    members: [
      { _id: 0, host: "$HOST1:27017", priority: 2 },
      { _id: 1, host: "$HOST2:27017", priority: 1 },
      { _id: 2, host: "$HOST3:27017", priority: 1 }
    ]
  });
  print("[rs-init] rs.initiate() executed.");
} catch(e) {
  print("[rs-init] Error: " + e);
}
EOF

# Wait for Primary
echo "[rs-init] Waiting for Primary..."
until mongosh --quiet --host "$HOST1" -u "$ROOT_USER" -p "$ROOT_PWD" --authenticationDatabase admin --eval 'rs.isMaster().ismaster' | grep -q "true"; do
  sleep 2
  echo "Waiting for primary..."
done

echo "[rs-init] Replica Set Initialized & Primary Ready!"
