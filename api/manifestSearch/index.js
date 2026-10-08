const feed = require("../lib/feed");

module.exports = async function (context, req) {
  try {
    context.res = {
      status: 200,
      headers: { "content-type": "application/json" },
      body: feed.manifestSearch(req.body || {})
    };
  } catch (error) {
    if (!(error instanceof RangeError)) {
      throw error;
    }
    context.res = {
      status: 400,
      headers: { "content-type": "application/json" },
      body: { error: error.message }
    };
  }
};
