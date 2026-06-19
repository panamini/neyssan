export default {
  providers: [
    {
      domain: process.env.CLERK_JWT_ISSUER_DOMAIN || "https://casual-gorilla-68.clerk.accounts.dev",
      applicationID: "convex",
    },
  ],
};
