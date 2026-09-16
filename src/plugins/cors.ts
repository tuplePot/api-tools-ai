import { cors } from "@elysia/cors";


const corsOrigin: string | undefined = process.env.CORS_ORIGIN;
const allowedOrigins = (corsOrigin ?? '')
	.split(/[,\s]+/)
	.map((o) => o.trim())
	.filter(Boolean);


// CORS — restrict to known origins. Set CORS_ORIGIN env var (comma-separated)
// in production to include the Console deployment URL.
// Desktop and SSR callers do not send an Origin header and are unaffected.
export const corsPlugin = cors({
	origin: allowedOrigins,
	credentials: true,
});
