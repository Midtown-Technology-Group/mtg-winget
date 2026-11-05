const feed = require("../lib/feed");

// Anonymous on purpose. WinGet resolves a source's package list before it can
// select that source for a package, so discovery has to answer without an
// authentication challenge; advertising Entra makes WinGet authenticate before
// every command instead of picking this source per package.
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
