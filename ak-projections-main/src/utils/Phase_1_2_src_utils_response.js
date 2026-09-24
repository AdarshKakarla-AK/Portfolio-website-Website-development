/**
 * Response helper functions for consistent JSON responses
 * All API responses should use these to maintain consistency
 */

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Content-Type': 'application/json',
};

/**
 * Send successful JSON response
 * 
 * @param {Object} data - Response data
 * @param {number} status - HTTP status code (default: 200)
 * @returns {Response} JSON response
 * 
 * Example:
 * return successResponse({ user_id: '123', token: 'jwt...' }, 201);
 */
export function successResponse(data, status = 200) {
  return new Response(
    JSON.stringify({
      success: true,
      data,
      timestamp: new Date().toISOString(),
    }),
    {
      status,
      headers: corsHeaders,
    }
  );
}

/**
 * Send error JSON response
 * 
 * @param {string} message - Error message
 * @param {number} status - HTTP status code (default: 400)
 * @param {string} code - Error code for client handling (default: 'ERROR')
 * @returns {Response} JSON error response
 * 
 * Example:
 * return errorResponse('Phone already registered', 409, 'DUPLICATE_PHONE');
 */
export function errorResponse(message, status = 400, code = 'ERROR') {
  return new Response(
    JSON.stringify({
      success: false,
      error: {
        message,
        code,
        status,
      },
      timestamp: new Date().toISOString(),
    }),
    {
      status,
      headers: corsHeaders,
    }
  );
}

/**
 * Parse JSON request body safely
 * 
 * @param {Request} request - Incoming request
 * @returns {Object|null} Parsed JSON or null if invalid
 * 
 * Example:
 * const body = await parseJSON(request);
 * if (!body) return errorResponse('Invalid JSON');
 */
export async function parseJSON(request) {
  try {
    return await request.json();
  } catch (error) {
    console.error('JSON parse error:', error);
    return null;
  }
}
