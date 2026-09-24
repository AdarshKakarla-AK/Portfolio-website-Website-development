const express = require('express');
const cors = require('cors');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { Resend } = require('resend');
const Razorpay = require('razorpay');
const rateLimit = require('express-rate-limit');
const { body, validationResult } = require('express-validator');
const morgan = require('morgan');
const fs = require('fs');
require('dotenv').config();

const app = express();
const resend = new Resend(process.env.RESEND_API_KEY);
const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET
});

// ===== LOGGING SETUP =====
const logStream = fs.createWriteStream('server.log', { flags: 'a' });
app.use(morgan('combined', { stream: logStream }));
app.use(morgan('dev'));

// ===== RATE LIMITING =====
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: 'Too many login attempts, try again in 15 minutes',
  standardHeaders: true,
  legacyHeaders: false
});

const signupLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 10,
  message: 'Too many signup attempts, try again in 1 hour',
  standardHeaders: true,
  legacyHeaders: false
});

const emailLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 5,
  message: 'Too many email requests, wait 1 minute'
});

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: 'Too many API requests, try again later'
});

// ===== MIDDLEWARE =====
app.use(cors({
  origin: process.env.FRONTEND_URL,
  credentials: true
}));
app.use(express.json({ limit: '50mb' }));
app.use(apiLimiter);

// ===== ORIGIN/REFERER CHECKING (API Security) =====
app.use((req, res, next) => {
  const allowedOrigins = [
    'http://localhost:3000',
    'http://localhost:5000',
    'http://127.0.0.1:3000',
    'http://127.0.0.1:5000'
  ];
  
  const origin = req.headers.origin;
  const referer = req.headers.referer;
  
  // Allow if origin is in whitelist or no origin (direct API calls)
  if (!origin || allowedOrigins.includes(origin)) {
    next();
  } else if (referer && allowedOrigins.some(allowed => referer.startsWith(allowed))) {
    next();
  } else if (req.method === 'GET') {
    // GET requests are safe
    next();
  } else {
    // Log potential attack but don't block (for testing)
    console.warn(`⚠️ Potential CSRF attempt from origin: ${origin}`);
    next();
  }
});

// ===== LOGGING HELPER =====
function logError(error, endpoint) {
  const timestamp = new Date().toISOString();
  const message = `[${timestamp}] ERROR at ${endpoint}: ${error.message}\n`;
  fs.appendFileSync('errors.log', message);
  console.error(message);
}

// ===== ERROR HANDLER =====
function handleError(res, error, statusCode = 500) {
  logError(error, res.req?.path || 'unknown');
  return res.status(statusCode).json({
    error: error.message || 'Internal server error',
    timestamp: new Date().toISOString()
  });
}

// ===== VALIDATION HELPER =====
const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      error: 'Validation error',
      details: errors.array()
    });
  }
  next();
};

// ===== JWT HELPERS =====
function createToken(userId, email, role = 'user') {
  return jwt.sign(
    { userId, email, role },
    process.env.JWT_SECRET,
    { expiresIn: '7d' }
  );
}

function verifyToken(req, res, next) {
  const token = req.headers.authorization?.split(' ')[1];
  
  if (!token) {
    return res.status(401).json({ error: 'No token provided' });
  }
  
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.userId = decoded.userId;
    req.userEmail = decoded.email;
    req.userRole = decoded.role || 'user';
    next();
  } catch (error) {
    logError(error, 'Token verification');
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

// ===== ADMIN ROLE CHECK =====
function requireAdmin(req, res, next) {
  if (req.userRole !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' });
  }
  next();
}

// ===== HEALTH CHECK =====
app.get('/api/health', (req, res) => {
  res.json({
    status: 'Server is running',
    time: new Date().toISOString(),
    backend: 'Active'
  });
});

// ===== DATABASE TEST =====
app.get('/api/test-db', async (req, res) => {
  try {
    const { createClient } = require('@supabase/supabase-js');
    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_KEY
    );
    
    const { data, error } = await supabase
      .from('users')
      .select('count', { count: 'exact' });
    
    if (error) throw error;
    
    res.json({ 
      status: 'Database connected',
      users: data
    });
  } catch (error) {
    logError(error, '/api/test-db');
    handleError(res, error);
  }
});

