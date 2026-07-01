import type { Id } from "../../../convex/_generated/dataModel";

/** Minimal shape of a sale item the buyer page / preview needs. */
export interface SaleItem {
  _id: Id<"ads">;
  title: string;
  price?: number;
  images: string[];
  categoryId: Id<"categories">;
  isSold?: boolean;
  condition?: string;
}

export interface SaleBundle {
  _id: Id<"saleBundles">;
  label: string;
  bundlePrice: number;
  adIds: Id<"ads">[];
}

export interface SaleEventCore {
  /** Absent only for in-progress seller-flow previews before the sale is created. */
  _id?: Id<"saleEvents">;
  title: string;
  suburb: string;
  note?: string;
  pickupWindowStart: number;
  pickupWindowEnd: number;
  slug?: string;
}

export type FlowStep =
  | "intro"
  | "setup"
  | "upload"
  | "review"
  | "bundles"
  | "publish"
  | "share";
