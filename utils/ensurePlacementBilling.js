const crypto = require("crypto");

const PlacementBilling = require("../models/placements/placementBillingSchema");

const PlacementCandidate = require("../models/placements/placementCandidateSchema");

const Recruit = require("../models/providers/recruitSchema");

const Register = require("../models/providers/registerSchema");

// ======================================================
// GENERATE BILLING ID
// ======================================================

const generateBillingId = async () => {
  for (let attempt = 0; attempt < 10; attempt += 1) {
    const billingId = `PB-${crypto
      .randomBytes(4)
      .toString("hex")
      .toUpperCase()}`;

    const exists = await PlacementBilling.exists({
      billingId,
    });

    if (!exists) {
      return billingId;
    }
  }

  throw new Error("Unable to generate billing ID.");
};

// ======================================================
// ENSURE BILLING EXISTS
// ======================================================

const ensurePlacementBilling = async (placementCandidate) => {
  if (!placementCandidate || placementCandidate.status !== "PLACED") {
    return null;
  }

  const existing = await PlacementBilling.findOne({
    placementCandidateId: placementCandidate.placementCandidateId,
  });

  if (existing) {
    return existing;
  }

  const recruit = await Recruit.findOne({
    recruitId: placementCandidate.recruitId,
  });

  if (!recruit) {
    throw new Error(`Recruit not found for ${placementCandidate.recruitId}`);
  }

  const provider = await Register.findOne({
    registerId: placementCandidate.providerId,
    role: "provider",
  });

  if (!provider) {
    throw new Error(`Provider not found for ${placementCandidate.providerId}`);
  }

  const billingId = await generateBillingId();

  return PlacementBilling.create({
    billingId,

    placementCandidateId: placementCandidate.placementCandidateId,

    recruitId: placementCandidate.recruitId,

    providerId: placementCandidate.providerId,

    seekerId: placementCandidate.seekerId,

    companyName: provider.companyName,

    candidateName:
      placementCandidate.candidate_snapshot?.name || "Unknown Candidate",

    jobTitle: recruit.job_title || "Unknown Position",

    placementDate: placementCandidate.placedAt || new Date(),

    placementFee: 0,

    taxRate: 0,

    status: "draft",

    auditHistory: [
      {
        action: "CREATED",

        actor_type: "system",

        actor_id: null,

        reason: "Automatically created when candidate reached PLACED status.",
      },
    ],
  });
};

// ======================================================
// BACKFILL EXISTING PLACED CANDIDATES
//
// Useful for candidates that reached PLACED before
// billing functionality was added.
// ======================================================

const ensureAllPlacedBillings = async () => {
  const placedCandidates = await PlacementCandidate.find({
    status: "PLACED",
  });

  for (const candidate of placedCandidates) {
    try {
      await ensurePlacementBilling(candidate);
    } catch (error) {
      console.error(
        `Failed creating billing for ${candidate.placementCandidateId}:`,
        error,
      );
    }
  }
};

module.exports = {
  ensurePlacementBilling,
  ensureAllPlacedBillings,
};