// ===== SIGNUP =====
app.post('/api/auth/signup', 
  signupLimiter,
  body('email').isEmail().normalizeEmail(),
  body('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters'),
  body('name').trim().isLength({ min: 2 }).withMessage('Name must be at least 2 characters'),
  validate,
  async (req, res) => {
    try {
      const { email, name, password } = req.body;
      
      const { createClient } = require('@supabase/supabase-js');
      const supabase = createClient(
        process.env.SUPABASE_URL,
        process.env.SUPABASE_SERVICE_KEY
      );
      
      const { data: existingUser } = await supabase
        .from('users')
        .select('id')
        .eq('email', email)
        .single();
      
      if (existingUser) {
        return res.status(400).json({ error: 'Email already registered' });
      }
      
      const hashedPassword = await bcrypt.hash(password, 10);
      
      const { data: newUser, error } = await supabase
        .from('users')
        .insert([{
          email,
          name,
          password: hashedPassword,
          role: 'user'
        }])
        .select()
        .single();
      
      if (error) throw error;
      
      try {
        await resend.emails.send({
          from: 'onboarding@resend.dev',
          to: email,
          subject: 'Welcome to Landing Page Business!',
          html: `<h1>Welcome, ${name}!</h1><p>Your account has been created. Start building landing pages now!</p>`
        });
      } catch (emailError) {
        console.log('Welcome email failed (non-blocking)');
      }
      
      const token = createToken(newUser.id, newUser.email, 'user');
      
      res.status(201).json({
        message: 'User created successfully',
        user: {
          id: newUser.id,
          email: newUser.email,
          name: newUser.name
        },
        token
      });
    } catch (error) {
      logError(error, '/api/auth/signup');
      handleError(res, error);
    }
  }
);

// ===== LOGIN =====
app.post('/api/auth/login',
  loginLimiter,
  body('email').isEmail().normalizeEmail(),
  body('password').notEmpty(),
  validate,
  async (req, res) => {
    try {
      const { email, password } = req.body;
      
      const { createClient } = require('@supabase/supabase-js');
      const supabase = createClient(
        process.env.SUPABASE_URL,
        process.env.SUPABASE_SERVICE_KEY
      );
      
      const { data: user, error } = await supabase
        .from('users')
        .select('*')
        .eq('email', email)
        .single();
      
      if (error || !user) {
        return res.status(401).json({ error: 'Invalid email or password' });
      }
      
      const passwordMatch = await bcrypt.compare(password, user.password);
      
      if (!passwordMatch) {
        return res.status(401).json({ error: 'Invalid email or password' });
      }
      
      const token = createToken(user.id, user.email, user.role || 'user');
      
      res.json({
        message: 'Login successful',
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role
        },
        token
      });
    } catch (error) {
      logError(error, '/api/auth/login');
      handleError(res, error);
    }
  }
);

// ===== SEND EMAIL =====
app.post('/api/email/send',
  emailLimiter,
  verifyToken,
  body('to').isEmail(),
  body('subject').trim().notEmpty(),
  body('html').trim().notEmpty(),
  validate,
  async (req, res) => {
    try {
      const { to, subject, html } = req.body;
      
      const result = await resend.emails.send({
        from: 'onboarding@resend.dev',
        to: to,
        subject: subject,
        html: html
      });
      
      res.json({
        message: 'Email sent successfully',
        result: result
      });
    } catch (error) {
      logError(error, '/api/email/send');
      handleError(res, error);
    }
  }
);

