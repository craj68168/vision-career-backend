require("dotenv").config();

const mongoose = require("mongoose");

const PlacementCandidate = require("../models/placements/placementCandidateSchema");

const {
  syncSeekerPlacementStatus,
} = require("../utils/syncSeekerPlacementStatus");

const run = async () => {
  try {
    if (!process.env.MONGO_URI) {
      throw new Error("MONGO_URI is missing in .env");
    }

    await mongoose.connect(process.env.MONGO_URI);

    console.log("MongoDB connected.");

    const seekerIds = await PlacementCandidate.distinct("seekerId");

    console.log(
      `Found ${seekerIds.length} seeker(s) with placement candidate records.`,
    );

    for (const seekerId of seekerIds) {
      const result = await syncSeekerPlacementStatus(seekerId);

      if (result) {
        console.log(`${result.seekerId} -> ${result.placementStatus}`);
      }
    }

    console.log("Placement statuses synchronized.");
  } catch (error) {
    console.error("Placement status synchronization failed:", error);

    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
  }
};

void run();
