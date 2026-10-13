// Single source of truth for static branding. Business details shown on
// receipts (name, address, phone, tax number, receipt header/footer) are
// editable in Restaurant Settings and stored in the database — change them
// there without redeploying. This file covers UI chrome, titles and exports.
export const BRAND = {
  name: "Lush View Hotel",
  shortName: "Lush View",
  tagline: "Restaurant, Bar & Hospitality POS",
  description:
    "Touchscreen point-of-sale for restaurant, bar and room-service operations: Cash and MoMo tender, recipe-linked ingredient inventory, GRA VAT compliance, and live management telemetry.",
  csvSlug: "lushview_hotel",
  deviceCode: "LUSHVIEW-ACC-001",
  receiptFooter: "Thank you for visiting Lush View Hotel",
  poweredBy: "Lush View Hotel POS",
} as const;
