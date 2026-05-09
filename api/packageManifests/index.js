const feed = require("../lib/feed");

module.exports = async function (context, req) {
  const urlPackageId = req.url
    ?.split("?")[0]
    ?.split("/packageManifests/")[1];
  const packageId = decodeURIComponent(urlPackageId || context.bindingData.PackageIdentifier || "");
  const version = req.query?.Version || req.query?.version;
  const body = await feed.packageManifest(packageId, version);

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
