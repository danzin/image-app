print("ℹ️ Starting mongo-init.js script for replica set initialization...");

print("⏳ Waiting for MongoDB to be fully ready...");
sleep(10000);

function sleep(ms) {
  print(`Sleeping for ${ms}ms...`);
  const start = new Date().getTime();
  while (new Date().getTime() < start + ms) {}
  print("Waking up...");
}

try {
  print("🔄 Checking replica set status...");
  const rsStatus = rs.status();
  printjson(rsStatus);

  if (rsStatus.ok) {
    print("✅ Replica set is already initialized and running!");
  } else {
    print("⚠️ Replica set status returned unexpected result.");
  }
} catch (e) {
  print(`ℹ️ Replica set is not initialized yet: ${e}`);

  print("🚀 Initializing replica set...");
  const config = {
    _id: "rs0",
    members: [{ _id: 0, host: "mongo:27017" }],
  };

  printjson(config);

  try {
    const result = rs.initiate(config);
    printjson(result);

    if (result.ok) {
      print("✅ Replica set initiated successfully!");

      print("⏳ Waiting for replica set to stabilize...");
      sleep(10000);

      try {
        print("Final replica set status:");
        printjson(rs.status());
      } catch (statusErr) {
        print(`⚠️ Error checking final status: ${statusErr}`);
      }
    } else {
      print("❌ Failed to initiate replica set:");
      printjson(result);
    }
  } catch (initErr) {
    print(`❌ Error during replica set initiation: ${initErr}`);
  }
}

print("ℹ️ mongo-init.js completed.");
