const Register = require("../models/providers/registerSchema");
const Profile = require("../models/providers/profileSchema");

// ======================================================
// CONSTANTS
// ======================================================

const JAPAN_TIME_ZONE = "Asia/Tokyo";

// ======================================================
// STRING NORMALIZER
// ======================================================

const normalizeString = (value) => {
  if (value === null || value === undefined) {
    return "";
  }

  return String(value).trim();
};

// ======================================================
// DATE -> YYYYMMDD IN JAPAN TIME
// ======================================================

const formatInvoiceDatePart = (value = new Date()) => {
  const date = value instanceof Date ? value : new Date(value);

  if (Number.isNaN(date.getTime())) {
    throw new Error("Invalid invoice date.");
  }

  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: JAPAN_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });

  const parts = formatter.formatToParts(date);

  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  const day = parts.find((part) => part.type === "day")?.value;

  if (!year || !month || !day) {
    throw new Error("Unable to generate invoice date.");
  }

  return `${year}${month}${day}`;
};

// ======================================================
// GENERATE CUSTOMER-FACING INVOICE NUMBER
//
// Example:
//
// Billing:
// PB-529BC3E3
//
// Invoice:
// INV-20261003-529BC3E3
//
// The suffix comes from the unique billingId.
// ======================================================

const generatePlacementInvoiceNumber = ({
  billingId,
  issuedAt = new Date(),
}) => {
  const normalizedBillingId = normalizeString(billingId)
    .replace(/[^a-zA-Z0-9]/g, "")
    .toUpperCase();

  if (!normalizedBillingId) {
    throw new Error("Billing ID is required to generate invoice number.");
  }

  const suffix = normalizedBillingId.startsWith("PB")
    ? normalizedBillingId.slice(2)
    : normalizedBillingId;

  const datePart = formatInvoiceDatePart(issuedAt);

  return `INV-${datePart}-${suffix}`;
};

// ======================================================
// INVOICE CONFIGURATION
//
// Values are read from environment variables when the
// billing is issued.
//
// They are then frozen inside invoiceSnapshot.
// ======================================================

const getInvoiceConfiguration = () => {
  return {
    issuer: {
      name: normalizeString(process.env.INVOICE_ISSUER_NAME),

      postalCode: normalizeString(process.env.INVOICE_ISSUER_POSTAL_CODE),

      address: normalizeString(process.env.INVOICE_ISSUER_ADDRESS),

      phone: normalizeString(process.env.INVOICE_ISSUER_PHONE),

      email: normalizeString(process.env.INVOICE_ISSUER_EMAIL),

      registrationNumber: normalizeString(
        process.env.INVOICE_REGISTRATION_NUMBER,
      ),
    },

    bank: {
      bankName: normalizeString(process.env.INVOICE_BANK_NAME),

      branchName: normalizeString(process.env.INVOICE_BANK_BRANCH),

      accountType: normalizeString(process.env.INVOICE_BANK_ACCOUNT_TYPE),

      accountNumber: normalizeString(process.env.INVOICE_BANK_ACCOUNT_NUMBER),

      accountHolder: normalizeString(process.env.INVOICE_BANK_ACCOUNT_HOLDER),
    },
  };
};

// ======================================================
// VALIDATE CONFIGURATION
// ======================================================

const validateInvoiceConfiguration = (configuration) => {
  const missing = [];

  if (!configuration.issuer.name) {
    missing.push("INVOICE_ISSUER_NAME");
  }

  if (!configuration.issuer.address) {
    missing.push("INVOICE_ISSUER_ADDRESS");
  }

  if (!configuration.bank.bankName) {
    missing.push("INVOICE_BANK_NAME");
  }

  if (!configuration.bank.branchName) {
    missing.push("INVOICE_BANK_BRANCH");
  }

  if (!configuration.bank.accountType) {
    missing.push("INVOICE_BANK_ACCOUNT_TYPE");
  }

  if (!configuration.bank.accountNumber) {
    missing.push("INVOICE_BANK_ACCOUNT_NUMBER");
  }

  if (!configuration.bank.accountHolder) {
    missing.push("INVOICE_BANK_ACCOUNT_HOLDER");
  }

  if (missing.length > 0) {
    const error = new Error(
      `Invoice configuration is incomplete. Missing: ${missing.join(", ")}`,
    );

    error.code = "INVOICE_CONFIGURATION_INCOMPLETE";
    error.missingFields = missing;

    throw error;
  }
};

