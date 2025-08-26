import { ApolloServer } from '@apollo/server';
import { expressMiddleware } from '@apollo/server/express4';
import { ApolloGateway, IntrospectAndCompose, RemoteGraphQLDataSource } from '@apollo/gateway';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import slowDown from 'express-slow-down';
import { json } from 'body-parser';
import { createProxyMiddleware } from 'http-proxy-middleware';
import jwt from 'jsonwebtoken';
import { config } from '@/config/environment';
import { logger } from '@/utils/logger';
import { metrics } from '@/middleware/metrics';
import { authentication } from '@/middleware/authentication';
import { authorization } from '@/middleware/authorization';
import { errorHandler } from '@/middleware/errorHandler';
import { requestLogger } from '@/middleware/requestLogger';
import { healthCheck } from '@/routes/health';
import { swaggerSpec, swaggerUi } from '@/config/swagger';
import { RedisCache } from '@/services/cache';
import { createContext } from '@/context';
import { GraphQLError, GraphQLFormattedError } from 'graphql';
import depthLimit from 'graphql-depth-limit';
import costAnalysis from 'graphql-cost-analysis';

/**
 * AIRIS EPM API Gateway
 * GraphQL Federation Gateway with authentication, authorization, caching, and monitoring
 */
class APIGateway {
  private app: express.Application;
  private server: ApolloServer;
  private gateway: ApolloGateway;
  private cache: RedisCache;

  constructor() {
    this.app = express();
    this.cache = new RedisCache(config.redis);
    this.setupGateway();
    this.setupMiddleware();
    this.setupRoutes();
  }

  /**
   * Configure Apollo Federation Gateway
   */
  private setupGateway(): void {
    this.gateway = new ApolloGateway({
      supergraphSdl: new IntrospectAndCompose({
        subgraphs: [
          {
            name: 'metrics',
            url: `${config.services.metricsService}/graphql`,
          },
          {
            name: 'logs',
            url: `${config.services.logsService}/graphql`,
          },
          {
            name: 'traces',
            url: `${config.services.tracesService}/graphql`,
          },
          {
            name: 'alerts',
            url: `${config.services.alertsService}/graphql`,
          },
          {
            name: 'users',
            url: `${config.services.userService}/graphql`,
          },
          {
            name: 'dashboards',
            url: `${config.services.dashboardService}/graphql`,
          },
        ],
      }),
      buildService: ({ url }) => {
        return new RemoteGraphQLDataSource({
          url,
          willSendRequest({ request, context }) {
            // Forward authentication headers to subgraphs
            if (context.user) {
              request.http?.headers.set('x-user-id', context.user.id);
              request.http?.headers.set('x-user-role', context.user.role);
              request.http?.headers.set('x-tenant-id', context.user.tenantId || '');
            }
            
            // Forward request ID for tracing
            if (context.requestId) {
              request.http?.headers.set('x-request-id', context.requestId);
            }
          },
        });
      },
    });

    this.server = new ApolloServer({
      gateway: this.gateway,
      context: createContext,
      formatError: this.formatError,
      plugins: [
        {
          requestDidStart() {
            return {
              didResolveOperation(requestContext) {
                // Log GraphQL operations
                logger.info('GraphQL Operation', {
                  operationName: requestContext.request.operationName,
                  query: requestContext.request.query,
                  variables: requestContext.request.variables,
                  userId: requestContext.contextValue.user?.id,
                });
              },
              didEncounterErrors(requestContext) {
                // Log GraphQL errors
                logger.error('GraphQL Errors', {
                  errors: requestContext.errors,
                  operationName: requestContext.request.operationName,
                  userId: requestContext.contextValue.user?.id,
                });
              },
            };
          },
        },
        // Query complexity analysis
        {
          requestDidStart() {
            return {
              didResolveOperation({ request, document }) {
                const complexity = costAnalysis.getComplexity({
                  estimators: [
                    costAnalysis.fieldExtensionsEstimator(),
                    costAnalysis.simpleEstimator({ defaultComplexity: 1 }),
                  ],
                  maximumComplexity: config.graphql.maxComplexity,
                  variables: request.variables,
                  document,
                });

                if (complexity >= config.graphql.maxComplexity) {
                  throw new GraphQLError(
                    `Query is too complex: ${complexity}. Maximum allowed complexity: ${config.graphql.maxComplexity}.`
                  );
                }
              },
            };
          },
        },
      ],
      validationRules: [
        depthLimit(config.graphql.maxDepth),
      ],
    });
  }

