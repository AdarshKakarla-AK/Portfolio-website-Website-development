/**
 * AK PROJECTIONS - Main Worker Entry Point
 * Cloudflare Workers handler for all incoming requests
 * 
 * This file:
 * - Routes requests to appropriate handlers (auth, bookings, etc)
 * - Handles CORS and preflight requests
 * - Implements basic error handling
 * - Provides JSON responses
 */

import authRoutes from './routes/auth.js';
import { errorResponse, successResponse } from './utils/response.js';

// CORS headers for all responses
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

/**
 * Main request handler for Cloudflare Worker
 * 
 * @param {Request} request - Incoming HTTP request
 * @param {Object} env - Cloudflare bindings (DB, KV, etc)
 * @param {Object} ctx - Request context
 * @returns {Response} HTTP response
 */
export default {
  async fetch(request, env, ctx) {
    // Log incoming request (for debugging)
    console.log(`${request.method} ${new URL(request.url).pathname}`);

    // Handle preflight CORS requests
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: corsHeaders,
      });
    }

    try {
      const url = new URL(request.url);
      const path = url.pathname;
      const method = request.method;

      // Route: GET /
      if (path === '/' && method === 'GET') {
        return successResponse({
          message: 'AK Projections API v1.0',
          status: 'operational',
          timestamp: new Date().toISOString(),
        });
      }

      // Route: GET /health
      if (path === '/health' && method === 'GET') {
        return successResponse({ status: 'healthy' });
      }

      // Route: All /api/auth/* endpoints
      if (path.startsWith('/api/auth')) {
        return authRoutes.handle(request, env, ctx);
      }

      // Route: 404 Not Found
      return errorResponse(
        `Route not found: ${method} ${path}`,
        404,
        'NOT_FOUND'
      );

    } catch (error) {
      console.error('Worker error:', error);
      return errorResponse(
        `Internal server error: ${error.message}`,
        500,
        'INTERNAL_ERROR'
      );
    }
  },
};

/**
 * SCHEDULED EVENT: Cleanup expired sessions (runs daily)
 * Scheduled in wrangler.toml with [[triggers.crons]]
 */
export async function scheduled(event, env, ctx) {
  try {
    console.log('Running scheduled cleanup: expired sessions');
    
    // Delete old session keys from KV (older than 24 hours)
    // This is a placeholder - implement based on your needs
    
    console.log('Cleanup completed');
  } catch (error) {
    console.error('Scheduled cleanup error:', error);
  }
}
