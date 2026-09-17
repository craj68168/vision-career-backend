const PlacementCandidate = require("../models/placements/placementCandidateSchema");

const Seeker = require("../models/seekers/seekerSchema");

// ======================================================
// STATUS PRIORITY
//
// A seeker can exist in multiple placement requests.
//
// Example:
//
// Request A -> PLACED
// Request B -> REJECTED
//
// Result must remain:
//
// placement_status = placed
//
// Priority:
//
// PLACED
// SELECTED
// INTERVIEW
// MATCHED / UNDER_REVIEW
// otherwise UNPLACED
// ======================================================

const calculatePlacementStatus = (statuses) => {
  if (statuses.includes("PLACED")) {
    return "placed";
  }

  if (statuses.includes("SELECTED")) {
    return "selected";
  }

  if (statuses.includes("INTERVIEW")) {
    return "interview";
  }

  if (statuses.includes("MATCHED") || statuses.includes("UNDER_REVIEW")) {
    return "matching";
  }

  return "unplaced";
};

// ======================================================
// SYNC SEEKER PLACEMENT STATUS
// ======================================================

const syncSeekerPlacementStatus = async (seekerId) => {
  if (!seekerId) {
    return null;
  }

  // Get every placement status for this seeker.
  //
  // REJECTED records can exist here, but they do not
  // automatically make the seeker "unplaced" because
  // another request may still be active or placed.

  const statuses = await PlacementCandidate.distinct("status", {
    seekerId,
  });

  const placementStatus = calculatePlacementStatus(statuses);

  const seeker = await Seeker.findOneAndUpdate(
    {
      seeker_id: seekerId,
    },
    {
      $set: {
        placement_status: placementStatus,
      },
    },
    {
      new: true,
    },
  );

  if (!seeker) {
    console.warn(
      `Seeker not found while syncing placement status: ${seekerId}`,
    );

    return null;
  }

  return {
    seekerId,
    placementStatus,
  };
};

module.exports = {
  calculatePlacementStatus,
  syncSeekerPlacementStatus,
};
