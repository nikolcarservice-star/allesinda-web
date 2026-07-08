const cdnUrl = process.env.NEXT_PUBLIC_CDN_URL || process.env.CDN_URL || '';

const isDevelopment = process.env.NODE_ENV === 'development';

const remotePatterns = [
  // Allesinda CDN assets
  {
    protocol: 'https',
    hostname: '*.s3.amazonaws.com',
  },
  {
    protocol: 'https',
    hostname: '*.s3.*.amazonaws.com',
  },
  {
    protocol: 'https',
    hostname: '*.cloudfront.net',
  },
];

// Allow localhost in development OR when API URL is localhost (for local production testing)
const apiUrl = process.env.NEXT_PUBLIC_API_URL;
const isLocalhostApi = apiUrl && (
  apiUrl.includes('localhost') || 
  apiUrl.includes('127.0.0.1') || 
  apiUrl.startsWith('http://localhost') ||
  apiUrl.startsWith('http://127.0.0.1')
);

if (isDevelopment || isLocalhostApi) {
  remotePatterns.push(
    {
      protocol: 'http',
      hostname: 'localhost',
    },
    {
      protocol: 'https',
      hostname: 'localhost',
    },
    {
      protocol: 'http',
      hostname: '127.0.0.1',
    }
  );
  // Include API origin with port so Next Image can load backend media (e.g. localhost:8000)
  if (apiUrl) {
    try {
      const parsed = new URL(apiUrl);
      remotePatterns.push({
        protocol: parsed.protocol.replace(':', ''),
        hostname: parsed.hostname,
        ...(parsed.port ? { port: parsed.port } : {}),
      });
    } catch {
      // ignore
    }
  }
}

if (cdnUrl) {
  try {
    const normalizedCdn = cdnUrl.startsWith('http') ? cdnUrl : `https://${cdnUrl}`;
    const parsed = new URL(normalizedCdn);
    remotePatterns.push({
      protocol: parsed.protocol.replace(':', ''),
      hostname: parsed.hostname,
      ...(parsed.port ? { port: parsed.port } : {}),
    });
  } catch (error) {
    // Only warn in development - this is a build-time check
    if (process.env.NODE_ENV === 'development') {
      console.warn(`Invalid CDN URL provided (${cdnUrl}); continuing without adding to remotePatterns.`);
    }
  }
}

// Add API URL to remotePatterns so Next.js can fetch images server-side for optimization
// This is needed because rewrite rules don't apply to server-side image optimization
if (apiUrl && !isLocalhostApi) {
  try {
    const parsedUrl = new URL(apiUrl);
    remotePatterns.push({
      protocol: parsedUrl.protocol.replace(':', ''),
      hostname: parsedUrl.hostname,
      ...(parsedUrl.port ? { port: parsedUrl.port } : {}),
    });
  } catch (error) {
    // If URL parsing fails, log warning but continue
    if (process.env.NODE_ENV === 'development') {
      console.warn(`Invalid API URL provided (${apiUrl}); continuing without adding to remotePatterns.`);
    }
  }
}

// Detect if we're on Windows (which has symlink permission issues)
const isWindows = process.platform === 'win32';
// Allow standalone to be forced via environment variable (useful for CI/CD)
const forceStandalone = process.env.NEXT_OUTPUT_STANDALONE === 'true';
// Enable standalone output for Docker (skip on Windows unless forced)
const enableStandalone = forceStandalone || !isWindows;

