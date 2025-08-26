import { Router, Request, Response } from 'express';
import { asyncHandler } from '../middleware/errorHandler';
import swaggerJSDoc from 'swagger-jsdoc';
import swaggerUi from 'swagger-ui-express';
import { logger } from '../utils/logger';

const router = Router();

// Swagger configuration
const swaggerOptions = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'AIRIS APM to EPM Compatibility Layer API',
      version: '1.0.0',
      description: `
        The AIRIS Compatibility Layer provides seamless backward compatibility 
        between legacy AIRIS APM and new EPM systems. It handles API version 
        negotiation, data transformation, and request routing.
      `,
      contact: {
        name: 'AIRIS EPM Team',
        email: 'support@airis-epm.com',
      },
      license: {
        name: 'MIT',
        url: 'https://opensource.org/licenses/MIT',
      },
    },
    servers: [
      {
        url: '/api',
        description: 'Compatibility Layer API',
      },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
        },
      },
      schemas: {
        ApiVersion: {
          type: 'object',
          properties: {
            version: {
              type: 'string',
              example: '2.1',
            },
            releaseDate: {
              type: 'string',
              format: 'date',
              example: '2023-01-01',
            },
            deprecated: {
              type: 'boolean',
              example: false,
            },
            supportLevel: {
              type: 'string',
              enum: ['full', 'limited', 'security-only', 'eol'],
              example: 'full',
            },
            features: {
              type: 'array',
              items: {
                type: 'string',
              },
              example: ['advanced-monitoring', 'complex-alerts'],
            },
          },
        },
        MigrationTask: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              example: 'migration_12345',
            },
            name: {
              type: 'string',
              example: 'Migrate User Data',
            },
            status: {
              type: 'string',
              enum: ['pending', 'running', 'completed', 'failed', 'cancelled'],
              example: 'pending',
            },
            progress: {
              type: 'number',
              minimum: 0,
              maximum: 100,
              example: 45,
            },
            priority: {
              type: 'string',
              enum: ['low', 'medium', 'high', 'critical'],
              example: 'medium',
            },
          },
        },
        Error: {
          type: 'object',
          properties: {
            error: {
              type: 'string',
              example: 'Validation Error',
            },
            message: {
              type: 'string',
              example: 'Invalid request parameters',
            },
            statusCode: {
              type: 'number',
              example: 400,
            },
            timestamp: {
              type: 'string',
              format: 'date-time',
            },
          },
        },
      },
    },
    security: [
      {
        bearerAuth: [],
      },
    ],
  },
  apis: ['./src/routes/*.ts'], // Path to the API files
};

const specs = swaggerJSDoc(swaggerOptions);

// Serve Swagger UI
router.use('/api-docs', swaggerUi.serve);
router.get('/api-docs', swaggerUi.setup(specs, {
  customCss: '.swagger-ui .topbar { display: none }',
  customSiteTitle: 'AIRIS Compatibility Layer API',
}));

// API documentation in JSON format
router.get('/api-docs.json', (req: Request, res: Response) => {
  res.setHeader('Content-Type', 'application/json');
  res.send(specs);
});

/**
 * Documentation home page
 */
router.get('/', asyncHandler(async (req: Request, res: Response) => {
  const documentation = {
    title: 'AIRIS APM to EPM Compatibility Layer',
    version: '1.0.0',
    description: 'Documentation for the AIRIS Compatibility Layer API',
    sections: [
      {
        title: 'Getting Started',
        content: [
          {
            title: 'Authentication',
            description: 'All API requests require a valid JWT token in the Authorization header.',
            example: 'Authorization: Bearer <your-jwt-token>',
          },
          {
            title: 'API Versioning',
            description: 'Specify the API version using the X-API-Version header.',
            example: 'X-API-Version: 2.1',
          },
          {
            title: 'Client Version',
            description: 'Include your client version for optimal compatibility.',
            example: 'X-Client-Version: 2.1.0',
          },
        ],
      },
      {
        title: 'API Compatibility',
        content: [
          {
            title: 'Supported Versions',
            description: 'The compatibility layer supports API versions 1.0 through 3.0.',
            versions: ['1.0', '1.1', '1.2', '2.0', '2.1', '3.0'],
          },
          {
            title: 'Data Transformation',
            description: 'Requests and responses are automatically transformed between versions.',
            transformations: [
              'Field name mapping (user_id → userId)',
              'Date format conversion (YYYY-MM-DD → ISO8601)',
              'Response wrapper adaptation',
            ],
          },
        ],
      },
      {
        title: 'Migration Support',
        content: [
          {
            title: 'Migration Modes',
            description: 'Three migration modes are supported:',
            modes: [
              'transparent: Automatic routing based on health',
              'gradual: Route based on client version',
              'forced: Always use new API',
            ],
          },
          {
            title: 'Batch Migration',
            description: 'Large data migrations can be processed in batches for optimal performance.',
          },
        ],
      },
    ],
    endpoints: {
      compatibility: '/api/v*',
      versions: '/api/versions',
      migration: '/migration',
      health: '/health',
      metrics: '/metrics',
    },
    links: {
      'Interactive API Documentation': '/docs/api-docs',
      'OpenAPI Specification': '/docs/api-docs.json',
      'Health Check': '/health',
      'Service Metrics': '/metrics',
    },
  };
  
  res.json(documentation);
}));

/**
 * API migration guide
 */
