// server.js
const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const jwt = require('jsonwebtoken');

const app = express();
const port = 3000;
const secretKey = 'my-secret-key-for-jwt';

// Middleware
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Database setup
const db = new sqlite3.Database(path.join(__dirname, 'tammy_saves.db'), (err) => {
    if (err) {
        console.error('Error opening database:', err.message);
    } else {
        console.log('Connected to the tammy_saves.db database.');
        db.run(`CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE,
            password TEXT,
            first_name TEXT,
            last_name TEXT
        )`);
        db.run(`CREATE TABLE IF NOT EXISTS categories (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER,
            name TEXT UNIQUE,
            FOREIGN KEY (user_id) REFERENCES users(id)
        )`);
        db.run(`CREATE TABLE IF NOT EXISTS transactions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER,
            amount REAL,
            description TEXT,
            category TEXT,
            transaction_date TEXT,
            FOREIGN KEY (user_id) REFERENCES users(id)
        )`);
    }
});

// JWT Middleware
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        console.log('Authentication failed: No token provided');
        return res.status(401).json({ error: 'Authentication failed' });
    }

    jwt.verify(token, secretKey, (err, user) => {
        if (err) {
            console.log('Authentication failed:', err.message);
            return res.status(403).json({ error: 'Token is not valid' });
        }
        req.user = user;
        next();
    });
};

// API Routes
const router = express.Router();

// Register a new user
router.post('/register', (req, res) => {
    const { username, password } = req.body;
    const stmt = db.prepare('INSERT INTO users (username, password) VALUES (?, ?)');
    stmt.run(username, password, function(err) {
        if (err) {
            if (err.message.includes('UNIQUE constraint failed')) {
                return res.status(400).json({ error: 'Username already exists' });
            }
            return res.status(500).json({ error: 'Failed to register user' });
        }
        res.status(201).json({ message: 'User registered successfully!' });
    });
    stmt.finalize();
});

// Login
router.post('/login', (req, res) => {
    const { username, password } = req.body;
    db.get('SELECT * FROM users WHERE username = ? AND password = ?', [username, password], (err, user) => {
        if (err) {
            return res.status(500).json({ error: 'Database error' });
        }
        if (!user) {
            return res.status(401).json({ error: 'Invalid username or password' });
        }
        const token = jwt.sign({ id: user.id, username: user.username }, secretKey, { expiresIn: '1h' });
        res.status(200).json({ message: 'Login successful!', token });
    });
});

// Get user profile
router.get('/profile', authenticateToken, (req, res) => {
    const userId = req.user.id;
    db.get('SELECT username, first_name, last_name FROM users WHERE id = ?', [userId], (err, user) => {
        if (err) {
            return res.status(500).json({ error: 'Failed to fetch profile' });
        }
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }
        res.status(200).json(user);
    });
});

// Update user profile
router.put('/profile', authenticateToken, (req, res) => {
    const userId = req.user.id;
    const { firstName, lastName } = req.body;
    db.run('UPDATE users SET first_name = ?, last_name = ? WHERE id = ?', [firstName, lastName, userId], function(err) {
        if (err) {
            return res.status(500).json({ error: 'Failed to update profile' });
        }
        res.status(200).json({ message: 'Profile updated successfully!' });
    });
});

// Add a category
router.post('/categories', authenticateToken, (req, res) => {
    const { name } = req.body;
    const userId = req.user.id;
    const stmt = db.prepare('INSERT INTO categories (user_id, name) VALUES (?, ?)');
    stmt.run(userId, name, function(err) {
        if (err) {
            if (err.message.includes('UNIQUE constraint failed')) {
                return res.status(400).json({ error: 'Category already exists' });
            }
            return res.status(500).json({ error: 'Failed to add category' });
        }
        res.status(201).json({ message: 'Category added successfully!' });
    });
    stmt.finalize();
});

// Get all categories for a user
router.get('/categories', authenticateToken, (req, res) => {
    const userId = req.user.id;
    db.all('SELECT * FROM categories WHERE user_id = ?', [userId], (err, rows) => {
        if (err) {
            return res.status(500).json({ error: 'Failed to fetch categories' });
        }
        res.status(200).json(rows);
    });
});
// DELETE a category by ID
router.delete('/categories/:id', authenticateToken, (req, res) => {
    const { id } = req.params;
    const userId = req.user.id;

    db.run('DELETE FROM categories WHERE id = ? AND user_id = ?', [id, userId], function(err) {
        if (err) {
            return res.status(500).json({ error: 'Failed to delete category' });
        }
        if (this.changes === 0) {
            return res.status(404).json({ error: 'Category not found or you do not have permission to delete it.' });
        }
        res.status(200).json({ message: 'Category deleted successfully.' });
    });
});

// Add a transaction
router.post('/transactions', authenticateToken, (req, res) => {
    const { amount, description, category } = req.body;
    const userId = req.user.id;
    const transactionDate = new Date().toISOString().split('T')[0];

    db.run('INSERT INTO transactions (user_id, amount, description, category, transaction_date) VALUES (?, ?, ?, ?, ?)',
        [userId, amount, description, category, transactionDate], function(err) {
        if (err) {
            return res.status(500).json({ error: 'Failed to add transaction' });
        }
        res.status(201).json({ message: 'Transaction added successfully!' });
    });
});

// Get all transactions for a user
router.get('/transactions', authenticateToken, (req, res) => {
    const userId = req.user.id;
    db.all('SELECT * FROM transactions WHERE user_id = ? ORDER BY transaction_date DESC, id DESC', [userId], (err, rows) => {
        if (err) {
            return res.status(500).json({ error: 'Failed to fetch transactions' });
        }
        res.status(200).json(rows);
    });
});

// Get financial summary
router.get('/summary', authenticateToken, (req, res) => {
    const userId = req.user.id;
    db.all('SELECT category, SUM(amount) as total_amount FROM transactions WHERE user_id = ? GROUP BY category', [userId], (err, rows) => {
        if (err) {
            return res.status(500).json({ error: 'Failed to fetch summary' });
        }
        res.status(200).json(rows);
    });
});

// DELETE a transaction by ID
router.delete('/transactions/:id', authenticateToken, (req, res) => {
    const { id } = req.params;
    const userId = req.user.id;

    db.run('DELETE FROM transactions WHERE id = ? AND user_id = ?', [id, userId], function(err) {
        if (err) {
            return res.status(500).json({ error: 'Failed to delete transaction' });
        }
        if (this.changes === 0) {
            return res.status(404).json({ error: 'Transaction not found or you do not have permission to delete it.' });
        }
        res.status(200).json({ message: 'Transaction deleted successfully.' });
    });
});

app.use(router);

// Serve index.html for the root URL
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public/html', 'index.html'));
});

// Handle 404
app.use((req, res) => {
    res.status(404).send('404: File Not Found');
});

// Start the server
app.listen(port, () => {
    console.log(`Server is running at http://localhost:${port}`);
});