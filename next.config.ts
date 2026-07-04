import type { NextConfig } from 'next';

/**
 * Next.js Configuration for Examiner AI
 *
 * KEY: pdfjs-dist requires special webpack treatment.
 * We must mark it as an external in server builds and
 * configure proper canvas fallbacks.
 */
const nextConfig: NextConfig = {
  // ── Webpack configuration ──────────────────────────────────────
  webpack: (config, { isServer }) => {
    // pdfjs-dist must never be bundled server-side
    // It uses canvas and other browser-only APIs
    if (isServer) {
      config.externals = [
        ...(Array.isArray(config.externals) ? config.externals : []),
        'pdfjs-dist',
        'tesseract.js',
        'canvas',
      ];
    }

    // Required for pdfjs-dist: disable canvas module warnings
    config.resolve.alias = {
      ...config.resolve.alias,
      canvas: false,
    };

    // Handle pdfjs binary files
    config.module.rules.push({
      test: /\.m?js$/,
      type: 'javascript/auto',
      resolve: {
        fullySpecified: false,
      },
    });

    return config;
  },

  // ── Experimental features ──────────────────────────────────────
  experimental: {
    // Optimize package imports
    optimizePackageImports: ['pdfjs-dist'],
  },

  // ── Headers (security) ────────────────────────────────────────
  async headers() {
    return [
      {
        source: '/api/:path*',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'DENY' },
        ],
      },
    ];
  },
};

export default nextConfig;