router.get('/migration-guide', asyncHandler(async (req: Request, res: Response) => {
  const guide = {
    title: 'API Migration Guide',
    overview: 'Step-by-step guide for migrating from AIRIS APM to EPM',
    steps: [
      {
        step: 1,
        title: 'Assessment',
        description: 'Analyze your current API usage and dependencies',
        actions: [
          'Identify API version currently in use',
          'List all API endpoints being called',
          'Document data formats and structures',
          'Assess authentication mechanisms',
        ],
      },
      {
        step: 2,
        title: 'Planning',
        description: 'Plan your migration strategy',
        actions: [
          'Choose migration mode (transparent, gradual, or forced)',
          'Estimate migration effort and timeline',
          'Identify breaking changes and required updates',
          'Plan rollback strategy',
        ],
      },
      {
        step: 3,
        title: 'Testing',
        description: 'Test compatibility and transformations',
        actions: [
          'Use /api/transform/test endpoint to validate data transformations',
          'Test API calls through the compatibility layer',
          'Verify response formats and data integrity',
          'Performance test with expected load',
        ],
      },
      {
        step: 4,
        title: 'Migration',
        description: 'Execute the migration',
        actions: [
          'Update client configuration to use compatibility layer',
          'Monitor API calls and error rates',
          'Migrate data using batch migration tools',
          'Update client code for new API version gradually',
        ],
      },
      {
        step: 5,
        title: 'Validation',
        description: 'Validate migration success',
        actions: [
          'Verify all functionality works correctly',
          'Compare data consistency between old and new systems',
          'Monitor performance and error rates',
          'Complete user acceptance testing',
        ],
      },
    ],
    commonIssues: [
      {
        issue: 'Authentication Failures',
        solution: 'Ensure JWT tokens are valid and include required claims',
      },
      {
        issue: 'Data Format Mismatches',
        solution: 'Check transformation rules and test with /api/transform/test',
      },
      {
        issue: 'Performance Issues',
        solution: 'Enable caching and monitor API response times',
      },
      {
        issue: 'Version Compatibility Warnings',
        solution: 'Update client to use supported API versions',
      },
    ],
    support: {
      documentation: '/docs',
      healthCheck: '/health',
      versionInfo: '/api/versions',
      migrationStatus: '/migration/status',
    },
  };
  
  res.json(guide);
}));

/**
 * API examples
 */
router.get('/examples', asyncHandler(async (req: Request, res: Response) => {
  const examples = {
    title: 'API Usage Examples',
    authentication: {
      description: 'How to authenticate API requests',
      example: {
        curl: `curl -H "Authorization: Bearer <jwt-token>" \\
     -H "X-API-Version: 2.1" \\
     -H "X-Client-Version: 2.1.0" \\
     https://compatibility-layer/api/v2/metrics`,
        javascript: `fetch('https://compatibility-layer/api/v2/metrics', {
  headers: {
    'Authorization': 'Bearer <jwt-token>',
    'X-API-Version': '2.1',
    'X-Client-Version': '2.1.0',
    'Content-Type': 'application/json'
  }
})`,
      },
    },
    versionNegotiation: {
      description: 'How version negotiation works',
      examples: [
        {
          request: 'X-API-Version: 1.0',
          response: 'X-API-Deprecated: true, X-API-Recommended-Version: 3.0',
        },
        {
          request: 'X-API-Version: 3.0',
          response: 'X-API-Version: 3.0',
        },
      ],
    },
    dataTransformation: {
      description: 'Example of data transformation between versions',
      v1Request: {
        user_id: 123,
        timestamp: '2023-12-01 10:30:00',
        tenant_id: 'default',
      },
      v3Request: {
        userId: 123,
        createdAt: '2023-12-01T10:30:00.000Z',
        tenantId: 'default',
        version: '3.0',
      },
    },
    migrationBatch: {
      description: 'Creating a migration batch',
      request: {
        batchName: 'User Data Migration',
        dataSource: 'legacy_users',
        fromVersion: '1.0',
        toVersion: '3.0',
        estimatedRecords: 50000,
      },
      response: {
        batchId: 'batch_1639234567890_abc123',
        message: 'Migration batch created successfully',
        estimatedTasks: 50,
        timestamp: '2023-12-01T10:30:00.000Z',
      },
    },
  };
  
  res.json(examples);
}));

/**
 * FAQ
 */
router.get('/faq', asyncHandler(async (req: Request, res: Response) => {
  const faq = {
    title: 'Frequently Asked Questions',
    questions: [
      {
        question: 'How long will the compatibility layer be supported?',
        answer: 'The compatibility layer will be supported until all clients have migrated to EPM v3.0, with a minimum support period of 12 months.',
      },
      {
        question: 'What happens if the new EPM API is unavailable?',
        answer: 'The compatibility layer will automatically failover to the legacy APM API to ensure service continuity.',
      },
      {
        question: 'How do I know which API version my client is using?',
        answer: 'Check the response headers for X-API-Version, or call the /api/versions endpoint to see version information.',
      },
      {
        question: 'Can I test data transformations before migration?',
        answer: 'Yes, use the /api/transform/test endpoint to validate data transformations between versions.',
      },
      {
        question: 'What authentication methods are supported?',
        answer: 'Currently, JWT Bearer tokens are supported. The token should include user ID, roles, and tenant information.',
      },
      {
        question: 'How do I monitor migration progress?',
        answer: 'Use the /migration/status endpoint to check overall status, or /migration/batches/<id> for specific batch progress.',
      },
      {
        question: 'What should I do if I encounter compatibility issues?',
        answer: 'Check the migration guide at /docs/migration-guide, review the FAQ, and contact support if issues persist.',
      },
    ],
  };
  
  res.json(faq);
}));

export { router as documentationRoutes };