// EMAIL TEMPLATE HELPER
function getEmailTemplate(type, data) {
  const templates = {
    welcome: `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; background: #f5f5f5; }
          .container { max-width: 600px; margin: 0 auto; background: white; padding: 40px; }
          .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 20px; border-radius: 5px 5px 0 0; }
          .content { padding: 20px 0; }
          .btn { display: inline-block; background: #667eea; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; margin: 20px 0; }
          .footer { border-top: 1px solid #eee; padding-top: 20px; font-size: 12px; color: #666; text-align: center; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Welcome to Landing Page Builder! 🎉</h1>
          </div>
          <div class="content">
            <p>Hi ${data.name},</p>
            <p>Welcome aboard! Your account has been successfully created.</p>
            <p>You can now:</p>
            <ul>
              <li>Create unlimited landing pages</li>
              <li>Choose from professional templates</li>
              <li>Launch your pages instantly</li>
            </ul>
            <a href="http://localhost:3000/dashboard" class="btn">Get Started</a>
            <p>If you have any questions, feel free to reach out!</p>
          </div>
          <div class="footer">
            <p>&copy; 2026 Landing Page Business. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `,
    password_reset: `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; background: #f5f5f5; }
          .container { max-width: 600px; margin: 0 auto; background: white; padding: 40px; }
          .header { background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%); color: white; padding: 20px; border-radius: 5px 5px 0 0; }
          .content { padding: 20px 0; }
          .btn { display: inline-block; background: #f5576c; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; margin: 20px 0; }
          .warning { background: #fff3cd; padding: 10px; border-left: 4px solid #ffc107; margin: 20px 0; }
          .footer { border-top: 1px solid #eee; padding-top: 20px; font-size: 12px; color: #666; text-align: center; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Reset Your Password 🔐</h1>
          </div>
          <div class="content">
            <p>Hi,</p>
            <p>We received a request to reset your password. Click the button below to proceed:</p>
            <a href="${data.resetLink}" class="btn">Reset Password</a>
            <div class="warning">
              <strong>⚠️ Security Notice:</strong> This link expires in 1 hour. If you didn't request this, ignore this email.
            </div>
            <p>Or copy this link: ${data.resetLink}</p>
          </div>
          <div class="footer">
            <p>&copy; 2026 Landing Page Business. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `,
    invoice: `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; background: #f5f5f5; }
          .container { max-width: 600px; margin: 0 auto; background: white; padding: 40px; }
          .header { text-align: center; border-bottom: 2px solid #667eea; padding-bottom: 20px; }
          .invoice-details { margin: 30px 0; }
          .row { display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid #eee; }
          .total { font-size: 20px; font-weight: bold; padding: 20px 0; }
          .footer { border-top: 1px solid #eee; padding-top: 20px; font-size: 12px; color: #666; text-align: center; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Invoice #${data.invoiceNumber}</h1>
            <p>Date: ${data.date}</p>
          </div>
          <div class="invoice-details">
            <div class="row">
              <span>Plan:</span>
              <span>${data.planName}</span>
            </div>
            <div class="row">
              <span>Amount:</span>
              <span>₹${data.amount}</span>
            </div>
            <div class="row">
              <span>Billing Period:</span>
              <span>${data.billingPeriod}</span>
            </div>
            <div class="row total">
              <span>Total Due:</span>
              <span>₹${data.amount}</span>
            </div>
          </div>
          <div class="footer">
            <p>Thank you for your subscription!</p>
            <p>&copy; 2026 Landing Page Business. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `
  };
  
  return templates[type] || templates.welcome;
}

// ===== SEND WELCOME EMAIL =====
app.post('/api/email/welcome',
  emailLimiter,
  body('email').isEmail(),
  body('name').trim(),
  validate,
  async (req, res) => {
    try {
      const { email, name } = req.body;
      
      const htmlTemplate = getEmailTemplate('welcome', { name });
      
      const result = await resend.emails.send({
        from: 'onboarding@resend.dev',
        to: email,
        subject: 'Welcome to Landing Page Builder! 🎉',
        html: htmlTemplate
      });
      
      res.json({
        message: 'Welcome email sent',
        result: result
      });
    } catch (error) {
      logError(error, '/api/email/welcome');
      handleError(res, error);
    }
  }
);

// ===== SEND PASSWORD RESET =====
app.post('/api/email/password-reset',
  emailLimiter,
  body('email').isEmail(),
  body('resetLink').notEmpty().trim(),
  validate,
  async (req, res) => {
    try {
      const { email, resetLink } = req.body;
      
      const htmlTemplate = getEmailTemplate('password_reset', { resetLink });
      
      const result = await resend.emails.send({
        from: 'onboarding@resend.dev',
        to: email,
        subject: 'Reset Your Password 🔐',
        html: htmlTemplate
      });
      
      res.json({
        message: 'Password reset email sent',
        result: result
      });
    } catch (error) {
      logError(error, '/api/email/password-reset');
      handleError(res, error);
    }
  }
);