const nextConfig = {
  /* config options here */
  // Allow opening the dev server from LAN IP on phone (Safari/Chrome)
  allowedDevOrigins: isDevelopment
    ? ['192.168.1.27:3000', 'localhost:3000', '127.0.0.1:3000']
    : undefined,
  // Production optimizations
  compress: true,
  poweredByHeader: false,
  reactStrictMode: true,
  // Enable standalone output for Docker (disabled on Windows due to symlink permissions)
  ...(enableStandalone && { output: 'standalone' }),
  
  experimental: {
    // App Router optimizations
    optimizePackageImports: ['lucide-react', '@radix-ui/react-icons'],
    // Enable cache directives
    useCache: true,
  },
  eslint: {
    // Enable ESLint during builds to catch errors
    ignoreDuringBuilds: false,
  },
  typescript: {
    // Enable TypeScript error checking during builds
    ignoreBuildErrors: false,
  },
  // Rewrite rules to proxy media requests to backend server
  async rewrites() {
    // API_URL: server-only target for /api-proxy (e.g. internal Docker URL or .com until .de DNS exists)
    const apiUrl = process.env.API_URL || process.env.NEXT_PUBLIC_API_URL;
    if (!apiUrl) {
      console.warn('NEXT_PUBLIC_API_URL (or API_URL) is not set. Media rewrites will not work.');
      return [];
    }
    // /api-proxy is handled by app/api-proxy/[...path]/route.ts (runtime API_URL)
    return [
      {
        source: '/media/:path*',
        destination: `${apiUrl}/media/:path*`,
      },
    ];
  },
  async redirects() {
    return [
      { source: "/dashboard/master", destination: "/profile", permanent: true },
      { source: "/dashboard/seller", destination: "/profile", permanent: true },
      { source: "/dashboard", destination: "/profile", permanent: true },
    ];
  },
  images: {
    // Enable image optimization for better performance
    unoptimized: false,
    formats: ['image/avif', 'image/webp'],
    deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048, 3840],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
    minimumCacheTTL: 60,
    dangerouslyAllowSVG: true,
    contentSecurityPolicy: "default-src 'self'; script-src 'none'; sandbox;",
    remotePatterns,
  },
  // Security headers for production
  async headers() {
    // Allow localhost HTTP in development, HTTPS only in production
    const isDevelopment = process.env.NODE_ENV === 'development';
    const apiUrl = process.env.NEXT_PUBLIC_API_URL;
    
    // Check if API URL is localhost (for local testing, even with production build)
    const isLocalhostApi = apiUrl && (
      apiUrl.includes('localhost') || 
      apiUrl.includes('127.0.0.1') || 
      apiUrl.startsWith('http://localhost') ||
      apiUrl.startsWith('http://127.0.0.1')
    );
    
    // Build connect-src directive
    let connectSrc = "connect-src 'self' https:";
    if (isDevelopment || isLocalhostApi) {
      // In development OR when API URL is localhost (for local production testing)
      // Allow localhost connections on port 8000 (or any port)
      if (apiUrl) {
        try {
          const parsedUrl = new URL(apiUrl);
          connectSrc += ` ${parsedUrl.origin}`;
          // Add WebSocket support
          if (parsedUrl.protocol === 'http:') {
            connectSrc += ` ws://${parsedUrl.host}`;
          } else if (parsedUrl.protocol === 'https:') {
            connectSrc += ` wss://${parsedUrl.host}`;
          }
        } catch (error) {
          // Fallback to default localhost ports if URL parsing fails
          connectSrc += " http://localhost:8000 http://127.0.0.1:8000 ws://localhost:8000 ws://127.0.0.1:8000";
        }
      } else {
        // Default localhost ports if API URL is not set
        connectSrc += " http://localhost:8000 http://127.0.0.1:8000 ws://localhost:8000 ws://127.0.0.1:8000";
      }
    } else if (apiUrl) {
      // In production with non-localhost API URL, add the API URL to connect-src
      try {
        const parsedUrl = new URL(apiUrl);
        // Add the API URL's origin to connect-src
        connectSrc += ` ${parsedUrl.origin}`;
        // If it's a WebSocket URL, also add the ws/wss version
        if (parsedUrl.protocol === 'http:') {
          connectSrc += ` ws://${parsedUrl.host}`;
        } else if (parsedUrl.protocol === 'https:') {
          connectSrc += ` wss://${parsedUrl.host}`;
        }
      } catch (error) {
        // If URL parsing fails, log warning but continue
        console.warn('Failed to parse NEXT_PUBLIC_API_URL for CSP:', error);
      }
    }
    
    // Build img-src directive
    let imgSrc = "img-src 'self' data: blob: https:";
    if (isDevelopment || isLocalhostApi) {
      // In development OR when API URL is localhost (for local production testing)
      if (apiUrl) {
        try {
          const parsedUrl = new URL(apiUrl);
          imgSrc += ` ${parsedUrl.origin}`;
        } catch (error) {
          // Fallback to default localhost if URL parsing fails
          imgSrc += " http://localhost:8000 http://127.0.0.1:8000";
        }
      } else {
        imgSrc += " http://localhost:8000 http://127.0.0.1:8000";
      }
    } else if (apiUrl) {
      try {
        const parsedUrl = new URL(apiUrl);
        imgSrc += ` ${parsedUrl.origin}`;
      } catch (error) {
        // If URL parsing fails, continue without adding
      }
    }
    imgSrc += ";";

    let mediaSrc = "media-src 'self' blob: https:";
    if (isDevelopment || isLocalhostApi) {
      if (apiUrl) {
        try {
          const parsedUrl = new URL(apiUrl);
          mediaSrc += ` ${parsedUrl.origin}`;
        } catch {
          mediaSrc += " http://localhost:8000 http://127.0.0.1:8000";
        }
      } else {
        mediaSrc += " http://localhost:8000 http://127.0.0.1:8000";
      }
    } else if (apiUrl) {
      try {
        const parsedUrl = new URL(apiUrl);
        mediaSrc += ` ${parsedUrl.origin}`;
      } catch {
        // continue
      }
    }
    mediaSrc += ";";

    // Google Analytics 4 (loaded after cookie consent)
    const googleAnalyticsScriptSrc =
      "https://www.googletagmanager.com https://www.google-analytics.com";
 
    return [
      {
        source: '/:path*',
        headers: [
          // Minimal CSP suitable for this app; refine as needed
          {
            key: 'Content-Security-Policy',
            value:
              `default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' ${googleAnalyticsScriptSrc}; style-src 'self' 'unsafe-inline'; ${imgSrc} font-src 'self' https: data:; ${connectSrc}; ${mediaSrc} frame-ancestors 'self'; base-uri 'self'; form-action 'self'`,
          },
          {
            key: 'X-DNS-Prefetch-Control',
            value: 'on',
          },
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=63072000; includeSubDomains; preload',
          },
          {
            key: 'X-Frame-Options',
            value: 'SAMEORIGIN',
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'X-XSS-Protection',
            value: '1; mode=block',
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
        ],
      },
    ];
  },
};

export default nextConfig;
