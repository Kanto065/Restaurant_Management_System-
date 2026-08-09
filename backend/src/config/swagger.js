import swaggerJsdoc from 'swagger-jsdoc';

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Takeout Restaurant Backend API',
      version: '1.0.0',
    //   description: `
    //     A comprehensive restaurant management backend with real-time order tracking.
        
    //     ## Features
    //     - 🔐 JWT Authentication with master password support
    //     - 🍽️ Restaurant Management (details, logo)
    //     - 🍕 Food Management (CRUD with image uploads)
    //     - 🪑 Table Management (unique URLs for each table)
    //     - 📱 Customer Ordering (public URLs)
    //     - 💳 Payment Integration (SSLCommerz - Bangladesh)
    //     - ⚡ Real-time Updates (Socket.io)
        
    //     ## Authentication
    //     Most endpoints require authentication. Include the JWT token in the Authorization header:
    //     \`\`\`
    //     Authorization: Bearer <your_token>
    //     \`\`\`
        
    //     ## Socket.io Events
        
    //     ### Client → Server
    //     - \`join-restaurant\` - Join restaurant room (for owners)
    //     - \`join-order\` - Join order room (for customers)
    //     - \`leave-restaurant\` - Leave restaurant room
    //     - \`leave-order\` - Leave order room
        
    //     ### Server → Client
    //     - \`order-created\` - New order notification
    //     - \`order-status-updated\` - Order status changed
    //     - \`order-time-updated\` - Estimated time updated
    //     - \`payment-completed\` - Payment completed
        
    //     ## File Uploads
    //     Image uploads support JPEG, PNG, GIF formats up to 5MB.
    //   `,
      contact: {
        name: 'API Support',
        email: 'support@takeout.com'
      },
      license: {
        name: 'ISC',
        url: 'https://opensource.org/licenses/ISC'
      }
    },
    servers: [
      {
        url: 'http://localhost:7878',
        description: 'Development server',
      },
      {
        url: 'https://api.takeout.com',
        description: 'Production server'
      }
    ],
    tags: [
      {
        name: 'Authentication',
        description: 'Owner authentication and account management'
      },
      {
        name: 'Restaurant',
        description: 'Restaurant details and logo management'
      },
      {
        name: 'Foods',
        description: 'Food item management (CRUD operations)'
      },
      {
        name: 'Tables',
        description: 'Table management with unique URLs'
      },
      {
        name: 'Orders',
        description: 'Order management and tracking'
      },
      {
        name: 'Public',
        description: 'Public endpoints for customers'
      },
      {
        name: 'Payment',
        description: 'Payment gateway integration (SSLCommerz)'
      }
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'Enter your JWT token'
        }
      },
      schemas: {
        Error: {
          type: 'object',
          properties: {
            success: {
              type: 'boolean',
              example: false
            },
            statusCode: {
              type: 'integer',
              example: 400
            },
            message: {
              type: 'string',
              example: 'Error message'
            }
          }
        },
        Success: {
          type: 'object',
          properties: {
            success: {
              type: 'boolean',
              example: true
            },
            statusCode: {
              type: 'integer',
              example: 200
            },
            message: {
              type: 'string',
              example: 'Success message'
            },
            data: {
              type: 'object'
            }
          }
        }
      }
    }
  },
  apis: ['./src/features/**/*.routes.js']
};

const swaggerSpec = swaggerJsdoc(options);

export default swaggerSpec;
