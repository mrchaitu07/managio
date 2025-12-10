const db = require('../config/db');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
require('dotenv').config();

class User {
    // User registration
    static async create({ username, email, password }) {
        try {
            // Hash password
            const salt = await bcrypt.genSalt(10);
            const hashedPassword = await bcrypt.hash(password, salt);

            // Insert user into database
            const [result] = await db.execute(
                'INSERT INTO users (username, email, password) VALUES (?, ?, ?)',
                [username, email, hashedPassword]
            );

            // Generate JWT
            const payload = {
                user: {
                    id: result.insertId,
                    username,
                    email
                }
            };

            return jwt.sign(
                payload,
                process.env.JWT_SECRET,
                { expiresIn: '24h' }
            );
        } catch (error) {
            console.error('Error creating user:', error);
            throw error;
        }
    }

    // User login
    static async login(email, password) {
        try {
            // Find user by email
            const [users] = await db.execute(
                'SELECT * FROM users WHERE email = ?',
                [email]
            );

            if (users.length === 0) {
                throw new Error('Invalid credentials');
            }

            const user = users[0];

            // Verify password
            const isMatch = await bcrypt.compare(password, user.password);
            if (!isMatch) {
                throw new Error('Invalid credentials');
            }

            // Generate JWT
            const payload = {
                user: {
                    id: user.id,
                    username: user.username,
                    email: user.email
                }
            };

            return jwt.sign(
                payload,
                process.env.JWT_SECRET,
                { expiresIn: '24h' }
            );
        } catch (error) {
            console.error('Login error:', error);
            throw error;
        }
    }

    // Get user by ID
    static async getById(id) {
        try {
            const [users] = await db.execute(
                'SELECT id, username, email, created_at FROM users WHERE id = ?',
                [id]
            );
            return users[0] || null;
        } catch (error) {
            console.error('Error getting user by ID:', error);
            throw error;
        }
    }
}

module.exports = User;
