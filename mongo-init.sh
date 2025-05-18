#!/bin/bash
set -e # Script stops if any command fails

# Wait for MongoDB to be ready before configuring replica set
until mongosh --eval "db.adminCommand('ping')" --quiet -u root -p secret; do
  echo "Waiting for MongoDB to be ready..."
  sleep 3 # Wait for 3 secs before retrying 
done

echo "MongoDB started, checking replica set status..."

# hostname that should be used in the replica set config
# using the container name as the hostname
HOSTNAME="mongo"

# Check if replica set is already initialized
RS_STATUS=$(mongosh admin --eval "try { rs.status() } catch(err) { quit(1) }" --quiet -u root -p secret || echo "NOT_INITIALIZED")

# Initialize replica set if it isn't alreadyu 
if [[ $RS_STATUS == "NOT_INITIALIZED" ]]; then
  echo "Initializing replica set with hostname: $HOSTNAME"
  mongosh admin --eval "rs.initiate({_id: 'rs0', members: [{_id: 0, host: '$HOSTNAME:27017'}]})" --quiet -u root -p secret
  
  # Wait for replica set to initialize
  until mongosh admin --eval "rs.status().ok" --quiet -u root -p secret | grep -q 1; do
    echo "Waiting for replica set to initialize..."
    sleep 2
  done
  
  echo "Replica set initialized successfully!"
else
  echo "Replica set is already initialized. Checking configuration..."
  # Check if the configuration uses the correct hostname, update if needed
  CURRENT_HOST=$(mongosh admin --eval "printjson(rs.conf().members[0].host)" --quiet -u root -p secret)
  if [[ $CURRENT_HOST != *"$HOSTNAME"* ]]; then
    echo "Updating replica set config to use hostname: $HOSTNAME"
    mongosh admin --eval "var conf = rs.conf(); conf.members[0].host = '$HOSTNAME:27017'; rs.reconfig(conf)" --quiet -u root -p secret
    echo "Replica set configuration updated."
  fi
fi

# Wait for the primary to be elected
until mongosh admin --eval "rs.isMaster().ismaster" --quiet -u root -p secret | grep -q true; do
  echo "Waiting for primary to be elected..."
  sleep 2
done

echo "MongoDB replica set is fully configured and ready!"

