require("dotenv").config();

const mongoose = require("mongoose");

// ======================================================
// CONFIG
// ======================================================

const COLLECTION_NAME = "placementbillings";

const INDEX_NAME = "invoiceNumber_1";

// ======================================================
// CHECK INDEX
// ======================================================

const isCorrectInvoiceIndex = (index) => {
  if (!index) {
    return false;
  }

  return (
    index.unique === true &&
    index.sparse !== true &&
    index.key?.invoiceNumber === 1 &&
    index.partialFilterExpression?.invoiceNumber?.$type === "string"
  );
};

// ======================================================
// FIND DUPLICATE REAL INVOICE NUMBERS
// ======================================================

const findDuplicateInvoiceNumbers = async (collection) => {
  return collection
    .aggregate([
      {
        $match: {
          invoiceNumber: {
            $type: "string",
          },
        },
      },

      {
        $group: {
          _id: "$invoiceNumber",

          count: {
            $sum: 1,
          },

          billingIds: {
            $push: "$billingId",
          },
        },
      },

      {
        $match: {
          count: {
            $gt: 1,
          },
        },
      },
    ])
    .toArray();
};

// ======================================================
// MIGRATION
// ======================================================

const migrate = async () => {
  if (!process.env.MONGO_URI) {
    throw new Error("MONGO_URI is not configured.");
  }

  console.log("Connecting to MongoDB...");

  await mongoose.connect(process.env.MONGO_URI);

  console.log("MongoDB connected.");

  const db = mongoose.connection.db;

  const collectionExists = await db
    .listCollections({
      name: COLLECTION_NAME,
    })
    .hasNext();

  if (!collectionExists) {
    console.log(`${COLLECTION_NAME} does not exist. Creating collection.`);

    await db.createCollection(COLLECTION_NAME);
  }

  const collection = db.collection(COLLECTION_NAME);

  // ====================================================
  // SAFETY CHECK
  // ====================================================

  console.log("Checking duplicate real invoice numbers...");

  const duplicates = await findDuplicateInvoiceNumbers(collection);

  if (duplicates.length > 0) {
    console.error("Migration aborted. Duplicate real invoice numbers exist:");

    console.error(JSON.stringify(duplicates, null, 2));

    throw new Error(
      "Resolve duplicate invoice numbers before migrating the index.",
    );
  }

  console.log("No duplicate real invoice numbers found.");

  // ====================================================
  // CURRENT INDEX
  // ====================================================

  const indexes = await collection.indexes();

  const existingIndex = indexes.find((index) => index.name === INDEX_NAME);

  if (isCorrectInvoiceIndex(existingIndex)) {
    console.log(`${INDEX_NAME} is already configured correctly.`);

    console.log(existingIndex);

    return;
  }

  // ====================================================
  // DROP OLD INDEX
  // ====================================================

  if (existingIndex) {
    console.log(`Dropping old ${INDEX_NAME} index...`);

    await collection.dropIndex(INDEX_NAME);

    console.log(`Old ${INDEX_NAME} index removed.`);
  } else {
    console.log(`${INDEX_NAME} does not currently exist.`);
  }

  // ====================================================
  // CREATE CORRECT INDEX
  // ====================================================

  console.log("Creating partial unique invoice number index...");

  await collection.createIndex(
    {
      invoiceNumber: 1,
    },
    {
      name: INDEX_NAME,

      unique: true,

      partialFilterExpression: {
        invoiceNumber: {
          $type: "string",
        },
      },
    },
  );

  // ====================================================
  // VERIFY
  // ====================================================

  const updatedIndexes = await collection.indexes();

  const updatedInvoiceIndex = updatedIndexes.find(
    (index) => index.name === INDEX_NAME,
  );

  if (!isCorrectInvoiceIndex(updatedInvoiceIndex)) {
    throw new Error(
      "Invoice number index migration completed but verification failed.",
    );
  }

  console.log("Invoice number index successfully migrated.");

  console.log(updatedInvoiceIndex);
};

// ======================================================
// RUN
// ======================================================

(async () => {
  try {
    await migrate();

    console.log(
      "Placement billing invoice index migration completed successfully.",
    );

    process.exitCode = 0;
  } catch (error) {
    console.error("PLACEMENT BILLING INVOICE INDEX MIGRATION ERROR:");

    console.error(error);

    process.exitCode = 1;
  } finally {
    try {
      await mongoose.disconnect();
    } catch (disconnectError) {
      console.error("MongoDB disconnect error:", disconnectError);

      process.exitCode = 1;
    }
  }
})();
