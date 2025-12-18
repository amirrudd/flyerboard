import { defineApp } from "convex/server";
import r2 from "@convex-dev/r2/convex.config.js";
import resend from "@convex-dev/resend/convex.config.js";

const app = defineApp();

app.use(r2);
app.use(resend);

export default app;
