/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as adDetail from "../adDetail.js";
import type * as admin from "../admin.js";
import type * as ads from "../ads.js";
import type * as auth from "../auth.js";
import type * as categories from "../categories.js";
import type * as crons from "../crons.js";
import type * as deleteR2Images from "../deleteR2Images.js";
import type * as descopeAuth from "../descopeAuth.js";
import type * as featureFlags from "../featureFlags.js";
import type * as http from "../http.js";
import type * as image_actions from "../image_actions.js";
import type * as lib_adminAuth from "../lib/adminAuth.js";
import type * as lib_auth from "../lib/auth.js";
import type * as lib_emailUtils from "../lib/emailUtils.js";
import type * as lib_logger from "../lib/logger.js";
import type * as lib_rateLimit from "../lib/rateLimit.js";
import type * as messages from "../messages.js";
import type * as migrations from "../migrations.js";
import type * as notifications_emailNotifications from "../notifications/emailNotifications.js";
import type * as notifications_index from "../notifications/index.js";
import type * as notifications_pendingEmailNotifications from "../notifications/pendingEmailNotifications.js";
import type * as notifications_pushNotifications from "../notifications/pushNotifications.js";
import type * as notifications_pushSubscriptions from "../notifications/pushSubscriptions.js";
import type * as notifications_queries from "../notifications/queries.js";
import type * as posts from "../posts.js";
import type * as r2 from "../r2.js";
import type * as ratings from "../ratings.js";
import type * as reports from "../reports.js";
import type * as router from "../router.js";
import type * as saleChats from "../saleChats.js";
import type * as saleEvents from "../saleEvents.js";
import type * as sampleData from "../sampleData.js";
import type * as seed from "../seed.js";
import type * as seedTestAd from "../seedTestAd.js";
import type * as updateRentHireIcon from "../updateRentHireIcon.js";
import type * as upload_urls from "../upload_urls.js";
import type * as users from "../users.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  adDetail: typeof adDetail;
  admin: typeof admin;
  ads: typeof ads;
  auth: typeof auth;
  categories: typeof categories;
  crons: typeof crons;
  deleteR2Images: typeof deleteR2Images;
  descopeAuth: typeof descopeAuth;
  featureFlags: typeof featureFlags;
  http: typeof http;
  image_actions: typeof image_actions;
  "lib/adminAuth": typeof lib_adminAuth;
  "lib/auth": typeof lib_auth;
  "lib/emailUtils": typeof lib_emailUtils;
  "lib/logger": typeof lib_logger;
  "lib/rateLimit": typeof lib_rateLimit;
  messages: typeof messages;
  migrations: typeof migrations;
  "notifications/emailNotifications": typeof notifications_emailNotifications;
  "notifications/index": typeof notifications_index;
  "notifications/pendingEmailNotifications": typeof notifications_pendingEmailNotifications;
  "notifications/pushNotifications": typeof notifications_pushNotifications;
  "notifications/pushSubscriptions": typeof notifications_pushSubscriptions;
  "notifications/queries": typeof notifications_queries;
  posts: typeof posts;
  r2: typeof r2;
  ratings: typeof ratings;
  reports: typeof reports;
  router: typeof router;
  saleChats: typeof saleChats;
  saleEvents: typeof saleEvents;
  sampleData: typeof sampleData;
  seed: typeof seed;
  seedTestAd: typeof seedTestAd;
  updateRentHireIcon: typeof updateRentHireIcon;
  upload_urls: typeof upload_urls;
  users: typeof users;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {
  r2: import("@convex-dev/r2/_generated/component.js").ComponentApi<"r2">;
  resend: import("@convex-dev/resend/_generated/component.js").ComponentApi<"resend">;
};
