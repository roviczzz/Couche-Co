# 🚀 Quick Reference: Optimization Changes

## How to Use the Shared Database Connection

### In Route Files (`routes/*.js`)

#### Before (OLD - Don't use):
```javascript
const { MongoClient, ObjectId } = require('mongodb');
const uri = process.env.MONGODB_URI;

router.get('/example', async (req, res) => {
  const client = await MongoClient.connect(uri);
  const db = client.db('blessingscafe');
  
  const data = await db.collection('Orders').find().toArray();
  
  await client.close();
  res.json(data);
});
```

#### After (NEW - Use this):
```javascript
const { ObjectId } = require('mongodb');

router.get('/example', async (req, res) => {
  const data = await req.db.collection('Orders').find().toArray();
  res.json(data);
});
```

---

### In Utility Files (`utils/*.js`)

#### Before (OLD - Don't use):
```javascript
const { MongoClient } = require('mongodb');
const uri = process.env.MONGODB_URI;

async function myFunction() {
  const client = new MongoClient(uri);
  await client.connect();
  const db = client.db('blessingscafe');
  
  // ... operations
  
  await client.close();
}
```

#### After (NEW - Use this):
```javascript
const dbConnection = require('./db');

async function myFunction() {
  const db = dbConnection.getDb();
  
  // ... operations
}
```

---

### In Helper Files (`admin-helpers.js`, etc.)

#### Before (OLD - Don't use):
```javascript
async function getOrders() {
  const client = await MongoClient.connect(uri);
  const db = client.db('blessingscafe');
  
  const orders = await db.collection('Orders').find().toArray();
  
  await client.close();
  return orders;
}
```

#### After (NEW - Use this):
```javascript
async function getOrders(db) {
  const orders = await db.collection('Orders').find().toArray();
  return orders;
}
```

**Important:** Helper functions now accept `db` as a parameter. Call them like this:
```javascript
const orders = await getOrders(req.db);
```

---

## Common Patterns

### Pattern 1: Simple Query
```javascript
// Get all documents
const orders = await req.db.collection('Orders').find().toArray();

// Get one document
const order = await req.db.collection('Orders').findOne({ OrderID: '12345' });

// Count documents
const count = await req.db.collection('Orders').countDocuments();
```

### Pattern 2: Query with Projection
```javascript
// Only fetch specific fields
const users = await req.db.collection('users')
  .find({}, { projection: { name: 1, email: 1 } })
  .toArray();
```

### Pattern 3: Update Operations
```javascript
// Update one document
await req.db.collection('Orders').updateOne(
  { OrderID: '12345' },
  { $set: { status: 'completed' } }
);

// Update many documents
await req.db.collection('Products').updateMany(
  { category: 'drinks' },
  { $inc: { stock: -1 } }
);
```

### Pattern 4: Insert Operations
```javascript
// Insert one
await req.db.collection('Orders').insertOne(orderData);

// Insert many
await req.db.collection('Products').insertMany([product1, product2]);
```

### Pattern 5: Delete Operations
```javascript
// Delete one
await req.db.collection('Orders').deleteOne({ OrderID: '12345' });

// Delete many
await req.db.collection('Temp').deleteMany({ expired: true });
```

---

## Rate Limiting Configuration

### Current Settings:

**API Endpoints (`/api/*`)**:
- Window: 15 minutes
- Max requests: 100
- Admin bypass: Yes

**Auth Endpoints (`/auth/login`, `/auth/register`)**:
- Window: 15 minutes
- Max requests: 5
- Skip successful requests: Yes

### How to Modify:

Edit in `server.js`:
```javascript
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,  // Change this
  max: 100,                   // Change this
  // ...
});
```

---

## Performance Monitoring

### Slow Request Warnings

Requests taking > 1000ms will be logged:
```
Slow request: GET /api/orders took 1523ms
```

### How to Change Threshold:

Edit in `server.js`:
```javascript
app.use((req, res, next) => {
  req.startTime = Date.now();
  
  res.on('finish', () => {
    const duration = Date.now() - req.startTime;
    if (duration > 1000) {  // Change this threshold
      console.warn(`Slow request: ${req.method} ${req.path} took ${duration}ms`);
    }
  });
  
  next();
});
```

---

## Database Connection Configuration

### Current Pool Settings:

Located in `utils/db.js`:
```javascript
new MongoClient(uri, {
  maxPoolSize: 10,      // Max connections in pool
  minPoolSize: 2,       // Min connections to maintain
  maxIdleTimeMS: 30000, // Close idle connections after 30s
  serverSelectionTimeoutMS: 5000  // Timeout after 5s
});
```

### How to Modify:

Edit `utils/db.js` to change these values based on your needs.

---

## Troubleshooting

### Problem: "Database not connected" Error

**Solution:**
```javascript
// Make sure server.js has connected before using
await dbConnection.connect();
```

### Problem: Rate Limit Too Strict

**Solution:**
- Increase `max` value in rate limiter
- Or exclude certain IPs/users
- Or increase `windowMs`

### Problem: Slow Queries

**Solution:**
1. Add indexes to frequently queried fields
2. Use projection to fetch only needed fields
3. Implement pagination for large datasets
4. Check slow request logs

---

## Best Practices

### ✅ DO:
- Use `req.db` in route handlers
- Use `dbConnection.getDb()` in utilities
- Pass `db` as parameter to helper functions
- Let the connection pool manage connections
- Use projection to fetch only needed fields

### ❌ DON'T:
- Create new MongoClient instances
- Call `client.connect()` in routes
- Call `client.close()` (pool manages this)
- Fetch entire documents when you only need a few fields
- Store database instances in global variables

---

## Cheat Sheet

| Task | Code |
|------|------|
| Get DB in route | `req.db` |
| Get DB in utility | `dbConnection.getDb()` |
| Find all | `req.db.collection('Name').find().toArray()` |
| Find one | `req.db.collection('Name').findOne({ id: 1 })` |
| Insert | `req.db.collection('Name').insertOne(data)` |
| Update | `req.db.collection('Name').updateOne(filter, update)` |
| Delete | `req.db.collection('Name').deleteOne(filter)` |
| Count | `req.db.collection('Name').countDocuments()` |

---

**Remember:** The database connection is now managed automatically. Just use `req.db` and focus on your business logic!
