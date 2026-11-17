const fs = require("node:fs");

let failed = false;

for (const [javascriptPath, htmlPath] of [["map.js", "index.html"], ["19hz/map.js", "19hz/index.html"]]) {
  const javascript = fs.readFileSync(javascriptPath, "utf8");
  const html = fs.readFileSync(htmlPath, "utf8");
  const checks = [
    [/\bglyph\s*:/, "uses the deprecated PinElement glyph option"],
    [/new\s+google\.maps\.Marker\s*\(/, "uses deprecated google.maps.Marker"],
  ];

  for (const [pattern, message] of checks) {
    if (pattern.test(javascript)) {
      console.error(`${javascriptPath} ${message}`);
      failed = true;
    }
  }

  if (!javascript.includes('google.maps.importLibrary("maps")') || !javascript.includes('google.maps.importLibrary("marker")')) {
    console.error(`${javascriptPath} must load Maps libraries with importLibrary`);
    failed = true;
  }

  if (!/<script\b(?=[^>]*maps\.googleapis\.com\/maps\/api\/js)(?=[^>]*\bloading=async\b)(?=[^>]*\bcallback=initialize\b)[^>]*>/is.test(html)) {
    console.error(`${htmlPath} must load the Maps JavaScript API asynchronously with the initialize callback`);
    failed = true;
  }
}

if (failed) process.exitCode = 1;
else console.log("Google Maps checks passed");
