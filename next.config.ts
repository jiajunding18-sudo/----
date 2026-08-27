import type { NextConfig } from "next";
import createMDX from "@next/mdx";
import { resolve } from "node:path";

const stableHeadingPluginPath = resolve(
  "src/lib/content/remark-stable-heading-anchors.mjs",
);

const withMDX = createMDX({
  options: {
    remarkPlugins: [
      "remark-frontmatter",
      "remark-mdx-frontmatter",
      "remark-gfm",
      stableHeadingPluginPath,
    ],
  },
});

const nextConfig: NextConfig = {
  output: "export",
  pageExtensions: ["js", "jsx", "md", "mdx", "ts", "tsx"],
  trailingSlash: true,
  images: {
    unoptimized: true,
  },
};

export default withMDX(nextConfig);
