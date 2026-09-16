import app from "./app";

app.listen(Number(process.env.PORT ?? 3000), ({ hostname, port }) => {
	console.log(`[Server] http://${hostname}:${port}`);
});
