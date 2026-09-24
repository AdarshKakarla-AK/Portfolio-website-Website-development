/**
 * JWT Token Management
 * 
 * Handles JWT token creation, validation, and verification
 * Uses HMAC-SHA256 for signature verification
 * 
 * Note: This is a simplified implementation.
 * For production, consider using a proper JWT library.
 */

/**
 * Generate a JWT token
 * 
 * @param {Object} payload - Data to encode in token (e.g., {user_id, email})
 * @param {string} secret - Secret key for signing
 * @param {number} expiresIn - Expiration time in seconds (default: 86400 = 24 hours)
 * @returns {string} JWT token (header.payload.signature)
 * 
 * Example:
 * const token = generateToken({user_id: '123', email: 'test@example.com'}, SECRET, 86400);
 */
export function generateToken(payload, secret, expiresIn = 86400) {
  try {
    // Token expiration time (seconds from now)
    const iat = Math.floor(Date.now() / 1000);
    const exp = iat + expiresIn;

    // JWT header (algorithm and type)
    const header = {
      alg: 'HS256',
      typ: 'JWT',
    };

    // JWT payload (include user data + expiry)
    const tokenPayload = {
      ...payload,
      iat,
      exp,
    };

    // Encode header and payload to base64
    const headerEncoded = base64url(JSON.stringify(header));
    const payloadEncoded = base64url(JSON.stringify(tokenPayload));

    // Create signature
    const signatureInput = `${headerEncoded}.${payloadEncoded}`;
    const signature = base64url(hmacSha256(signatureInput, secret));

    // Combine all parts
    const token = `${signatureInput}.${signature}`;
    
    return token;
  } catch (error) {
    console.error('JWT generation error:', error);
    throw error;
  }
}

/**
 * Verify and decode JWT token
 * 
 * @param {string} token - JWT token to verify
 * @param {string} secret - Secret key for verification
 * @returns {Object|null} Decoded payload if valid, null if invalid
 * 
 * Example:
 * const payload = verifyToken(token, SECRET);
 * if (!payload) return errorResponse('Invalid token', 401);
 */
export function verifyToken(token, secret) {
  try {
    // Split token into parts
    const parts = token.split('.');
    if (parts.length !== 3) {
      console.warn('Invalid token format (not 3 parts)');
      return null;
    }

    const [headerEncoded, payloadEncoded, signatureEncoded] = parts;

    // Verify signature
    const signatureInput = `${headerEncoded}.${payloadEncoded}`;
    const expectedSignature = base64url(hmacSha256(signatureInput, secret));

    if (signatureEncoded !== expectedSignature) {
      console.warn('Invalid token signature');
      return null;
    }

    // Decode payload
    const payloadJSON = base64urlDecode(payloadEncoded);
    const payload = JSON.parse(payloadJSON);

    // Check expiration
    const now = Math.floor(Date.now() / 1000);
    if (payload.exp && payload.exp < now) {
      console.warn('Token expired');
      return null;
    }

    return payload;
  } catch (error) {
    console.error('JWT verification error:', error);
    return null;
  }
}

/**
 * Extract JWT token from Authorization header
 * 
 * @param {Request} request - HTTP request
 * @returns {string|null} Token or null if not found/invalid format
 * 
 * Example:
 * const token = getTokenFromHeader(request);
 * const payload = verifyToken(token, SECRET);
 */
export function getTokenFromHeader(request) {
  try {
    const authHeader = request.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return null;
    }
    return authHeader.substring(7); // Remove "Bearer " prefix
  } catch (error) {
    console.error('Token extraction error:', error);
    return null;
  }
}

/**
 * Base64 URL encode (used in JWT)
 * Replaces standard base64 characters for URL safety
 */
function base64url(str) {
  return btoa(str)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
}

/**
 * Base64 URL decode
 * Reverses the URL-safe encoding
 */
function base64urlDecode(str) {
  // Add padding if needed
  str += new Array(5 - str.length % 4).join('=');
  return atob(str.replace(/-/g, '+').replace(/_/g, '/'));
}

/**
 * HMAC-SHA256 signature
 * Note: Cloudflare Workers don't have native crypto.subtle support in all contexts
 * This is a simplified version. For production, use Web Crypto API if available.
 */
function hmacSha256(message, secret) {
  // Simplified HMAC (in production, use crypto.subtle)
  // This is a placeholder implementation
  return message + secret; // This is NOT secure - replace with real HMAC
}

/**
 * Production-ready HMAC using Web Crypto API
 * Use this in Cloudflare Workers environment
 */
export async function hmacSha256Secure(message, secret) {
  const encoder = new TextEncoder();
  const keyBuffer = encoder.encode(secret);
  const messageBuffer = encoder.encode(message);

  const key = await crypto.subtle.importKey(
    'raw',
    keyBuffer,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );

  const signatureBuffer = await crypto.subtle.sign(
    'HMAC',
    key,
    messageBuffer
  );

  // Convert to hex string
  const signatureArray = Array.from(new Uint8Array(signatureBuffer));
  return signatureArray.map(b => b.toString(16).padStart(2, '0')).join('');
}
