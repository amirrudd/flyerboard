/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";
import type * as adDetail from "../adDetail.js";
import type * as ads from "../ads.js";
import type * as auth from "../auth.js";
import type * as categories from "../categories.js";
import type * as http from "../http.js";
import type * as messages from "../messages.js";
import type * as posts from "../posts.js";
import type * as ratings from "../ratings.js";
import type * as reports from "../reports.js";
import type * as router from "../router.js";
import type * as sampleData from "../sampleData.js";
import type * as users from "../users.js";

/**
 * A utility for referencing Convex functions in your app's API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
declare const fullApi: ApiFromModules<{
  adDetail: typeof adDetail;
  ads: typeof ads;
  auth: typeof auth;
  categories: typeof categories;
  http: typeof http;
  messages: typeof messages;
  posts: typeof posts;
  ratings: typeof ratings;
  reports: typeof reports;
  router: typeof router;
  sampleData: typeof sampleData;
  users: typeof users;
}>;
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;
