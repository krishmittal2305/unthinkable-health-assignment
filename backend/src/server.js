const { createApp } = require("./app");
const { env } = require("./lib/env");

const app = createApp();

app.listen(env.port, () => {
  console.log(`Backend listening on port ${env.port}`);
});
