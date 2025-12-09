export default {
  providers: [
    {
      domain: process.env.CONVEX_AUTH_ISSUER!,
      applicationID: process.env.DESCOPE_PROJECT_ID || "P363bEaEDNeBq3fLWpNjbiUvuloU", // Descope Project ID
    },
  ],
};
