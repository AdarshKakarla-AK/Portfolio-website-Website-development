/**
 * Password Hashing and Verification
 * 
 * Uses bcryptjs for secure password hashing
 * Never store plain-text passwords in database
 */

import bcrypt from 'bcryptjs';

// Hash rounds for bcrypt (higher = more secure but slower)
// 10 is a good balance for login performance vs security
const SALT_ROUNDS = 10;

/**
 * Hash a plain-text password using bcrypt
 * 
 * @param {string} plainPassword - Plain text password to hash
 * @returns {Promise<string>} Hashed password (safe to store in DB)
 * 
 * Example:
 * const hash = await hashPassword('myPassword123');
 * // Store hash in database
 */
export async function hashPassword(plainPassword) {
  try {
    if (!plainPassword || plainPassword.length < 6) {
      throw new Error('Password must be at least 6 characters');
    }

    // Generate salt and hash password
    const hash = await bcrypt.hash(plainPassword, SALT_ROUNDS);
    
    return hash;
  } catch (error) {
    console.error('Password hashing error:', error);
    throw error;
  }
}

/**
 * Verify a plain-text password against a hash
 * 
 * @param {string} plainPassword - Plain text password from user
 * @param {string} passwordHash - Hash from database
 * @returns {Promise<boolean>} True if passwords match, false otherwise
 * 
 * Example:
 * const isValid = await verifyPassword('myPassword123', dbHash);
 * if (!isValid) return errorResponse('Invalid password', 401);
 */
export async function verifyPassword(plainPassword, passwordHash) {
  try {
    if (!plainPassword || !passwordHash) {
      return false;
    }

    // Compare password with hash (bcrypt handles timing attacks)
    const isMatch = await bcrypt.compare(plainPassword, passwordHash);
    
    return isMatch;
  } catch (error) {
    console.error('Password verification error:', error);
    return false;
  }
}

/**
 * Validate password strength
 * 
 * @param {string} password - Password to validate
 * @returns {Object} { isValid: boolean, errors: string[] }
 * 
 * Example:
 * const validation = validatePasswordStrength('pass123');
 * if (!validation.isValid) return errorResponse(validation.errors.join(', '), 400);
 */
export function validatePasswordStrength(password) {
  const errors = [];

  if (!password) {
    errors.push('Password is required');
    return { isValid: false, errors };
  }

  if (password.length < 6) {
    errors.push('Password must be at least 6 characters');
  }

  if (!/\d/.test(password)) {
    errors.push('Password must contain at least one number');
  }

  if (!/[a-z]/.test(password)) {
    errors.push('Password must contain at least one lowercase letter');
  }

  // Optional: Require uppercase and special characters
  // if (!/[A-Z]/.test(password)) {
  //   errors.push('Password must contain at least one uppercase letter');
  // }
  // if (!/[!@#$%^&*]/.test(password)) {
  //   errors.push('Password must contain a special character (!@#$%^&*)');
  // }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

/**
 * Generate random UUID (simple version)
 * For production, consider using a proper UUID library
 * 
 * @returns {string} Random UUID-like string
 * 
 * Example:
 * const userId = generateId(); // "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
 */
export function generateId() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * Generate random token (for password reset, email verification, etc)
 * 
 * @param {number} length - Token length (default: 32)
 * @returns {string} Random hex token
 * 
 * Example:
 * const resetToken = generateToken(32);
 */
export function generateToken(length = 32) {
  const chars = '0123456789abcdef';
  let token = '';
  for (let i = 0; i < length; i++) {
    token += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return token;
}
