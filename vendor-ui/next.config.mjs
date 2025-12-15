/** @type {import('next').NextConfig} */
const nextConfig = {
    output: 'standalone',
    // Disable strict mode for lab to avoid double-invocation confusion in logs
    reactStrictMode: false,
};

export default nextConfig;