// ===== LANDING PAGES - GET ALL =====
app.get('/api/landing-pages', verifyToken, async (req, res) => {
  try {
    const { createClient } = require('@supabase/supabase-js');
    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_KEY
    );
    
    const { data, error } = await supabase
      .from('landing_pages')
      .select('*')
      .eq('user_id', req.userId)
      .order('created_at', { ascending: false });
    
    if (error) throw error;
    
    res.json({
      message: 'Pages fetched',
      pages: data || []
    });
  } catch (error) {
    logError(error, '/api/landing-pages');
    handleError(res, error);
  }
});

// ===== LANDING PAGES - GET ONE =====
app.get('/api/landing-pages/:id', verifyToken, async (req, res) => {
  try {
    const { createClient } = require('@supabase/supabase-js');
    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_KEY
    );
    
    const { data, error } = await supabase
      .from('landing_pages')
      .select('*')
      .eq('id', req.params.id)
      .eq('user_id', req.userId)
      .single();
    
    if (error) throw error;
    
    res.json({
      message: 'Page fetched',
      page: data
    });
  } catch (error) {
    logError(error, '/api/landing-pages/:id');
    handleError(res, error);
  }
});

// ===== LANDING PAGES - CREATE =====
app.post('/api/landing-pages/create',
  verifyToken,
  body('title').trim().isLength({ min: 2, max: 100 }),
  body('description').trim().optional(),
  validate,
  async (req, res) => {
    try {
      const { title, description } = req.body;
      
      const { createClient } = require('@supabase/supabase-js');
      const supabase = createClient(
        process.env.SUPABASE_URL,
        process.env.SUPABASE_SERVICE_KEY
      );
      
      const { data, error } = await supabase
        .from('landing_pages')
        .insert([{
          user_id: req.userId,
          title: title,
          description: description || '',
          template_type: 'basic',
          published: false,
          content: {}
        }])
        .select()
        .single();
      
      if (error) throw error;
      
      res.status(201).json({
        message: 'Page created',
        page: data
      });
    } catch (error) {
      logError(error, '/api/landing-pages/create');
      handleError(res, error);
    }
  }
);

// ===== LANDING PAGES - UPDATE =====
app.put('/api/landing-pages/:id',
  verifyToken,
  body('title').trim().optional().isLength({ min: 2 }),
  body('description').trim().optional(),
  body('published').optional().isBoolean(),
  validate,
  async (req, res) => {
    try {
      const { title, description, content, published } = req.body;
      const pageId = req.params.id;
      
      const { createClient } = require('@supabase/supabase-js');
      const supabase = createClient(
        process.env.SUPABASE_URL,
        process.env.SUPABASE_SERVICE_KEY
      );
      
      const { data, error } = await supabase
        .from('landing_pages')
        .update({
          title: title,
          description: description,
          content: content,
          published: published,
          updated_at: new Date().toISOString()
        })
        .eq('id', pageId)
        .eq('user_id', req.userId)
        .select()
        .single();
      
      if (error) throw error;
      
      res.json({
        message: 'Page updated',
        page: data
      });
    } catch (error) {
      logError(error, '/api/landing-pages/:id PUT');
      handleError(res, error);
    }
  }
);

// ===== LANDING PAGES - DELETE =====
app.delete('/api/landing-pages/:id', verifyToken, async (req, res) => {
  try {
    const pageId = req.params.id;
    
    const { createClient } = require('@supabase/supabase-js');
    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_KEY
    );
    
    const { error } = await supabase
      .from('landing_pages')
      .delete()
      .eq('id', pageId)
      .eq('user_id', req.userId);
    
    if (error) throw error;
    
    res.json({ message: 'Page deleted' });
  } catch (error) {
    logError(error, '/api/landing-pages/:id DELETE');
    handleError(res, error);
  }
});

