const feed = require("../lib/feed");

module.exports = async function (context) {
  context.res = {
    status: 200,
    headers: { "content-type": "application/json" },
    body: feed.information()
  };
};
