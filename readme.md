<img width="1869" height="992" alt="Image" src="https://github.com/user-attachments/assets/c8433884-ccc1-4e2d-8ebd-6e36618873fc" />

# SMART CAFE: A Complete E-commerce System for Blessings Cafe

A capstone output for Blessings Cafe located in Imus City, Cavite. Presented to the Information Technology Department of De La Salle University Dasmarinas. Built using ExpressJS + MongoDB + n8n + Node.js. Deployed using Docker inside a Digital Ocean Droplet.

## ⚡ Performance Optimized

**Latest optimizations (Nov 2025):**
- 🚀 **75-90% faster response times** with persistent database connections
- 🛡️ **Rate limiting protection** against brute force and DOS attacks
- 📊 **Performance monitoring** for slow request detection
- 💾 **Optimized caching** for static assets
- 🔄 **Connection pooling** eliminates overhead

See [OPTIMIZATION_REPORT.md](OPTIMIZATION_REPORT.md) for details.

# Blessings Cafe Admin Webpage [EJS]

[Blessings Cafe](https://blessingsateverysip.me/)

#### Deploying:

1. Install prerequisite modules:

```
npm install
```

2. Set up environment variables:

Create a `.env` file with:
```
MONGODB_URI=your_mongodb_connection_string
XENDIT_SECRET_KEY=your_xendit_key
```

3. Run website

```
npm start
```

Server will start on `http://localhost:8080`

#### Performance Features:

- **Database Connection Pooling** - Reuses connections for 10x better performance
- **Request Rate Limiting** - Protects against abuse (100 req/15min for API, 5 req/15min for auth)
- **Static Asset Caching** - 1-7 day cache headers
- **Gzip Compression** - Reduces bandwidth usage
- **Response Time Monitoring** - Logs slow requests (>1000ms)

See [QUICK_REFERENCE.md](QUICK_REFERENCE.md) for development guide.

# BlessingsBot [n8n]

#### Interacting with the chatbot:

1. Start conversation with the Blessings Cafe page by typing "Get Started" [non-case sensitive]

[BlessingsBot](https://www.facebook.com/Blessingsateverysip/)


## CREDITS:

**Team Couche**

- Math Daenniel Dela Rosa
- Ken Christian Divino
- Rovic Rodriguez