// ===== PAYMENTS - CREATE ORDER =====
app.post('/api/payments/create-order',
  verifyToken,
  body('amount').isFloat({ min: 1 }),
  body('pageId').notEmpty(),
  validate,
  async (req, res) => {
    try {
      const { amount, pageId } = req.body;
      
      const options = {
        amount: Math.round(amount * 100),
        currency: 'INR',
        receipt: `page_${pageId}`,
        payment_capture: 1
      };
      
      const order = await razorpay.orders.create(options);
      
      const { createClient } = require('@supabase/supabase-js');
      const supabase = createClient(
        process.env.SUPABASE_URL,
        process.env.SUPABASE_SERVICE_KEY
      );
      
      await supabase
        .from('payments')
        .insert([{
          user_id: req.userId,
          amount: amount,
          currency: 'INR',
          status: 'pending',
          razorpay_order_id: order.id
        }]);
      
      res.json({
        message: 'Order created',
        order: order
      });
    } catch (error) {
      logError(error, '/api/payments/create-order');
      handleError(res, error);
    }
  }
);

// PAYMENT RETRY LOGIC
app.post('/api/payments/retry',
  verifyToken,
  body('razorpay_order_id').notEmpty(),
  validate,
  async (req, res) => {
    try {
      const { razorpay_order_id } = req.body;
      
      const { createClient } = require('@supabase/supabase-js');
      const supabase = createClient(
        process.env.SUPABASE_URL,
        process.env.SUPABASE_SERVICE_KEY
      );
      
      // Get original payment
      const { data: payment, error } = await supabase
        .from('payments')
        .select('*')
        .eq('razorpay_order_id', razorpay_order_id)
        .eq('user_id', req.userId)
        .single();
      
      if (error) throw error;
      
      if (payment.status === 'completed') {
        return res.status(400).json({ error: 'Payment already completed' });
      }
      
      // Create new order for retry
      const options = {
        amount: Math.round(payment.amount * 100),
        currency: 'INR',
        receipt: `retry_${razorpay_order_id}`,
        payment_capture: 1
      };
      
      const newOrder = await razorpay.orders.create(options);
      
      // Update payment status as retry
      await supabase
        .from('payments')
        .update({
          status: 'retry_pending',
          razorpay_order_id: newOrder.id
        })
        .eq('razorpay_order_id', razorpay_order_id);
      
      res.json({
        message: 'Payment retry initiated',
        newOrder: newOrder
      });
    } catch (error) {
      logError(error, '/api/payments/retry');
      handleError(res, error);
    }
  }
);

// ===== PAYMENTS - VERIFY =====
app.post('/api/payments/verify',
  verifyToken,
  body('razorpay_order_id').notEmpty(),
  body('razorpay_payment_id').notEmpty(),
  body('razorpay_signature').notEmpty(),
  validate,
  async (req, res) => {
    try {
      const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;
      
      const { createClient } = require('@supabase/supabase-js');
      const crypto = require('crypto');
      
      const text = razorpay_order_id + '|' + razorpay_payment_id;
      const generated_signature = crypto
        .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
        .update(text)
        .digest('hex');
      
      if (generated_signature !== razorpay_signature) {
        return res.status(400).json({ error: 'Invalid payment signature' });
      }
      
      const supabase = createClient(
        process.env.SUPABASE_URL,
        process.env.SUPABASE_SERVICE_KEY
      );
      
      const { data, error } = await supabase
        .from('payments')
        .update({
          status: 'completed',
          razorpay_payment_id: razorpay_payment_id
        })
        .eq('razorpay_order_id', razorpay_order_id)
        .eq('user_id', req.userId)
        .select()
        .single();
      
      if (error) throw error;
      
      res.json({
        message: 'Payment verified',
        payment: data
      });
    } catch (error) {
      logError(error, '/api/payments/verify');
      handleError(res, error);
    }
  }
);

// ===== PAYMENTS - GET ALL =====
app.get('/api/payments', verifyToken, async (req, res) => {
  try {
    const { createClient } = require('@supabase/supabase-js');
    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_KEY
    );
    
    const { data, error } = await supabase
      .from('payments')
      .select('*')
      .eq('user_id', req.userId)
      .order('created_at', { ascending: false });
    
    if (error) throw error;
    
    res.json({
      message: 'Payments fetched',
      payments: data || []
    });
  } catch (error) {
    logError(error, '/api/payments');
    handleError(res, error);
  }
});

// ===== ADMIN ENDPOINTS =====

