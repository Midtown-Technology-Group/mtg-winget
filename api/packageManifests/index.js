const feed = require("../lib/feed");

module.exports = async function (context, req) {
  const packageId = context.bindingData.PackageIdentifier;
  const version = req.query?.Version || req.query?.version;
  const body = feed.packageManifest(packageId, version);

  context.res = body
    ? {
        status: 200,
        headers: { "content-type": "application/json" },
        body
      }
    : {
        status: 404,
        headers: { "content-type": "application/json" },
        body: { Error: "Package manifest not found" }
      };
};
