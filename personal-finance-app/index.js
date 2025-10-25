require('dotenv').config();
const express = require('express');
const { Pool } = require('pg');
const bcrypt = require('bcrypt');
const path = require('path');
const jwt = require('jsonwebtoken');

const app = express();
const port = process.env.PORT || 3000;
const jwtSecret = process.env.JWT_SECRET;

// Middleware
app.use(express.json());
app.use(express.static('public'));

// Database connection
const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: process.env.DB_PASSWORD,
  port: process.env.DB_PORT,
});

// Test the database connection
const testDbConnection = async () => {
  try {
    await pool.query('SELECT NOW()');
    console.log('Database connection successful!');
  } catch (err) {
    console.error('Database connection error:', err.message);
  }
};
testDbConnection();

// Middleware to protect routes with JWT
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (token == null) return res.status(401).send('Authentication token required');

  jwt.verify(token, jwtSecret, (err, user) => {
    if (err) return res.status(403).send('Invalid or expired token');
    req.user = user;
    next();
  });
};

// Root route to serve the landing page
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'html', 'index.html'));
});

// REGISTRATION ROUTE
app.post('/register', async (req, res) => {
  const { username, password } = req.body;
  try {
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);
    await pool.query(
      'INSERT INTO users (username, password_hash) VALUES ($1, $2)',
      [username, passwordHash]
    );
    res.status(201).json({ message: 'User registered successfully!' });
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ error: 'Username already exists' });
    }
    console.error(err);
    res.status(500).json({ error: 'Server error during registration' });
  }
});

// LOGIN ROUTE
app.post('/login', async (req, res) => {
  const { username, password } = req.body;
  try {
    const user = await pool.query('SELECT * FROM users WHERE username = $1', [username]);
    if (user.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid username or password' });
    }

    const validPassword = await bcrypt.compare(password, user.rows[0].password_hash);
    if (!validPassword) {
      return res.status(401).json({ error: 'Invalid username or password' });
    }

    // Create a JWT
    const accessToken = jwt.sign({ id: user.rows[0].id, username: user.rows[0].username }, jwtSecret);
    res.status(200).json({
      message: 'Logged in successfully!',
      token: accessToken,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error during login' });
  }
});

// PROTECTED DASHBOARD ROUTE
app.get('/dashboard', authenticateToken, (req, res) => {
  res.status(200).json({ message: `Welcome to the dashboard, ${req.user.username}!` });
});
// TRANSACTION ROUTE (PROTECTED)
app.post('/transactions', authenticateToken, async (req, res) => {
  const { amount, description, category, transaction_date } = req.body;
  const user_id = req.user.id; // Get the user ID from the authenticated token

  try {
    const result = await pool.query(
      'INSERT INTO transactions (user_id, amount, description, category, transaction_date) VALUES ($1, $2, $3, $4, $5) RETURNING *',
      [user_id, amount, description, category, transaction_date]
    );

    res.status(201).json({
      message: 'Transaction added successfully!',
      transaction: result.rows[0],
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error adding transaction' });
  }
});
// GET TRANSACTIONS ROUTE (PROTECTED)
app.get('/transactions', authenticateToken, async (req, res) => {
  const user_id = req.user.id;

  try {
    const result = await pool.query('SELECT * FROM transactions WHERE user_id = $1 ORDER BY transaction_date DESC', [user_id]);
    res.status(200).json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error retrieving transactions' });
  }
});
app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});
// CATEGORY ROUTES (PROTECTED)
app.post('/categories', authenticateToken, async (req, res) => {
    const { name } = req.body;
    const user_id = req.user.id;

    try {
        const result = await pool.query(
            'INSERT INTO categories (user_id, name) VALUES ($1, $2) RETURNING *',
            [user_id, name]
        );
        res.status(201).json({
            message: 'Category added successfully!',
            category: result.rows[0],
        });
    } catch (err) {
        if (err.code === '23505') {
            return res.status(409).json({ error: 'Category already exists' });
        }
        console.error(err);
        res.status(500).json({ error: 'Server error adding category' });
    }
});

app.get('/categories', authenticateToken, async (req, res) => {
    const user_id = req.user.id;
    try {
        const result = await pool.query('SELECT * FROM categories WHERE user_id = $1 ORDER BY name ASC', [user_id]);
        res.status(200).json(result.rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error retrieving categories' });
    }
});
// SUMMARY ROUTE (PROTECTED)
app.get('/summary', authenticateToken, async (req, res) => {
    const user_id = req.user.id;

    try {
        const result = await pool.query(
            'SELECT category, SUM(amount) AS total_amount FROM transactions WHERE user_id = $1 GROUP BY category ORDER BY total_amount DESC',
            [user_id]
        );
        res.status(200).json(result.rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error retrieving summary' });
    }
});
// PROFILE ROUTES (PROTECTED)
app.get('/profile', authenticateToken, async (req, res) => {
    const user_id = req.user.id;
    try {
        const result = await pool.query(
            'SELECT username, first_name, last_name FROM users WHERE id = $1', 
            [user_id]
        );
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'User not found' });
        }
        res.status(200).json(result.rows[0]);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error retrieving profile' });
    }
});

app.put('/profile', authenticateToken, async (req, res) => {
    const user_id = req.user.id;
    const { first_name, last_name } = req.body;
    try {
        const result = await pool.query(
            'UPDATE users SET first_name = $1, last_name = $2 WHERE id = $3 RETURNING username, first_name, last_name',
            [first_name, last_name, user_id]
        );
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'User not found' });
        }
        res.status(200).json({ 
            message: 'Profile updated successfully!',
            profile: result.rows[0]
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error updating profile' });
    }
});