// GET ALL USERS (Admin only)
app.get('/api/admin/users', verifyToken, requireAdmin, async (req, res) => {
  try {
    const { createClient } = require('@supabase/supabase-js');
    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_KEY
    );
    
    const { data, error } = await supabase
      .from('users')
      .select('id, email, name, role, created_at')
      .order('created_at', { ascending: false });
    
    if (error) throw error;
    
    res.json({
      message: 'Users fetched',
      users: data || []
    });
  } catch (error) {
    logError(error, '/api/admin/users');
    handleError(res, error);
  }
});

// GET PAYMENT ANALYTICS (Admin only)
app.get('/api/admin/analytics', verifyToken, requireAdmin, async (req, res) => {
  try {
    const { createClient } = require('@supabase/supabase-js');
    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_KEY
    );
    
    const { data: totalUsers } = await supabase
      .from('users')
      .select('*', { count: 'exact' });
    
    const { data: totalPayments } = await supabase
      .from('payments')
      .select('*', { count: 'exact' });
    
    const { data: completedPayments } = await supabase
      .from('payments')
      .select('amount')
      .eq('status', 'completed');
    
    const totalRevenue = (completedPayments || []).reduce((sum, p) => sum + (p.amount || 0), 0);
    
    res.json({
      analytics: {
        totalUsers: totalUsers?.length || 0,
        totalPayments: totalPayments?.length || 0,
        completedPayments: completedPayments?.length || 0,
        totalRevenue: totalRevenue
      }
    });
  } catch (error) {
    logError(error, '/api/admin/analytics');
    handleError(res, error);
  }
});

// ===== SUBSCRIPTION MANAGEMENT =====

// GET ALL PLANS
app.get('/api/subscriptions/plans', async (req, res) => {
  try {
    const { createClient } = require('@supabase/supabase-js');
    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_KEY
    );
    
    const { data, error } = await supabase
      .from('subscription_plans')
      .select('*')
      .eq('active', true)
      .order('price', { ascending: true });
    
    if (error) throw error;
    
    res.json({
      message: 'Plans fetched',
      plans: data || []
    });
  } catch (error) {
    logError(error, '/api/subscriptions/plans');
    handleError(res, error);
  }
});

// GET USER SUBSCRIPTION
app.get('/api/subscriptions/current', verifyToken, async (req, res) => {
  try {
    const { createClient } = require('@supabase/supabase-js');
    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_KEY
    );
    
    const { data, error } = await supabase
      .from('user_subscriptions')
      .select('*, subscription_plans(name, price, features)')
      .eq('user_id', req.userId)
      .eq('status', 'active')
      .single();
    
    if (error && error.code !== 'PGRST116') throw error;
    
    res.json({
      message: 'Subscription fetched',
      subscription: data || null
    });
  } catch (error) {
    logError(error, '/api/subscriptions/current');
    handleError(res, error);
  }
});

// CREATE SUBSCRIPTION
app.post('/api/subscriptions/create',
  verifyToken,
  body('planId').notEmpty(),
  validate,
  async (req, res) => {
    try {
      const { planId } = req.body;
      
      const { createClient } = require('@supabase/supabase-js');
      const supabase = createClient(
        process.env.SUPABASE_URL,
        process.env.SUPABASE_SERVICE_KEY
      );
      
      // Get plan details
      const { data: plan, error: planError } = await supabase
        .from('subscription_plans')
        .select('*')
        .eq('id', planId)
        .single();
      
      if (planError) throw planError;
      
      // Create Razorpay subscription
      const subscriptionOptions = {
        plan_id: planId,
        customer_notify: 1,
        quantity: 1,
        total_count: 12,
        start_at: Math.floor(Date.now() / 1000)
      };
      
      const subscription = await razorpay.subscriptions.create(subscriptionOptions);
      
      // Save to database
      const { data: userSub, error: subError } = await supabase
        .from('user_subscriptions')
        .insert([{
          user_id: req.userId,
          plan_id: planId,
          status: 'active',
          razorpay_subscription_id: subscription.id,
          current_period_start: new Date(),
          current_period_end: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
          renewal_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
          auto_renew: true
        }])
        .select()
        .single();
      
      if (subError) throw subError;
      
      // Create invoice
      const invoiceNumber = `INV-${Date.now()}`;
      await supabase
        .from('invoices')
        .insert([{
          user_id: req.userId,
          subscription_id: userSub.id,
          amount: plan.price,
          status: 'pending',
          invoice_number: invoiceNumber,
          due_date: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000)
        }]);
      
      res.status(201).json({
        message: 'Subscription created',
        subscription: userSub,
        razorpaySubscription: subscription
      });
    } catch (error) {
      logError(error, '/api/subscriptions/create');
      handleError(res, error);
    }
  }
);

