const fs = require("fs");
const path = require("path");

// swap this for the real vercel url once the first deploy gives you one
const SITE = "https://veyra-sand.vercel.app";

const DESC =
  "VEYRA is an AI powered hiring platform. Recruiters post jobs, screen resumes and generate interview questions, while candidates find roles and apply in minutes.";

const OG_IMAGE = SITE + "/assets/brand/og-image.png";

// project is nested one level down, so step into it first
const dir = path.join(__dirname, "..", "RC3-Job-Portal", "frontend", "frontend");

for (const file of fs.readdirSync(dir)) {
  if (!file.endsWith(".html")) continue;

  const p = path.join(dir, file);
  let html = fs.readFileSync(p, "utf8");

  // already has og tags, so running this twice wont double up
  if (html.includes('property="og:title"')) {
    console.log("skipped", file);
    continue;
  }

  // keep whatever title the page already has
  const m = html.match(/<title>([^<]*)<\/title>/i);
  const title = m ? m[1].trim() : "VEYRA";

  let tags = "";

  // dont add these if the page already ships its own
  if (!/name="description"/i.test(html)) {
    tags += `  <meta name="description" content="${DESC}" />\n`;
  }
  if (!/rel="icon"/i.test(html)) {
    tags += `  <link rel="icon" type="image/svg+xml" href="/assets/brand/favicon.svg" />\n`;
  }

  tags += `  <meta property="og:type" content="website" />
  <meta property="og:site_name" content="VEYRA" />
  <meta property="og:title" content="${title}" />
  <meta property="og:description" content="${DESC}" />
  <meta property="og:url" content="${SITE}/${file}" />
  <meta property="og:image" content="${OG_IMAGE}" />
  <meta property="og:image:width" content="1200" />
  <meta property="og:image:height" content="630" />
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="${title}" />
  <meta name="twitter:description" content="${DESC}" />
  <meta name="twitter:image" content="${OG_IMAGE}" />
`;

  html = html.replace(/<\/head>/i, tags + "</head>");
  fs.writeFileSync(p, html);
  console.log("done", file);
}