// ======================================================
// PROVIDER INVOICE RECIPIENT
// ======================================================

const getProviderInvoiceRecipient = async (providerId) => {
  const [provider, profile] = await Promise.all([
    Register.findOne({
      registerId: providerId,
      role: "provider",
    })
      .select("registerId name companyName email")
      .lean(),

    Profile.findOne({
      registerId: providerId,
    })
      .select("registerId name company_name email phone address contact_person")
      .lean(),
  ]);

  if (!provider) {
    throw new Error(`Provider not found for ${providerId}.`);
  }

  const companyName =
    normalizeString(profile?.company_name) ||
    normalizeString(provider.companyName);

  const contactPerson =
    normalizeString(profile?.contact_person) || normalizeString(provider.name);

  const address = normalizeString(profile?.address);

  if (!companyName) {
    throw new Error(`Provider company name is missing for ${providerId}.`);
  }

  return {
    companyName,
    address,
    contactPerson,
  };
};

// ======================================================
// JAPANESE SERVICE DESCRIPTION
// ======================================================

const buildServiceDescription = (candidateName) => {
  const normalizedCandidateName = normalizeString(candidateName);

  if (!normalizedCandidateName) {
    return "人材紹介手数料";
  }

  return `人材紹介手数料（${normalizedCandidateName}）`;
};

// ======================================================
// BUILD FROZEN INVOICE SNAPSHOT
// ======================================================

const buildPlacementInvoiceSnapshot = async (billing) => {
  if (!billing) {
    throw new Error("Placement billing is required.");
  }

  const configuration = getInvoiceConfiguration();

  validateInvoiceConfiguration(configuration);

  const recipient = await getProviderInvoiceRecipient(billing.providerId);

  return {
    issuer: {
      name: configuration.issuer.name,
      postalCode: configuration.issuer.postalCode,
      address: configuration.issuer.address,
      phone: configuration.issuer.phone,
      email: configuration.issuer.email,
      registrationNumber: configuration.issuer.registrationNumber,
    },

    recipient: {
      companyName: recipient.companyName,
      address: recipient.address,
      contactPerson: recipient.contactPerson,
    },

    bank: {
      bankName: configuration.bank.bankName,
      branchName: configuration.bank.branchName,
      accountType: configuration.bank.accountType,
      accountNumber: configuration.bank.accountNumber,
      accountHolder: configuration.bank.accountHolder,
    },

    serviceDescription: buildServiceDescription(billing.candidateName),

    quantity: 1,
  };
};

// ======================================================
// PREPARE INVOICE FOR ISSUE
//
// Does NOT save the Mongoose document.
// Controller remains responsible for save/status/audit.
// ======================================================

const preparePlacementInvoiceForIssue = async (
  billing,
  issuedAt = new Date(),
) => {
  if (!billing) {
    throw new Error("Placement billing is required.");
  }

  if (!billing.invoiceNumber) {
    billing.invoiceNumber = generatePlacementInvoiceNumber({
      billingId: billing.billingId,
      issuedAt,
    });
  }

  if (!billing.invoiceSnapshot) {
    billing.invoiceSnapshot = await buildPlacementInvoiceSnapshot(billing);
  }

  return billing;
};

// ======================================================
// EXPORTS
// ======================================================

module.exports = {
  generatePlacementInvoiceNumber,
  getInvoiceConfiguration,
  validateInvoiceConfiguration,
  getProviderInvoiceRecipient,
  buildPlacementInvoiceSnapshot,
  preparePlacementInvoiceForIssue,
};
