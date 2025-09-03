/**
 * CloudFlare CDN Configuration for AIRIS EPM Global Deployment
 * Supports multi-region deployment with edge caching and optimization
 */

module.exports = {
  // Zone configuration for different regions
  zones: {
    global: {
      name: 'airis-epm.com',
      status: 'active',
      type: 'full',
      plan: 'enterprise',
    },
    regions: {
      'us-east': {
        subdomain: 'us-east.airis-epm.com',
        datacenter: 'iad',
        edge_servers: ['cloudflare-us-east-1', 'cloudflare-us-east-2'],
      },
      'eu-west': {
        subdomain: 'eu-west.airis-epm.com', 
        datacenter: 'lhr',
        edge_servers: ['cloudflare-eu-west-1', 'cloudflare-eu-west-2'],
      },
      'ap-northeast': {
        subdomain: 'ap-northeast.airis-epm.com',
        datacenter: 'nrt',
        edge_servers: ['cloudflare-ap-northeast-1', 'cloudflare-ap-northeast-2'],
      },
      'ap-southeast': {
        subdomain: 'ap-southeast.airis-epm.com',
        datacenter: 'sin',
        edge_servers: ['cloudflare-ap-southeast-1', 'cloudflare-ap-southeast-2'],
      },
    },
  },

  // CDN settings
  cdn: {
    // Cache configuration
    caching: {
      // Static assets (JS, CSS, images)
      static_assets: {
        browser_cache_ttl: 31536000, // 1 year
        edge_cache_ttl: 2592000, // 30 days
        development_mode: false,
        cache_level: 'aggressive',
        always_online: true,
      },
      
      // API responses
      api_responses: {
        browser_cache_ttl: 0, // No browser cache
        edge_cache_ttl: 300, // 5 minutes
        bypass_cache_on_cookie: true,
        respect_origin_ttl: false,
      },

      // Dashboard pages
      dashboard_pages: {
        browser_cache_ttl: 3600, // 1 hour
        edge_cache_ttl: 1800, // 30 minutes
        cache_by_device_type: true,
        cache_deception_armor: 'on',
      },
    },

    // Performance optimization
    optimization: {
      minify: {
        js: true,
        css: true,
        html: true,
      },
      
      compression: {
        gzip: true,
        brotli: true,
        level: 6,
      },

      // Image optimization
      polish: {
        enabled: true,
        webp: true,
        avif: true,
        lossy: 'off',
      },

      // Rocket Loader for JavaScript optimization
      rocket_loader: 'automatic',
      
      // Mirage for mobile optimization
      mirage: true,
    },

    // Security settings
    security: {
      ssl: {
        mode: 'full_strict',
        min_tls_version: '1.2',
        ciphers: ['ECDHE-RSA-AES128-GCM-SHA256', 'ECDHE-RSA-AES256-GCM-SHA384'],
        hsts: {
          enabled: true,
          max_age: 31536000,
          include_subdomains: true,
          preload: true,
        },
      },

      waf: {
        enabled: true,
        mode: 'on',
        rules: [
          {
            id: 'owasp_core_ruleset',
            enabled: true,
            action: 'challenge',
          },
          {
            id: 'cloudflare_managed_rules',
            enabled: true,
            action: 'block',
          },
        ],
      },

      ddos_protection: {
        enabled: true,
        sensitivity: 'high',
        threshold: 1000,
      },

      rate_limiting: {
        api_endpoints: {
          requests_per_minute: 1000,
          burst_size: 100,
          period: 60,
        },
        login_endpoints: {
          requests_per_minute: 10,
          burst_size: 5,
          period: 300,
        },
      },
    },

    // Load balancing
    load_balancing: {
      enabled: true,
      method: 'geo', // Geographic load balancing
      health_checks: {
        enabled: true,
        interval: 60,
        timeout: 10,
        retries: 3,
        path: '/api/health',
        expected_codes: ['200'],
      },
      
      pools: {
        'us-pool': {
          name: 'US East Pool',
          origins: [
            {
              name: 'us-east-1',
              address: 'us-east-1.airis-epm.internal',
              weight: 1,
              enabled: true,
            },
            {
              name: 'us-east-2', 
              address: 'us-east-2.airis-epm.internal',
              weight: 1,
              enabled: true,
            },
          ],
        },
        
        'eu-pool': {
          name: 'EU West Pool',
          origins: [
            {
              name: 'eu-west-1',
              address: 'eu-west-1.airis-epm.internal',
              weight: 1,
              enabled: true,
            },
            {
              name: 'eu-west-2',
              address: 'eu-west-2.airis-epm.internal', 
              weight: 1,
              enabled: true,
            },
          ],
        },

        'ap-pool': {
          name: 'Asia Pacific Pool',
          origins: [
            {
              name: 'ap-northeast-1',
              address: 'ap-northeast-1.airis-epm.internal',
              weight: 0.6,
              enabled: true,
            },
            {
              name: 'ap-southeast-1',
              address: 'ap-southeast-1.airis-epm.internal',
              weight: 0.4,
              enabled: true,
            },
          ],
        },
      },
      
      // Geo-steering rules
      geo_steering: [
        {
          country: ['US', 'CA', 'MX'],
          pool: 'us-pool',
          fallback: 'eu-pool',
        },
        {
          country: ['GB', 'DE', 'FR', 'ES', 'IT', 'NL'],
          pool: 'eu-pool', 
          fallback: 'us-pool',
        },
        {
          country: ['JP', 'KR', 'CN', 'TW'],
          pool: 'ap-pool',
          fallback: 'us-pool',
        },
        {
          country: ['SG', 'MY', 'TH', 'VN', 'PH', 'IN', 'AU'],
          pool: 'ap-pool',
          fallback: 'eu-pool',
        },
      ],
    },
  },

  // Page rules for specific paths
  page_rules: [
    {
      target: '*.airis-epm.com/api/*',
      settings: {
        cache_level: 'bypass',
        disable_apps: true,
        disable_performance: true,
      },
    },
    {
      target: '*.airis-epm.com/assets/*',
      settings: {
        cache_level: 'cache_everything',
        edge_cache_ttl: 2592000, // 30 days
        browser_cache_ttl: 31536000, // 1 year
      },
    },
    {
      target: '*.airis-epm.com/dashboard/*',
      settings: {
        cache_level: 'standard',
        browser_cache_ttl: 3600, // 1 hour
        always_use_https: true,
      },
    },
  ],

  // Worker scripts for edge computing
  workers: {
    geo_redirect: {
      name: 'geo-redirect',
      script: `
addEventListener('fetch', event => {
  event.respondWith(handleRequest(event.request))
})

async function handleRequest(request) {
  const country = request.cf.country
  const url = new URL(request.url)
  
  // Redirect based on country
  const redirects = {
    'KR': 'kr.airis-epm.com',
    'JP': 'jp.airis-epm.com', 
    'CN': 'cn.airis-epm.com',
    'DE': 'de.airis-epm.com',
    'GB': 'uk.airis-epm.com',
  }
  
  if (redirects[country] && url.hostname === 'airis-epm.com') {
    url.hostname = redirects[country]
    return Response.redirect(url.toString(), 302)
  }
  
  return fetch(request)
}
      `,
    },

    security_headers: {
      name: 'security-headers',
      script: `
addEventListener('fetch', event => {
  event.respondWith(handleRequest(event.request))
})

async function handleRequest(request) {
  const response = await fetch(request)
  const newResponse = new Response(response.body, response)
  
  // Add security headers
  newResponse.headers.set('X-Frame-Options', 'DENY')
  newResponse.headers.set('X-Content-Type-Options', 'nosniff')
  newResponse.headers.set('X-XSS-Protection', '1; mode=block')
  newResponse.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin')
  newResponse.headers.set('Permissions-Policy', 'geolocation=(), microphone=(), camera=()')
  
  // GDPR compliance headers
  if (request.cf.country === 'EU' || ['DE', 'FR', 'GB', 'IT', 'ES'].includes(request.cf.country)) {
    newResponse.headers.set('X-GDPR-Region', 'true')
  }
  
  return newResponse
}
      `,
    },
  },

  // Analytics and monitoring
  analytics: {
    web_analytics: {
      enabled: true,
      privacy_policy: 'essential_only',
    },
    
    real_user_monitoring: {
      enabled: true,
      sample_rate: 1.0,
    },
    
    bot_management: {
      enabled: true,
      fight_mode: false, // Don't block bots, just identify
      super_bot_fight_mode: true,
    },
  },

  // Environment-specific configurations
  environments: {
    production: {
      development_mode: false,
      always_use_https: true,
      automatic_https_rewrites: true,
    },
    
    staging: {
      development_mode: true,
      always_use_https: true,
      cache_level: 'bypass',
    },
    
    development: {
      development_mode: true,
      always_use_https: false,
      cache_level: 'bypass',
    },
  },
};