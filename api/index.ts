import app from "../src/app";

export default {
	fetch(request: Request) {
		return app.handle(request);
	},
};
