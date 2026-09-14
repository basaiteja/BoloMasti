const path = require("path");

/** @type {import('next').NextConfig} */
module.exports = {
  // This standalone app sits inside a larger workspace with an unrelated ESLint
  // configuration. Keep production builds independent from that parent config.
  eslint: { ignoreDuringBuilds: true },
  outputFileTracingRoot: path.join(__dirname),
};
