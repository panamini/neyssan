
import { Webhook } from "svix";
    import { httpRouter } from "convex/server";
    import { httpAction } from "./_generated/server";
    import { internal } from "./_generated/api";

    // Define types for Clerk webhook payload
    interface ClerkWebhookEvent {
      type: string;
      data: {
        id: string;
        email_addresses: Array<{ email_address: string }>;
        first_name?: string;
        last_name?: string;
      };
    }

    const http = httpRouter();

    http.route({
      path: "/clerk-users-webhook",
      method: "POST",
      handler: httpAction(async (ctx, request) => {
        const webhookSecret = process.env["CLERK_WEBHOOK_SECRET"];
        if (!webhookSecret) {
          throw new Error("CLERK_WEBHOOK_SECRET is not set");
        }

        // Get the webhook payload
        const payload = await request.text();
        const headers = request.headers;

        // Verify the webhook signature
        const wh = new Webhook(webhookSecret);
        let evt: ClerkWebhookEvent;

        try {
          evt = await wh.verify(payload, {
            "svix-id": headers.get("svix-id") ?? "",
            "svix-timestamp": headers.get("svix-timestamp") ?? "",
            "svix-signature": headers.get("svix-signature") ?? "",
          }) as ClerkWebhookEvent;
        } catch (err) {
          console.error("Error verifying webhook:", err);
          return new Response("Error verifying webhook", { status: 400 });
        }

        const { type, data } = evt;

        try {
          switch (type) {
        case "user.created": {
          if (!data.email_addresses?.[0]?.email_address) {
            throw new Error("Missing email address in user data");
          }

          let name: string | undefined;
          if (data.first_name && data.last_name) {
            name = `${data.first_name} ${data.last_name}`.trim() || undefined;
          }

          await ctx.runMutation(internal.users.createOrUpdateUser, {
            clerkId: data.id,
            email: data.email_addresses[0].email_address,
            ...(name && { name }),
          });
          break;
        } // Closing brace for user.created
        case "user.updated": {
          if (!data.email_addresses?.[0]?.email_address) {
            throw new Error("Missing email address in user data");
          }

          let name: string | undefined;
          if (data.first_name && data.last_name) {
            name = `${data.first_name} ${data.last_name}`.trim() || undefined;
          }

          await ctx.runMutation(internal.users.createOrUpdateUser, {
            clerkId: data.id,
            email: data.email_addresses[0].email_address,
            ...(name && { name }),
          });
          break;
        } // Closing brace for user.updated

        case "user.deleted": { // Add braces for user.deleted
          await ctx.runMutation(internal.users.deleteUser, {
            clerkId: data.id,
          });
          break;
        } // Closing brace for user.deleted
      } // Closing brace for switch
      return new Response(null, { status: 200 });
    } catch (error) {
      console.error("Error processing webhook:", error);
      return new Response("Internal Server Error", { status: 500 });
    }
  }),
});

    export default http;
