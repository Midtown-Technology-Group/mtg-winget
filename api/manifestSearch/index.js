const feed = require("../lib/feed");

module.exports = async function (context, req) {
  context.res = {
    status: 200,
    headers: { "content-type": "application/json" },
    body: feed.manifestSearch(req.body || {})
  };
};