// UPGRADE SUBSCRIPTION
app.post('/api/subscriptions/upgrade',
  verifyToken,
  body('newPlanId').notEmpty(),
  validate,
  async (req, res) => {
    try {
      const { newPlanId } = req.body;
      
      const { createClient } = require('@supabase/supabase-js');
      const supabase = createClient(
        process.env.SUPABASE_URL,
        process.env.SUPABASE_SERVICE_KEY
      );
      
      // Get current subscription
      const { data: currentSub, error: currentError } = await supabase
        .from('user_subscriptions')
        .select('*')
        .eq('user_id', req.userId)
        .eq('status', 'active')
        .single();
      
      if (currentError) throw currentError;
      
      // Get new plan
      const { data: newPlan, error: planError } = await supabase
        .from('subscription_plans')
        .select('*')
        .eq('id', newPlanId)
        .single();
      
      if (planError) throw planError;
      
      // Update subscription
      const { data: updated, error: updateError } = await supabase
        .from('user_subscriptions')
        .update({
          plan_id: newPlanId,
          updated_at: new Date().toISOString()
        })
        .eq('id', currentSub.id)
        .select()
        .single();
      
      if (updateError) throw updateError;
      
      res.json({
        message: 'Subscription upgraded',
        subscription: updated
      });
    } catch (error) {
      logError(error, '/api/subscriptions/upgrade');
      handleError(res, error);
    }
  }
);

// CANCEL SUBSCRIPTION
app.post('/api/subscriptions/cancel',
  verifyToken,
  async (req, res) => {
    try {
      const { createClient } = require('@supabase/supabase-js');
      const supabase = createClient(
        process.env.SUPABASE_URL,
        process.env.SUPABASE_SERVICE_KEY
      );
      
      const { data: subscription, error: subError } = await supabase
        .from('user_subscriptions')
        .update({
          status: 'cancelled',
          auto_renew: false,
          updated_at: new Date().toISOString()
        })
        .eq('user_id', req.userId)
        .eq('status', 'active')
        .select()
        .single();
      
      if (subError) throw subError;
      
      res.json({
        message: 'Subscription cancelled',
        subscription: subscription
      });
    } catch (error) {
      logError(error, '/api/subscriptions/cancel');
      handleError(res, error);
    }
  }
);

// GET INVOICES
app.get('/api/invoices', verifyToken, async (req, res) => {
  try {
    const { createClient } = require('@supabase/supabase-js');
    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_KEY
    );
    
    const { data, error } = await supabase
      .from('invoices')
      .select('*')
      .eq('user_id', req.userId)
      .order('created_at', { ascending: false });
    
    if (error) throw error;
    
    res.json({
      message: 'Invoices fetched',
      invoices: data || []
    });
  } catch (error) {
    logError(error, '/api/invoices');
    handleError(res, error);
  }
});

// Test Email Endpoint
app.get('/api/test-email', async (req, res) => {
  try {
    const result = await resend.emails.send({
      from: 'noreply@akprojections.com',
      to: 'adarsh.kakarla.projections@gmail.com',
      subject: '🧪 Test Email from Backend',
      html: '<h1>If you see this, email works!</h1>'
    });
    
    res.json({ 
      success: true, 
      message: 'Test email sent!',
      result: result 
    });
  } catch (error) {
    res.status(500).json({ 
      error: error.message 
    });
  }
});

