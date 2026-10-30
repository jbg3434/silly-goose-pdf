/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverComponentsExternalPackages: ["@huggingface/transformers", "onnxruntime-node", "sharp"],
  },
};

export default nextConfig;
