#!/bin/bash
# mongo-init.sh

set -e

echo "Starting replica set initialization "

# Note: No need user/password here because this script is run by the
# entrypoint *before* auth is turned on.
mongosh <<EOF
  var cfg = {
    "_id": "rs0",
    "members": [
      {
        "_id": 0,
        "host": "mongo:27017"
      }
    ]
  };

  try {
    console.log("Attempting to initiate replica set...");
    rs.initiate(cfg);
    console.log("Replica set initiated.");
  } catch (e) {
    if (e.message.indexOf("already initialized") !== -1) {
      console.log("Replica set already initialized. No action needed.");
    } else {
      throw e; // re-throw other errors
    }
  }

  console.log("Waiting for primary to be elected...");
  while (!db.isMaster().ismaster) {
    sleep(1000);
  }
  console.log("Primary elected. Initialization complete.");
EOF

echo "MongoDB replica set initialization script finished."