  /**
   * Setup Express middleware
   */
  private setupMiddleware(): void {
    // Basic security and performance middleware
    this.app.use(helmet({
      contentSecurityPolicy: false, // Allow GraphQL Playground
      crossOriginEmbedderPolicy: false,
    }));
    
    this.app.use(compression());
    
    this.app.use(cors({
      origin: config.cors.origins,
      credentials: config.cors.credentials,
      methods: ['GET', 'POST', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'x-request-id'],
    }));

    // Rate limiting
    const limiter = rateLimit({
      windowMs: config.rateLimiting.windowMs,
      max: config.rateLimiting.maxRequests,
      message: 'Too many requests from this IP, please try again later.',
      standardHeaders: true,
      legacyHeaders: false,
    });
    this.app.use('/graphql', limiter);

    // Slow down repeated requests
    const speedLimiter = slowDown({
      windowMs: 15 * 60 * 1000, // 15 minutes
      delayAfter: 50,
      delayMs: 500,
    });
    this.app.use('/graphql', speedLimiter);

    // Request logging and metrics
    this.app.use(requestLogger);
    this.app.use(metrics);

    // Parse JSON with size limit
    this.app.use(json({ limit: config.server.maxPayloadSize }));
  }

  /**
   * Setup application routes
   */
  private setupRoutes(): void {
    // Health check endpoint
    this.app.use('/health', healthCheck);

    // API documentation
    this.app.use('/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

    // GraphQL endpoint with authentication
    this.app.use(
      '/graphql',
      authentication,
      authorization,
      expressMiddleware(this.server, {
        context: async ({ req }) => createContext({ req }),
      })
    );

    // REST API proxy for backward compatibility with AIRIS APM
    this.app.use(
      '/api/v1',
      authentication,
      createProxyMiddleware({
        target: config.services.legacyApiUrl,
        changeOrigin: true,
        pathRewrite: {
          '^/api/v1': '/api/v1',
        },
        onProxyReq: (proxyReq, req) => {
          // Forward authentication headers
          if (req.user) {
            proxyReq.setHeader('x-user-id', req.user.id);
            proxyReq.setHeader('x-user-role', req.user.role);
          }
        },
      })
    );

    // WebSocket endpoint for subscriptions
    this.app.use('/subscriptions', (req, res) => {
      res.status(501).json({
        error: 'WebSocket subscriptions not yet implemented',
        message: 'This endpoint will support real-time GraphQL subscriptions',
      });
    });

    // Error handling middleware
    this.app.use(errorHandler);

    // 404 handler
    this.app.use('*', (req, res) => {
      res.status(404).json({
        error: 'Not Found',
        message: `Route ${req.originalUrl} not found`,
        availableEndpoints: [
          '/health',
          '/docs',
          '/graphql',
          '/api/v1/*',
        ],
      });
    });
  }

  /**
   * Format GraphQL errors
   */
  private formatError(formattedError: GraphQLFormattedError, error: unknown): GraphQLFormattedError {
    // Log the error
    logger.error('GraphQL Error', {
      error: formattedError,
      stack: error instanceof Error ? error.stack : undefined,
    });

    // Don't expose internal errors in production
    if (config.env === 'production' && !formattedError.extensions?.code) {
      return {
        message: 'Internal server error',
        extensions: {
          code: 'INTERNAL_ERROR',
        },
      };
    }

    return formattedError;
  }

  /**
   * Start the server
   */
  public async start(): Promise<void> {
    try {
      // Start Apollo Server
      await this.server.start();
      logger.info('Apollo Federation Gateway started');

      // Start Express server
      const server = this.app.listen(config.server.port, () => {
        logger.info(`🚀 AIRIS EPM API Gateway ready at http://localhost:${config.server.port}/graphql`);
        logger.info(`📚 API Documentation available at http://localhost:${config.server.port}/docs`);
        logger.info(`🔍 Health check available at http://localhost:${config.server.port}/health`);
      });

      // Graceful shutdown
      process.on('SIGTERM', async () => {
        logger.info('SIGTERM signal received: closing HTTP server');
        server.close(() => {
          logger.info('HTTP server closed');
        });
        await this.server.stop();
        await this.cache.disconnect();
        process.exit(0);
      });

      process.on('SIGINT', async () => {
        logger.info('SIGINT signal received: closing HTTP server');
        server.close(() => {
          logger.info('HTTP server closed');
        });
        await this.server.stop();
        await this.cache.disconnect();
        process.exit(0);
      });

    } catch (error) {
      logger.error('Failed to start server:', error);
      process.exit(1);
    }
  }
}

// Start the server if this file is run directly
if (require.main === module) {
  const gateway = new APIGateway();
  gateway.start().catch((error) => {
    logger.error('Failed to start API Gateway:', error);
    process.exit(1);
  });
}

export default APIGateway;