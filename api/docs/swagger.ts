
import swaggerJsdoc from 'swagger-jsdoc';

const options: swaggerJsdoc.Options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'KnowledgeMap API',
      version: '1.0.0',
      description: 'API documentation for KnowledgeMap Application',
    },
    servers: [
      {
        url: '/api',
        description: 'API Base URL',
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
    },
    security: [
      {
        bearerAuth: [],
      },
    ],
  },
  // Use absolute paths or correct relative paths from the root where the app is started
  apis: ['./api/routes/*.ts'], 
};

export const swaggerSpec = swaggerJsdoc(options);
