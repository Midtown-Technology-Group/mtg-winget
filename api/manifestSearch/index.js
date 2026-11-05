const feed = require("../lib/feed");

// Discovery stays anonymous so WinGet can decide per package whether this source
// publishes it. Package manifests, which carry installer URLs, hashes, and
// ProductCodes, still require a Microsoft Entra token.
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
