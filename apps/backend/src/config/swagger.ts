import { Request, Response } from 'express';
import type { Express } from 'express';
import swaggerUi from 'swagger-ui-express';

// OpenAPI 3.0 Specification for Rentars API
export const openApiSpec = {
  openapi: '3.0.0',
  info: {
    title: 'Rentars API',
    version: '1.0.0',
    description: 'Backend API for Rentars — decentralized P2P rental platform on Stellar blockchain',
    contact: {
      name: 'Rentars Team',
      email: 'contact@rentars.io',
    },
    license: {
      name: 'Apache-2.0',
      url: 'https://www.apache.org/licenses/LICENSE-2.0',
    },
  },
  servers: [
    {
      url: 'http://localhost:3000',
      description: 'Local development server',
    },
    {
      url: 'https://api.rentars.io',
      description: 'Production server',
    },
  ],
  components: {
    securitySchemes: {
      bearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description: 'JWT token from /auth/login or /auth/register',
      },
      walletAuth: {
        type: 'apiKey',
        in: 'header',
        name: 'X-Wallet-Address',
        description: 'Stellar wallet address for wallet-based authentication',
      },
    },
    schemas: {
      // Auth schemas
      RegisterRequest: {
        type: 'object',
        required: ['email', 'password'],
        properties: {
          email: { type: 'string', format: 'email' },
          password: { type: 'string', minLength: 8 },
          walletAddress: { type: 'string' },
        },
      },
      LoginRequest: {
        type: 'object',
        required: ['email', 'password'],
        properties: {
          email: { type: 'string', format: 'email' },
          password: { type: 'string' },
        },
      },
      AuthResponse: {
        type: 'object',
        properties: {
          token: { type: 'string' },
          user: { $ref: '#/components/schemas/User' },
        },
      },
      User: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          email: { type: 'string', format: 'email' },
          role: { type: 'string', enum: ['owner', 'tenant', 'admin'] },
          walletAddress: { type: 'string' },
          createdAt: { type: 'string', format: 'date-time' },
        },
      },

      // Property schemas
      Property: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          ownerId: { type: 'string', format: 'uuid' },
          title: { type: 'string' },
          description: { type: 'string' },
          pricePerNight: { type: 'number' },
          location: { type: 'string' },
          images: { type: 'array', items: { type: 'string' } },
          amenities: { type: 'array', items: { type: 'string' } },
          bedrooms: { type: 'integer' },
          bathrooms: { type: 'integer' },
          maxGuests: { type: 'integer' },
          status: { type: 'string', enum: ['active', 'inactive', 'pending'] },
          createdAt: { type: 'string', format: 'date-time' },
          updatedAt: { type: 'string', format: 'date-time' },
        },
      },
      CreatePropertyRequest: {
        type: 'object',
        required: ['title', 'description', 'pricePerNight', 'location'],
        properties: {
          title: { type: 'string', minLength: 3, maxLength: 200 },
          description: { type: 'string', minLength: 10 },
          pricePerNight: { type: 'number', minimum: 1 },
          location: { type: 'string', minLength: 2 },
          images: { type: 'array', items: { type: 'string' } },
          amenities: { type: 'array', items: { type: 'string' } },
          bedrooms: { type: 'integer', minimum: 0 },
          bathrooms: { type: 'integer', minimum: 0 },
          maxGuests: { type: 'integer', minimum: 1 },
        },
      },
      UpdatePropertyRequest: {
        type: 'object',
        properties: {
          title: { type: 'string', minLength: 3, maxLength: 200 },
          description: { type: 'string', minLength: 10 },
          pricePerNight: { type: 'number', minimum: 1 },
          location: { type: 'string', minLength: 2 },
          images: { type: 'array', items: { type: 'string' } },
          amenities: { type: 'array', items: { type: 'string' } },
          bedrooms: { type: 'integer', minimum: 0 },
          bathrooms: { type: 'integer', minimum: 0 },
          maxGuests: { type: 'integer', minimum: 1 },
          status: { type: 'string', enum: ['active', 'inactive', 'pending'] },
        },
      },
      PropertyListResponse: {
        type: 'object',
        properties: {
          properties: { type: 'array', items: { $ref: '#/components/schemas/Property' } },
          total: { type: 'integer' },
          page: { type: 'integer' },
          limit: { type: 'integer' },
        },
      },

      // Booking schemas
      Booking: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          propertyId: { type: 'string', format: 'uuid' },
          tenantId: { type: 'string', format: 'uuid' },
          checkIn: { type: 'string', format: 'date' },
          checkOut: { type: 'string', format: 'date' },
          totalPrice: { type: 'number' },
          status: { type: 'string', enum: ['pending', 'confirmed', 'cancelled', 'completed'] },
          escrowTxHash: { type: 'string' },
          createdAt: { type: 'string', format: 'date-time' },
          updatedAt: { type: 'string', format: 'date-time' },
        },
      },
      CreateBookingRequest: {
        type: 'object',
        required: ['propertyId', 'checkIn', 'checkOut'],
        properties: {
          propertyId: { type: 'string', format: 'uuid' },
          checkIn: { type: 'string', format: 'date' },
          checkOut: { type: 'string', format: 'date' },
        },
      },
      UpdateBookingRequest: {
        type: 'object',
        properties: {
          status: { type: 'string', enum: ['confirmed', 'cancelled'] },
          escrowTxHash: { type: 'string' },
        },
      },

      // Error schemas
      Error: {
        type: 'object',
        properties: {
          error: { type: 'string' },
          message: { type: 'string' },
          statusCode: { type: 'integer' },
        },
      },
      ValidationError: {
        type: 'object',
        properties: {
          error: { type: 'string', example: 'Validation Error' },
          details: { type: 'array', items: { type: 'object' } },
        },
      },

      // Location schemas
      Location: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          name: { type: 'string' },
          country: { type: 'string' },
          region: { type: 'string' },
          latitude: { type: 'number' },
          longitude: { type: 'number' },
        },
      },

      // Review schemas
      Review: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          propertyId: { type: 'string', format: 'uuid' },
          authorId: { type: 'string', format: 'uuid' },
          rating: { type: 'number', minimum: 1, maximum: 5 },
          comment: { type: 'string' },
          createdAt: { type: 'string', format: 'date-time' },
          updatedAt: { type: 'string', format: 'date-time' },
        },
      },
      CreateReviewRequest: {
        type: 'object',
        required: ['propertyId', 'rating', 'comment'],
        properties: {
          propertyId: { type: 'string', format: 'uuid' },
          rating: { type: 'number', minimum: 1, maximum: 5 },
          comment: { type: 'string', minLength: 10 },
        },
      },
      ReviewResponse: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          propertyId: { type: 'string', format: 'uuid' },
          authorId: { type: 'string', format: 'uuid' },
          rating: { type: 'number', minimum: 1, maximum: 5 },
          comment: { type: 'string' },
          hostResponse: { type: 'string' },
          createdAt: { type: 'string', format: 'date-time' },
          updatedAt: { type: 'string', format: 'date-time' },
        },
      },

      // Wishlist schemas
      Wishlist: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          userId: { type: 'string', format: 'uuid' },
          propertyId: { type: 'string', format: 'uuid' },
          createdAt: { type: 'string', format: 'date-time' },
        },
      },
      WishlistResponse: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          userId: { type: 'string', format: 'uuid' },
          properties: { type: 'array', items: { $ref: '#/components/schemas/Property' } },
          total: { type: 'integer' },
        },
      },

      // Notification schemas
      Notification: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          userId: { type: 'string', format: 'uuid' },
          title: { type: 'string' },
          message: { type: 'string' },
          type: { type: 'string', enum: ['booking', 'review', 'system', 'message'] },
          read: { type: 'boolean' },
          createdAt: { type: 'string', format: 'date-time' },
        },
      },
      NotificationPreferences: {
        type: 'object',
        properties: {
          userId: { type: 'string', format: 'uuid' },
          emailNotifications: { type: 'boolean' },
          pushNotifications: { type: 'boolean' },
          smsNotifications: { type: 'boolean' },
          createdAt: { type: 'string', format: 'date-time' },
          updatedAt: { type: 'string', format: 'date-time' },
        },
      },

      // Calendar schemas
      CalendarAvailability: {
        type: 'object',
        properties: {
          propertyId: { type: 'string', format: 'uuid' },
          date: { type: 'string', format: 'date' },
          available: { type: 'boolean' },
          price: { type: 'number' },
        },
      },
      SeasonalRate: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          propertyId: { type: 'string', format: 'uuid' },
          seasonName: { type: 'string' },
          startDate: { type: 'string', format: 'date' },
          endDate: { type: 'string', format: 'date' },
          priceMultiplier: { type: 'number', minimum: 0.1, maximum: 10 },
          createdAt: { type: 'string', format: 'date-time' },
        },
      },
      CreateSeasonalRateRequest: {
        type: 'object',
        required: ['seasonName', 'startDate', 'endDate', 'priceMultiplier'],
        properties: {
          seasonName: { type: 'string' },
          startDate: { type: 'string', format: 'date' },
          endDate: { type: 'string', format: 'date' },
          priceMultiplier: { type: 'number', minimum: 0.1, maximum: 10 },
        },
      },
      CalendarEvent: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          propertyId: { type: 'string', format: 'uuid' },
          title: { type: 'string' },
          startDate: { type: 'string', format: 'date' },
          endDate: { type: 'string', format: 'date' },
          type: { type: 'string', enum: ['blocked', 'maintenance', 'booking'] },
          createdAt: { type: 'string', format: 'date-time' },
        },
      },
    },
    responses: {
      BadRequest: {
        description: 'Bad Request - Invalid input data',
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/ValidationError' },
          },
        },
      },
      Unauthorized: {
        description: 'Unauthorized - Invalid or missing authentication',
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/Error' },
          },
        },
      },
      Forbidden: {
        description: 'Forbidden - Insufficient permissions',
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/Error' },
          },
        },
      },
      NotFound: {
        description: 'Not Found - Resource does not exist',
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/Error' },
          },
        },
      },
      Conflict: {
        description: 'Conflict - Resource already exists',
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/Error' },
          },
        },
      },
      InternalServerError: {
        description: 'Internal Server Error',
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/Error' },
          },
        },
      },
    },
  },
  paths: {
    '/health': {
      get: {
        summary: 'Health check endpoint',
        description: 'Returns API health status',
        tags: ['Health'],
        responses: {
          '200': {
            description: 'API is healthy',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    status: { type: 'string', example: 'ok' },
                    timestamp: { type: 'string', format: 'date-time' },
                  },
                },
              },
            },
          },
        },
      },
    },
    // Auth endpoints
    '/auth/register': {
      post: {
        summary: 'Register a new user',
        description: 'Create a new user account with email/password and optional wallet address',
        tags: ['Authentication'],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/RegisterRequest' },
            },
          },
        },
        responses: {
          '201': {
            description: 'User registered successfully',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/AuthResponse' },
              },
            },
          },
          '400': { $ref: '#/components/responses/BadRequest' },
          '409': { $ref: '#/components/responses/Conflict' },
        },
      },
    },
    '/auth/login': {
      post: {
        summary: 'Login user',
        description: 'Authenticate with email and password to receive JWT token',
        tags: ['Authentication'],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/LoginRequest' },
            },
          },
        },
        responses: {
          '200': {
            description: 'Login successful',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/AuthResponse' },
              },
            },
          },
          '401': { $ref: '#/components/responses/Unauthorized' },
        },
      },
    },

    // Property endpoints
    '/api/properties': {
      get: {
        summary: 'List properties',
        description: 'Get all available properties with optional filtering',
        tags: ['Properties'],
        parameters: [
          {
            name: 'location',
            in: 'query',
            description: 'Filter by location',
            schema: { type: 'string' },
          },
          {
            name: 'minPrice',
            in: 'query',
            description: 'Minimum price per night',
            schema: { type: 'number' },
          },
          {
            name: 'maxPrice',
            in: 'query',
            description: 'Maximum price per night',
            schema: { type: 'number' },
          },
          {
            name: 'page',
            in: 'query',
            description: 'Page number for pagination',
            schema: { type: 'integer', default: 1 },
          },
          {
            name: 'limit',
            in: 'query',
            description: 'Items per page',
            schema: { type: 'integer', default: 20 },
          },
        ],
        responses: {
          '200': {
            description: 'Properties list',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/PropertyListResponse' },
              },
            },
          },
        },
      },
      post: {
        summary: 'Create property',
        description: 'Create a new property listing (owner only)',
        tags: ['Properties'],
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/CreatePropertyRequest' },
            },
          },
        },
        responses: {
          '201': {
            description: 'Property created',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/Property' },
              },
            },
          },
          '400': { $ref: '#/components/responses/BadRequest' },
          '401': { $ref: '#/components/responses/Unauthorized' },
          '403': { $ref: '#/components/responses/Forbidden' },
        },
      },
    },
    '/api/properties/{id}': {
      get: {
        summary: 'Get property',
        description: 'Get a single property by ID',
        tags: ['Properties'],
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            description: 'Property UUID',
            schema: { type: 'string', format: 'uuid' },
          },
        ],
        responses: {
          '200': {
            description: 'Property details',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/Property' },
              },
            },
          },
          '404': { $ref: '#/components/responses/NotFound' },
        },
      },
      put: {
        summary: 'Update property',
        description: 'Update a property (owner only)',
        tags: ['Properties'],
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            description: 'Property UUID',
            schema: { type: 'string', format: 'uuid' },
          },
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/UpdatePropertyRequest' },
            },
          },
        },
        responses: {
          '200': {
            description: 'Property updated',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/Property' },
              },
            },
          },
          '401': { $ref: '#/components/responses/Unauthorized' },
          '403': { $ref: '#/components/responses/Forbidden' },
          '404': { $ref: '#/components/responses/NotFound' },
        },
      },
      delete: {
        summary: 'Delete property',
        description: 'Delete a property (owner only)',
        tags: ['Properties'],
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            description: 'Property UUID',
            schema: { type: 'string', format: 'uuid' },
          },
        ],
        responses: {
          '204': { description: 'Property deleted' },
          '401': { $ref: '#/components/responses/Unauthorized' },
          '403': { $ref: '#/components/responses/Forbidden' },
          '404': { $ref: '#/components/responses/NotFound' },
        },
      },
    },

    // Booking endpoints
    '/api/bookings': {
      get: {
        summary: 'List bookings',
        description: 'Get bookings for the authenticated user',
        tags: ['Bookings'],
        security: [{ bearerAuth: [] }],
        responses: {
          '200': {
            description: 'Bookings list',
            content: {
              'application/json': {
                schema: {
                  type: 'array',
                  items: { $ref: '#/components/schemas/Booking' },
                },
              },
            },
          },
          '401': { $ref: '#/components/responses/Unauthorized' },
        },
      },
      post: {
        summary: 'Create booking',
        description: 'Create a new booking for a property',
        tags: ['Bookings'],
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/CreateBookingRequest' },
            },
          },
        },
        responses: {
          '201': {
            description: 'Booking created',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/Booking' },
              },
            },
          },
          '400': { $ref: '#/components/responses/BadRequest' },
          '401': { $ref: '#/components/responses/Unauthorized' },
        },
      },
    },
    '/api/bookings/{id}': {
      get: {
        summary: 'Get booking',
        description: 'Get a single booking by ID',
        tags: ['Bookings'],
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            description: 'Booking UUID',
            schema: { type: 'string', format: 'uuid' },
          },
        ],
        responses: {
          '200': {
            description: 'Booking details',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/Booking' },
              },
            },
          },
          '401': { $ref: '#/components/responses/Unauthorized' },
          '404': { $ref: '#/components/responses/NotFound' },
        },
      },
      patch: {
        summary: 'Update booking',
        description: 'Update booking status or escrow transaction',
        tags: ['Bookings'],
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            description: 'Booking UUID',
            schema: { type: 'string', format: 'uuid' },
          },
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/UpdateBookingRequest' },
            },
          },
        },
        responses: {
          '200': {
            description: 'Booking updated',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/Booking' },
              },
            },
          },
          '401': { $ref: '#/components/responses/Unauthorized' },
          '404': { $ref: '#/components/responses/NotFound' },
        },
      },
      delete: {
        summary: 'Cancel booking',
        description: 'Cancel a booking and refund escrow',
        tags: ['Bookings'],
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            description: 'Booking UUID',
            schema: { type: 'string', format: 'uuid' },
          },
        ],
        responses: {
          '204': { description: 'Booking cancelled' },
          '401': { $ref: '#/components/responses/Unauthorized' },
          '404': { $ref: '#/components/responses/NotFound' },
        },
      },
    },

    // Location endpoints
    '/api/locations': {
      get: {
        summary: 'List locations',
        description: 'Get all available locations for property search',
        tags: ['Locations'],
        responses: {
          '200': {
            description: 'Locations list',
            content: {
              'application/json': {
                schema: {
                  type: 'array',
                  items: { $ref: '#/components/schemas/Location' },
                },
              },
            },
          },
        },
      },
    },

    // Review endpoints
    '/api/reviews': {
      post: {
        summary: 'Create review',
        description: 'Submit a review for a property',
        tags: ['Reviews'],
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/CreateReviewRequest' },
            },
          },
        },
        responses: {
          '201': {
            description: 'Review created',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/Review' },
              },
            },
          },
          '400': { $ref: '#/components/responses/BadRequest' },
          '401': { $ref: '#/components/responses/Unauthorized' },
        },
      },
    },
    '/api/reviews/property/{id}': {
      get: {
        summary: 'Get property reviews',
        description: 'Get all reviews for a specific property',
        tags: ['Reviews'],
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            description: 'Property UUID',
            schema: { type: 'string', format: 'uuid' },
          },
        ],
        responses: {
          '200': {
            description: 'Property reviews',
            content: {
              'application/json': {
                schema: {
                  type: 'array',
                  items: { $ref: '#/components/schemas/ReviewResponse' },
                },
              },
            },
          },
          '404': { $ref: '#/components/responses/NotFound' },
        },
      },
    },
    '/api/reviews/user/{id}': {
      get: {
        summary: 'Get user reviews',
        description: 'Get all reviews by a specific user',
        tags: ['Reviews'],
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            description: 'User UUID',
            schema: { type: 'string', format: 'uuid' },
          },
        ],
        responses: {
          '200': {
            description: 'User reviews',
            content: {
              'application/json': {
                schema: {
                  type: 'array',
                  items: { $ref: '#/components/schemas/ReviewResponse' },
                },
              },
            },
          },
        },
      },
    },
    '/api/reviews/user/{id}/average': {
      get: {
        summary: 'Get user average rating',
        description: 'Get average rating for a specific user',
        tags: ['Reviews'],
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            description: 'User UUID',
            schema: { type: 'string', format: 'uuid' },
          },
        ],
        responses: {
          '200': {
            description: 'Average rating',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    userId: { type: 'string', format: 'uuid' },
                    averageRating: { type: 'number', minimum: 1, maximum: 5 },
                    reviewCount: { type: 'integer' },
                  },
                },
              },
            },
          },
        },
      },
    },
    '/api/reviews/{id}/response': {
      post: {
        summary: 'Respond to review',
        description: 'Host responds to a review',
        tags: ['Reviews'],
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            description: 'Review UUID',
            schema: { type: 'string', format: 'uuid' },
          },
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['response'],
                properties: {
                  response: { type: 'string', minLength: 10 },
                },
              },
            },
          },
        },
        responses: {
          '200': {
            description: 'Response added',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ReviewResponse' },
              },
            },
          },
          '401': { $ref: '#/components/responses/Unauthorized' },
          '404': { $ref: '#/components/responses/NotFound' },
        },
      },
    },
    '/api/reviews/{id}/flag': {
      post: {
        summary: 'Report review',
        description: 'Report a review for moderation',
        tags: ['Reviews'],
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            description: 'Review UUID',
            schema: { type: 'string', format: 'uuid' },
          },
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['reason'],
                properties: {
                  reason: { type: 'string' },
                },
              },
            },
          },
        },
        responses: {
          '200': {
            description: 'Review reported',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    message: { type: 'string' },
                  },
                },
              },
            },
          },
          '401': { $ref: '#/components/responses/Unauthorized' },
        },
      },
    },
    '/api/reviews/moderation/flagged': {
      get: {
        summary: 'List flagged reviews',
        description: 'Get all flagged reviews for moderation (admin only)',
        tags: ['Reviews'],
        security: [{ bearerAuth: [] }],
        responses: {
          '200': {
            description: 'Flagged reviews',
            content: {
              'application/json': {
                schema: {
                  type: 'array',
                  items: { $ref: '#/components/schemas/ReviewResponse' },
                },
              },
            },
          },
          '401': { $ref: '#/components/responses/Unauthorized' },
          '403': { $ref: '#/components/responses/Forbidden' },
        },
      },
    },
    '/api/reviews/{id}/moderate': {
      patch: {
        summary: 'Moderate flagged review',
        description: 'Approve or reject a flagged review (admin only)',
        tags: ['Reviews'],
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            description: 'Review UUID',
            schema: { type: 'string', format: 'uuid' },
          },
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['action'],
                properties: {
                  action: { type: 'string', enum: ['approve', 'reject'] },
                  reason: { type: 'string' },
                },
              },
            },
          },
        },
        responses: {
          '200': {
            description: 'Review moderated',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ReviewResponse' },
              },
            },
          },
          '401': { $ref: '#/components/responses/Unauthorized' },
          '403': { $ref: '#/components/responses/Forbidden' },
          '404': { $ref: '#/components/responses/NotFound' },
        },
      },
    },

    // Wishlist endpoints
    '/api/wishlists': {
      get: {
        summary: 'List user wishlist',
        description: 'Get all properties in user wishlist',
        tags: ['Wishlists'],
        security: [{ bearerAuth: [] }],
        responses: {
          '200': {
            description: 'Wishlist properties',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/WishlistResponse' },
              },
            },
          },
          '401': { $ref: '#/components/responses/Unauthorized' },
        },
      },
    },
    '/api/wishlists/{propertyId}': {
      post: {
        summary: 'Add to wishlist',
        description: 'Add a property to user wishlist',
        tags: ['Wishlists'],
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            name: 'propertyId',
            in: 'path',
            required: true,
            description: 'Property UUID',
            schema: { type: 'string', format: 'uuid' },
          },
        ],
        responses: {
          '201': {
            description: 'Added to wishlist',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/Wishlist' },
              },
            },
          },
          '401': { $ref: '#/components/responses/Unauthorized' },
          '404': { $ref: '#/components/responses/NotFound' },
        },
      },
      delete: {
        summary: 'Remove from wishlist',
        description: 'Remove a property from user wishlist',
        tags: ['Wishlists'],
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            name: 'propertyId',
            in: 'path',
            required: true,
            description: 'Property UUID',
            schema: { type: 'string', format: 'uuid' },
          },
        ],
        responses: {
          '204': { description: 'Removed from wishlist' },
          '401': { $ref: '#/components/responses/Unauthorized' },
          '404': { $ref: '#/components/responses/NotFound' },
        },
      },
    },

    // Notification endpoints
    '/api/notifications': {
      get: {
        summary: 'List notifications',
        description: 'Get all notifications for the authenticated user',
        tags: ['Notifications'],
        security: [{ bearerAuth: [] }],
        responses: {
          '200': {
            description: 'Notifications list',
            content: {
              'application/json': {
                schema: {
                  type: 'array',
                  items: { $ref: '#/components/schemas/Notification' },
                },
              },
            },
          },
          '401': { $ref: '#/components/responses/Unauthorized' },
        },
      },
    },
    '/api/notifications/read-all': {
      patch: {
        summary: 'Mark all notifications as read',
        description: 'Mark all notifications as read for the authenticated user',
        tags: ['Notifications'],
        security: [{ bearerAuth: [] }],
        responses: {
          '200': {
            description: 'All notifications marked as read',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    message: { type: 'string' },
                  },
                },
              },
            },
          },
          '401': { $ref: '#/components/responses/Unauthorized' },
        },
      },
    },
    '/api/notifications/{id}/read': {
      patch: {
        summary: 'Mark notification as read',
        description: 'Mark a specific notification as read',
        tags: ['Notifications'],
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            description: 'Notification UUID',
            schema: { type: 'string', format: 'uuid' },
          },
        ],
        responses: {
          '200': {
            description: 'Notification marked as read',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/Notification' },
              },
            },
          },
          '401': { $ref: '#/components/responses/Unauthorized' },
          '404': { $ref: '#/components/responses/NotFound' },
        },
      },
    },
    '/api/notifications/{id}': {
      delete: {
        summary: 'Delete notification',
        description: 'Delete a specific notification',
        tags: ['Notifications'],
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            description: 'Notification UUID',
            schema: { type: 'string', format: 'uuid' },
          },
        ],
        responses: {
          '204': { description: 'Notification deleted' },
          '401': { $ref: '#/components/responses/Unauthorized' },
          '404': { $ref: '#/components/responses/NotFound' },
        },
      },
    },
    '/api/notifications/preferences': {
      get: {
        summary: 'Get notification preferences',
        description: 'Get notification preferences for the authenticated user',
        tags: ['Notifications'],
        security: [{ bearerAuth: [] }],
        responses: {
          '200': {
            description: 'Notification preferences',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/NotificationPreferences' },
              },
            },
          },
          '401': { $ref: '#/components/responses/Unauthorized' },
        },
      },
      patch: {
        summary: 'Update notification preferences',
        description: 'Update notification preferences for the authenticated user',
        tags: ['Notifications'],
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/NotificationPreferences' },
            },
          },
        },
        responses: {
          '200': {
            description: 'Preferences updated',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/NotificationPreferences' },
              },
            },
          },
          '401': { $ref: '#/components/responses/Unauthorized' },
        },
      },
    },
    '/api/notifications/push/subscribe': {
      post: {
        summary: 'Register push subscription',
        description: 'Register for push notifications',
        tags: ['Notifications'],
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['subscription'],
                properties: {
                  subscription: { type: 'object' },
                },
              },
            },
          },
        },
        responses: {
          '201': {
            description: 'Push subscription registered',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    message: { type: 'string' },
                  },
                },
              },
            },
          },
          '401': { $ref: '#/components/responses/Unauthorized' },
        },
      },
    },
    '/api/notifications/push/unsubscribe': {
      post: {
        summary: 'Unregister push subscription',
        description: 'Unregister from push notifications',
        tags: ['Notifications'],
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['endpoint'],
                properties: {
                  endpoint: { type: 'string' },
                },
              },
            },
          },
        },
        responses: {
          '200': {
            description: 'Push subscription unregistered',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    message: { type: 'string' },
                  },
                },
              },
            },
          },
          '401': { $ref: '#/components/responses/Unauthorized' },
        },
      },
    },

    // Calendar endpoints
    '/api/calendar/{propertyId}/month': {
      get: {
        summary: 'Get calendar month',
        description: 'Get calendar availability for a property in a specific month',
        tags: ['Calendar'],
        parameters: [
          {
            name: 'propertyId',
            in: 'path',
            required: true,
            description: 'Property UUID',
            schema: { type: 'string', format: 'uuid' },
          },
          {
            name: 'month',
            in: 'query',
            description: 'Month (1-12)',
            schema: { type: 'integer', minimum: 1, maximum: 12 },
          },
          {
            name: 'year',
            in: 'query',
            description: 'Year',
            schema: { type: 'integer' },
          },
        ],
        responses: {
          '200': {
            description: 'Calendar month data',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    propertyId: { type: 'string' },
                    month: { type: 'integer' },
                    year: { type: 'integer' },
                    dates: {
                      type: 'array',
                      items: { $ref: '#/components/schemas/CalendarAvailability' },
                    },
                  },
                },
              },
            },
          },
          '404': { $ref: '#/components/responses/NotFound' },
        },
      },
    },
    '/api/calendar/{propertyId}/check': {
      get: {
        summary: 'Check availability',
        description: 'Check property availability for specific dates',
        tags: ['Calendar'],
        parameters: [
          {
            name: 'propertyId',
            in: 'path',
            required: true,
            description: 'Property UUID',
            schema: { type: 'string', format: 'uuid' },
          },
          {
            name: 'checkIn',
            in: 'query',
            required: true,
            description: 'Check-in date',
            schema: { type: 'string', format: 'date' },
          },
          {
            name: 'checkOut',
            in: 'query',
            required: true,
            description: 'Check-out date',
            schema: { type: 'string', format: 'date' },
          },
        ],
        responses: {
          '200': {
            description: 'Availability check result',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    available: { type: 'boolean' },
                    reason: { type: 'string' },
                  },
                },
              },
            },
          },
          '404': { $ref: '#/components/responses/NotFound' },
        },
      },
    },
    '/api/calendar/{propertyId}/price': {
      get: {
        summary: 'Get range price',
        description: 'Get total price for a date range',
        tags: ['Calendar'],
        parameters: [
          {
            name: 'propertyId',
            in: 'path',
            required: true,
            description: 'Property UUID',
            schema: { type: 'string', format: 'uuid' },
          },
          {
            name: 'checkIn',
            in: 'query',
            required: true,
            description: 'Check-in date',
            schema: { type: 'string', format: 'date' },
          },
          {
            name: 'checkOut',
            in: 'query',
            required: true,
            description: 'Check-out date',
            schema: { type: 'string', format: 'date' },
          },
        ],
        responses: {
          '200': {
            description: 'Price calculation result',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    totalPrice: { type: 'number' },
                    pricePerNight: { type: 'number' },
                    nights: { type: 'integer' },
                  },
                },
              },
            },
          },
          '404': { $ref: '#/components/responses/NotFound' },
        },
      },
    },
    '/api/calendar/{propertyId}/availability': {
      get: {
        summary: 'Get availability',
        description: 'Get full availability calendar for a property',
        tags: ['Calendar'],
        parameters: [
          {
            name: 'propertyId',
            in: 'path',
            required: true,
            description: 'Property UUID',
            schema: { type: 'string', format: 'uuid' },
          },
        ],
        responses: {
          '200': {
            description: 'Property availability',
            content: {
              'application/json': {
                schema: {
                  type: 'array',
                  items: { $ref: '#/components/schemas/CalendarAvailability' },
                },
              },
            },
          },
          '404': { $ref: '#/components/responses/NotFound' },
        },
      },
    },
    '/api/calendar/{propertyId}/seasons': {
      get: {
        summary: 'Get seasonal rates',
        description: 'Get seasonal rates for a property',
        tags: ['Calendar'],
        parameters: [
          {
            name: 'propertyId',
            in: 'path',
            required: true,
            description: 'Property UUID',
            schema: { type: 'string', format: 'uuid' },
          },
        ],
        responses: {
          '200': {
            description: 'Seasonal rates',
            content: {
              'application/json': {
                schema: {
                  type: 'array',
                  items: { $ref: '#/components/schemas/SeasonalRate' },
                },
              },
            },
          },
          '404': { $ref: '#/components/responses/NotFound' },
        },
      },
      post: {
        summary: 'Create seasonal rate',
        description: 'Create a new seasonal rate for a property (owner only)',
        tags: ['Calendar'],
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            name: 'propertyId',
            in: 'path',
            required: true,
            description: 'Property UUID',
            schema: { type: 'string', format: 'uuid' },
          },
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/CreateSeasonalRateRequest' },
            },
          },
        },
        responses: {
          '201': {
            description: 'Seasonal rate created',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/SeasonalRate' },
              },
            },
          },
          '400': { $ref: '#/components/responses/BadRequest' },
          '401': { $ref: '#/components/responses/Unauthorized' },
          '403': { $ref: '#/components/responses/Forbidden' },
        },
      },
    },
    '/api/calendar/{propertyId}/seasons/{pricingId}': {
      delete: {
        summary: 'Delete seasonal rate',
        description: 'Delete a seasonal rate (owner only)',
        tags: ['Calendar'],
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            name: 'propertyId',
            in: 'path',
            required: true,
            description: 'Property UUID',
            schema: { type: 'string', format: 'uuid' },
          },
          {
            name: 'pricingId',
            in: 'path',
            required: true,
            description: 'Seasonal Rate UUID',
            schema: { type: 'string', format: 'uuid' },
          },
        ],
        responses: {
          '204': { description: 'Seasonal rate deleted' },
          '401': { $ref: '#/components/responses/Unauthorized' },
          '403': { $ref: '#/components/responses/Forbidden' },
          '404': { $ref: '#/components/responses/NotFound' },
        },
      },
    },
    '/api/calendar/{propertyId}/events': {
      post: {
        summary: 'Create calendar event',
        description: 'Create a calendar event for a property (owner only)',
        tags: ['Calendar'],
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            name: 'propertyId',
            in: 'path',
            required: true,
            description: 'Property UUID',
            schema: { type: 'string', format: 'uuid' },
          },
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/CalendarEvent' },
            },
          },
        },
        responses: {
          '201': {
            description: 'Calendar event created',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/CalendarEvent' },
              },
            },
          },
          '400': { $ref: '#/components/responses/BadRequest' },
          '401': { $ref: '#/components/responses/Unauthorized' },
          '403': { $ref: '#/components/responses/Forbidden' },
        },
      },
    },
    '/api/calendar/{propertyId}/events/{eventId}': {
      delete: {
        summary: 'Delete calendar event',
        description: 'Delete a calendar event (owner only)',
        tags: ['Calendar'],
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            name: 'propertyId',
            in: 'path',
            required: true,
            description: 'Property UUID',
            schema: { type: 'string', format: 'uuid' },
          },
          {
            name: 'eventId',
            in: 'path',
            required: true,
            description: 'Event UUID',
            schema: { type: 'string', format: 'uuid' },
          },
        ],
        responses: {
          '204': { description: 'Calendar event deleted' },
          '401': { $ref: '#/components/responses/Unauthorized' },
          '403': { $ref: '#/components/responses/Forbidden' },
          '404': { $ref: '#/components/responses/NotFound' },
        },
      },
    },

    // Sync endpoints
    '/api/sync/property/{id}': {
      post: {
        summary: 'Sync single property',
        description: 'Sync a single property from blockchain (admin only)',
        tags: ['Sync'],
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            description: 'Property UUID',
            schema: { type: 'string', format: 'uuid' },
          },
        ],
        responses: {
          '200': {
            description: 'Property synced',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/Property' },
              },
            },
          },
          '401': { $ref: '#/components/responses/Unauthorized' },
          '403': { $ref: '#/components/responses/Forbidden' },
          '404': { $ref: '#/components/responses/NotFound' },
        },
      },
    },
    '/api/sync/booking/{id}': {
      post: {
        summary: 'Sync single booking',
        description: 'Sync a single booking from blockchain (admin only)',
        tags: ['Sync'],
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            description: 'Booking UUID',
            schema: { type: 'string', format: 'uuid' },
          },
        ],
        responses: {
          '200': {
            description: 'Booking synced',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/Booking' },
              },
            },
          },
          '401': { $ref: '#/components/responses/Unauthorized' },
          '403': { $ref: '#/components/responses/Forbidden' },
          '404': { $ref: '#/components/responses/NotFound' },
        },
      },
    },
    '/api/sync/properties': {
      post: {
        summary: 'Sync all properties',
        description: 'Sync all properties from blockchain (admin only)',
        tags: ['Sync'],
        security: [{ bearerAuth: [] }],
        responses: {
          '200': {
            description: 'All properties synced',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    synced: { type: 'integer' },
                    total: { type: 'integer' },
                  },
                },
              },
            },
          },
          '401': { $ref: '#/components/responses/Unauthorized' },
          '403': { $ref: '#/components/responses/Forbidden' },
        },
      },
    },
    '/api/sync/bookings': {
      post: {
        summary: 'Sync all bookings',
        description: 'Sync all bookings from blockchain (admin only)',
        tags: ['Sync'],
        security: [{ bearerAuth: [] }],
        responses: {
          '200': {
            description: 'All bookings synced',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    synced: { type: 'integer' },
                    total: { type: 'integer' },
                  },
                },
              },
            },
          },
          '401': { $ref: '#/components/responses/Unauthorized' },
          '403': { $ref: '#/components/responses/Forbidden' },
        },
      },
    },
  },
};

// Serve OpenAPI JSON and Swagger UI
export function setupOpenApiRoutes(app: Express): void {
  app.get('/api/docs.json', (_req: Request, res: Response) => {
    res.setHeader('Content-Type', 'application/json');
    res.json(openApiSpec);
  });

  app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(openApiSpec));
}