import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { check, validationResult } from 'express-validator';
import * as db from '../db.js';

const router = express.Router();

// Validation middleware
const signupValidation = [
  check('name', 'Name is required').not().isEmpty(),
  check('email', 'Please include a valid email').isEmail(),
  check('password', 'Please enter a password with 6 or more characters').isLength({ min: 6 })
];

const signinValidation = [
  check('email', 'Please include a valid email').isEmail(),
  check('password', 'Password is required').exists()
];

// Sign Up
router.post('/signup', signupValidation, async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { name, email, password } = req.body;

  try {
    // Check if user exists
    const userExists = await db.query('SELECT * FROM users WHERE email = $1', [email]);
    if (userExists.rows.length > 0) {
      return res.status(400).json({ errors: [{ msg: 'User already exists' }] });
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Create user
    const result = await db.query(
      'INSERT INTO users (name, email, password) VALUES ($1, $2, $3) RETURNING id',
      [name, email, hashedPassword]
    );

    // Create JWT token
    const payload = {
      user: {
        id: result.rows[0].id
      }
    };

    jwt.sign(
      payload,
      process.env.JWT_SECRET,
      { expiresIn: '1h' },
      (err, token) => {
        if (err) throw err;
        res.json({ token });
      }
    );
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server error');
  }
});

// Middleware to verify JWT token
const authenticateToken = async (req, res, next) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
      return res.status(401).json({ errors: [{ msg: 'No token provided' }] });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded.user;
    next();
  } catch (err) {
    return res.status(403).json({ errors: [{ msg: 'Invalid token' }] });
  }
};

// Get current user
router.get('/me', authenticateToken, async (req, res) => {
  try {
    const result = await db.query('SELECT id, name, email FROM users WHERE id = $1', [req.user.id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ errors: [{ msg: 'User not found' }] });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server error');
  }
});

// Verify Email for Reset Password
router.post('/verify-email', [
  check('email', 'Please include a valid email').isEmail()
], async (req, res) => {
  console.log('\n=== Email Verification Request ===');
  console.log('Timestamp:', new Date().toISOString());
  console.log('Request Body:', req.body);

  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    console.log('Validation Errors:', errors.array());
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    const { email } = req.body;
    console.log('Searching for email:', email);

    const user = await db.query('SELECT * FROM users WHERE email = $1', [email]);
    console.log('Database response:', {
      found: user.rows.length > 0,
      timestamp: new Date().toISOString()
    });

    if (user.rows.length === 0) {
      console.log('Email not found in database');
      return res.status(404).json({ errors: [{ msg: 'Email not found in our database' }] });
    }

    console.log('Email verified successfully for user ID:', user.rows[0].id);
    res.json({ 
      message: 'Email verified successfully',
      userId: user.rows[0].id
    });
  } catch (err) {
    console.error('Error in email verification:', err);
    console.error('Stack trace:', err.stack);
    res.status(500).send('Server error');
  }
});

// Reset Password
router.post('/reset-password', [
  check('userId', 'User ID is required').not().isEmpty(),
  check('password', 'Please enter a password with 6 or more characters').isLength({ min: 6 })
], async (req, res) => {
  console.log('\n=== Password Reset Request ===');
  console.log('Timestamp:', new Date().toISOString());
  console.log('Request Body:', { 
    userId: req.body.userId,
    password: '********' // Hide password in logs
  });

  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    console.log('Validation Errors:', errors.array());
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    const { userId, password } = req.body;
    console.log('Processing password reset for user ID:', userId);
    
    // Hash new password
    console.log('Generating salt and hashing password...');
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);
    console.log('Password hashed successfully');

    // Update password in database
    console.log('Updating password in database...');
    const result = await db.query(
      'UPDATE users SET password = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 RETURNING id',
      [hashedPassword, userId]
    );

    if (result.rows.length === 0) {
      console.log('User not found in database for ID:', userId);
      return res.status(404).json({ errors: [{ msg: 'User not found' }] });
    }

    console.log('Password updated successfully for user ID:', userId);
    res.json({ message: 'Password updated successfully' });
  } catch (err) {
    console.error('Error in password reset:', err);
    console.error('Stack trace:', err.stack);
    res.status(500).send('Server error');
  }
});

// Sign In
router.post('/signin', signinValidation, async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { email, password } = req.body;

  try {
    // Check if user exists
    const result = await db.query('SELECT * FROM users WHERE email = $1', [email]);
    if (result.rows.length === 0) {
      return res.status(400).json({ errors: [{ msg: 'Invalid credentials' }] });
    }

    const user = result.rows[0];

    // Verify password
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ errors: [{ msg: 'Invalid credentials' }] });
    }

    // Create JWT token
    const payload = {
      user: {
        id: user.id
      }
    };

    jwt.sign(
      payload,
      process.env.JWT_SECRET,
      { expiresIn: '1h' },
      (err, token) => {
        if (err) throw err;
        res.json({ token });
      }
    );
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server error');
  }
});

export default router;