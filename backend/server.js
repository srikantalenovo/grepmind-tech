import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import authRoutes from './routes/auth.js';

dotenv.config();
const app = express();

// CORS Configuration
const corsOptions = {
  origin: 'http://localhost:3000',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Accept', 'Cache-Control'],
  credentials: true,
  maxAge: 86400 // CORS preflight cache time - 24 hours
};

app.use(cors(corsOptions));

// Options for preflight requests
app.options('*', cors(corsOptions));

// Request logging middleware
app.use((req, res, next) => {
  const startTime = Date.now();
  
  console.log('\n=== Incoming Request ===');
  console.log('Timestamp:', new Date().toISOString());
  console.log('Method:', req.method);
  console.log('URL:', req.url);
  console.log('Path:', req.path);
  console.log('Query:', req.query);
  console.log('Headers:', req.headers);
  
  // Only log body for non-GET requests
  if (req.method !== 'GET') {
    console.log('Body:', req.body);
  }
  
  // Log response details
  res.on('finish', () => {
    const duration = Date.now() - startTime;
    console.log('\n=== Response Sent ===');
    console.log('Status:', res.statusCode);
    console.log('Duration:', duration + 'ms');
    console.log('Headers:', res.getHeaders());
  });
  
  next();
});

// Body parser middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Error handler for JSON parsing
app.use((err, req, res, next) => {
  if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    console.error('JSON Parse Error:', err);
    return res.status(400).json({ 
      errors: [{ msg: 'Invalid JSON in request body' }] 
    });
  }
  next(err);
});

// Routes
app.use('/api/auth', authRoutes);

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});