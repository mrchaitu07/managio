const express = require('express');
const router = express.Router();
const User = require('../models/User');
const db = require('../config/db');

// @route   POST api/auth/register
// @desc    Register a user
// @access  Public
router.post('/register', async (req, res) => {
    const { username, email, password } = req.body;

    try {
        // Simple validation
        if (!username || !email || !password) {
            return res.status(400).json({ message: 'Please enter all fields' });
        }

        // Check if user already exists
        const [existingUser] = await db.execute(
            'SELECT id FROM users WHERE email = ?',
            [email]
        );

        if (existingUser.length > 0) {
            return res.status(400).json({ message: 'User already exists' });
        }

        // Create new user
        const token = await User.create({ username, email, password });
        
        res.status(201).json({
            token,
            user: {
                username,
                email
            }
        });
    } catch (error) {
        console.error('Registration error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// @route   POST api/auth/login
// @desc    Login user and get token
// @access  Public
router.post('/login', async (req, res) => {
    const { email, password } = req.body;

    try {
        // Simple validation
        if (!email || !password) {
            return res.status(400).json({ message: 'Please enter all fields' });
        }

        // Authenticate user
        const token = await User.login(email, password);
        
        // Get user data
        const [user] = await db.execute(
            'SELECT id, username, email FROM users WHERE email = ?',
            [email]
        );

        res.json({
            token,
            user: user[0]
        });
    } catch (error) {
        console.error('Login error:', error.message);
        res.status(400).json({ message: error.message || 'Invalid credentials' });
    }
});

module.exports = router;