export default {
  providers: [
    {
      domain: process.env.CONVEX_AUTH_ISSUER!,
      applicationID: "convex",
    },
  ],
};
