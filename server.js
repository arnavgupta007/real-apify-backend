const express = require('express');
const cors = require('cors');
const { createProxyMiddleware } = require('http-proxy-middleware');
const morgan = require('morgan');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3001;
const APIFY_API_BASE = process.env.APIFY_API_BASE_URL || 'https://api.apify.com/v2';

console.log('🚀 Starting Apify Proxy Server...');
console.log('📡 Target API:', APIFY_API_BASE);

// CORS configuration
app.use(cors({
    origin: ['http://localhost:3000', 'http://127.0.0.1:3000', 'http://localhost:8080', 'file://'],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(morgan('dev'));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Health check
app.get('/health', (req, res) => {
    res.json({ 
        status: 'OK', 
        timestamp: new Date().toISOString(),
        target: APIFY_API_BASE,
        uptime: process.uptime()
    });
});

// Proxy configuration
const apifyProxy = createProxyMiddleware({
    target: APIFY_API_BASE,
    changeOrigin: true,
    pathRewrite: {
        '^/api/apify': ''
    },
    onProxyReq: (proxyReq, req, res) => {
        console.log(`🔄 Proxying: ${req.method} ${req.url}`);
        
        // Log token usage (first 10 chars for security)
        const token = req.query.token || req.body?.token;
        if (token) {
            console.log(`🔑 Using token: ${token.substring(0, 10)}...`);
        }
    },
    onProxyRes: (proxyRes, req, res) => {
        console.log(`✅ Response: ${proxyRes.statusCode} from ${req.url}`);
    },
    onError: (err, req, res) => {
        console.error('❌ Proxy Error:', err.message);
        res.status(500).json({
            error: 'Proxy Error',
            message: err.message,
            timestamp: new Date().toISOString()
        });
    }
});

app.use('/api/apify', apifyProxy);

// Catch-all for unknown routes
app.use('*', (req, res) => {
    res.status(404).json({
        error: 'Route not found',
        available_routes: [
            '/health',
            '/api/apify/*'
        ],
        message: 'Use /api/apify/* to proxy Apify API calls'
    });
});

app.listen(PORT, () => {
    console.log(`\n🎉 Proxy server running successfully!`);
    console.log(`📍 Local: http://localhost:${PORT}`);
    console.log(`🔗 Health Check: http://localhost:${PORT}/health`);
    console.log(`🎯 API Proxy: http://localhost:${PORT}/api/apify/*`);
    console.log(`\n📚 Usage Examples:`);
    console.log(`   GET  http://localhost:${PORT}/api/apify/users/me?token=YOUR_TOKEN`);
    console.log(`   GET  http://localhost:${PORT}/api/apify/acts?token=YOUR_TOKEN`);
    console.log(`   POST http://localhost:${PORT}/api/apify/acts/ACTOR_ID/runs?token=YOUR_TOKEN`);
    console.log(`\n🛑 To stop: Ctrl+C\n`);
});

// Graceful shutdown
process.on('SIGINT', () => {
    console.log('\n🛑 Shutting down proxy server gracefully...');
    process.exit(0);
});

process.on('uncaughtException', (error) => {
    console.error('Uncaught Exception:', error);
    process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
    process.exit(1);
});

module.exports = app;