// Contact/Inquiry Endpoint (NEW!)
app.post('/api/contact', async (req, res) => {
  try {
    const { name, email, phone, industry, message } = req.body;

    // CREATE SUPABASE CLIENT (THIS WAS MISSING!)
    const { createClient } = require('@supabase/supabase-js');
    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_KEY
    );

    // Save inquiry to database
    const { data, error } = await supabase
      .from('inquiries')
      .insert([{
        name,
        email,
        phone,
        industry,
        message,
        created_at: new Date()
      }]);

    if (error) throw error;

    // Send email to you
    await resend.emails.send({
      from: 'noreply@akprojections.com',
      to: 'adarsh.kakarla.projections@gmail.com',
      subject: `🎯 New Client Inquiry: ${name}`,
      html: `
        <h2>🎉 New Client Inquiry!</h2>
        <p><strong>Name:</strong> ${name}</p>
        <p><strong>Email:</strong> ${email}</p>
        <p><strong>Phone:</strong> ${phone}</p>
        <p><strong>Industry:</strong> ${industry}</p>
        <p><strong>Message:</strong> ${message}</p>
        <p><a href="mailto:${email}">📧 Reply to ${name}</a></p>
      `
    });

    res.json({ success: true, message: 'Thanks! I will contact you within 24 hours.' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
});

// DOWNLOAD INVOICE
app.get('/api/invoices/:id/download', verifyToken, async (req, res) => {
  try {
    const { createClient } = require('@supabase/supabase-js');
    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_KEY
    );
    
    const { data: invoice, error } = await supabase
      .from('invoices')
      .select('*')
      .eq('id', req.params.id)
      .eq('user_id', req.userId)
      .single();
    
    if (error) throw error;
    
    // Simple text invoice
    const invoiceContent = `
    INVOICE
    ==================
    Invoice #: ${invoice.invoice_number}
    Date: ${new Date(invoice.created_at).toLocaleDateString()}
    Amount: ₹${invoice.amount}
    Status: ${invoice.status}
    Due Date: ${new Date(invoice.due_date).toLocaleDateString()}
    `;
    
    res.setHeader('Content-Type', 'text/plain');
    res.setHeader('Content-Disposition', `attachment; filename="invoice-${invoice.invoice_number}.txt"`);
    res.send(invoiceContent);
  } catch (error) {
    logError(error, '/api/invoices/:id/download');
    handleError(res, error);
  }
});

// ADMIN: GET ALL SUBSCRIPTIONS
app.get('/api/admin/subscriptions', verifyToken, requireAdmin, async (req, res) => {
  try {
    const { createClient } = require('@supabase/supabase-js');
    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_KEY
    );
    
    const { data, error } = await supabase
      .from('user_subscriptions')
      .select('*, subscription_plans(name, price)')
      .order('created_at', { ascending: false });
    
    if (error) throw error;
    
    res.json({
      message: 'Subscriptions fetched',
      subscriptions: data || []
    });
  } catch (error) {
    logError(error, '/api/admin/subscriptions');
    handleError(res, error);
  }
});

// ADMIN: GET SUBSCRIPTION REVENUE
app.get('/api/admin/revenue', verifyToken, requireAdmin, async (req, res) => {
  try {
    const { createClient } = require('@supabase/supabase-js');
    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_KEY
    );
    
    // Get active subscriptions
    const { data: active } = await supabase
      .from('user_subscriptions')
      .select('subscription_plans(price)')
      .eq('status', 'active');
    
    const mrr = (active || []).reduce((sum, sub) => sum + (sub.subscription_plans?.price || 0), 0);
    
    // Get total invoices
    const { data: invoices } = await supabase
      .from('invoices')
      .select('amount')
      .eq('status', 'paid');
    
    const totalRevenue = (invoices || []).reduce((sum, inv) => sum + (inv.amount || 0), 0);
    
    res.json({
      revenue: {
        mrr: mrr,
        totalRevenue: totalRevenue,
        activeSubscriptions: active?.length || 0
      }
    });
  } catch (error) {
    logError(error, '/api/admin/revenue');
    handleError(res, error);
  }
});

// ===== SERVER START =====
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log('');
  console.log('🔐 Secure Backend Server Running!');
  console.log('📍 http://localhost:' + PORT);
  console.log('');
  console.log('✅ Security Features Active:');
  console.log('  • Input Validation');
  console.log('  • Rate Limiting');
  console.log('  • Error Logging');
  console.log('  • Role-Based Access Control');
  console.log('');
  console.log('📊 Admin Endpoints:');
  console.log('  GET /api/admin/users (admin only)');
  console.log('  GET /api/admin/analytics (admin only)');
  console.log('');
});