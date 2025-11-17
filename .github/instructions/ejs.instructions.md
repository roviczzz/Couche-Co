# Rules for ExpressJS Project

## Core Principles

* Generate production-ready code with zero errors
* Prioritize functionality, efficiency, and maintainability
* Follow modern JavaScript/TypeScript best practices
* Write clean, self-documenting code without comments
* Deliver professional, minimalist front-end designs

## Code Quality Standards

### Error-Free Code

* Validate all inputs and handle edge cases
* Implement comprehensive error handling with try-catch blocks
* Use proper HTTP status codes (200, 201, 400, 401, 403, 404, 500)
* Return consistent error response format: `{success: false, error: "message"}`
* Never leave unhandled promise rejections

### Functionality Requirements

* Test all endpoints thoroughly before delivery
* Ensure CRUD operations work correctly
* Validate data before database operations
* Implement proper authentication/authorization where needed
* Use middleware correctly (error handlers, validators, auth)

### Code Efficiency

* Use async/await consistently, never mix with callbacks
* Optimize database queries (select only needed fields, use indexes)
* Implement pagination for list endpoints
* Use connection pooling for databases
* Cache frequently accessed data when appropriate
* Avoid N+1 query problems

### Code Style

* No comments unless absolutely necessary for complex algorithms
* Use descriptive variable and function names
* Keep functions small and focused (single responsibility)
* Use ES6+ features (destructuring, spread operators, arrow functions)
* Prefer const over let, never use var
* Use template literals for strings

## ExpressJS Specific

### Project Structure

```
src/
├── config/         (database, environment variables)
├── controllers/    (request handlers)
├── middleware/     (auth, validation, error handling)
├── models/         (database schemas)
├── routes/         (API endpoints)
├── services/       (business logic)
├── utils/          (helpers, validators)
├── public/         (static files)
└── app.js          (express setup)
```

### Routing

* Group routes by resource in separate files
* Use express.Router() for modular routing
* Apply middleware at appropriate levels
* Follow RESTful conventions:
  * GET /resource (list)
  * GET /resource/:id (retrieve)
  * POST /resource (create)
  * PUT /resource/:id (update)
  * DELETE /resource/:id (delete)

### Middleware

* Place global middleware before routes
* Use helmet for security headers
* Implement rate limiting for public endpoints
* Add CORS configuration
* Use express.json() and express.urlencoded()
* Create custom error handling middleware

### Database

* Use environment variables for connection strings
* Implement proper connection error handling
* Use ORMs (Sequelize, TypeORM) or query builders (Knex)
* Always close connections properly
* Use transactions for multiple related operations

### Security

* Validate and sanitize all user inputs
* Use bcrypt for password hashing (min 10 rounds)
* Implement JWT for authentication
* Store secrets in environment variables
* Prevent SQL injection with parameterized queries
* Set secure HTTP headers

### Environment Variables

Required in .env file:

* PORT
* DATABASE_URL
* JWT_SECRET
* NODE_ENV (development/production)

## Front-End Design

### Styling Approach

* Use Tailwind CSS or vanilla CSS with modern properties
* Implement responsive design (mobile-first)
* Use CSS Grid and Flexbox appropriately
* Maintain consistent spacing and typography
* Apply subtle shadows and borders for depth

### Design Principles

* Clean, minimalist interface
* Ample white space
* Clear visual hierarchy
* Professional color palette (neutral base with accent)
* Readable typography (system fonts or modern web fonts)
* Intuitive navigation and user flows

### UI Components

* Simple, functional forms with clear labels
* Visible loading states for async operations
* Toast notifications or alerts for user feedback
* Disabled states for buttons during processing
* Basic client-side validation with visual feedback

### No Heavy Frameworks

* Avoid unnecessary dependencies
* Use vanilla JavaScript for interactivity
* Keep bundle size minimal
* Progressive enhancement approach

## API Response Standards

### Success Response

```javascript
{
  success: true,
  data: {},
  message: "Operation successful"
}
```

### Error Response

```javascript
{
  success: false,
  error: "Error message"
}
```

### List Response

```javascript
{
  success: true,
  data: [],
  pagination: {
    page: 1,
    limit: 10,
    total: 100
  }
}
```

## Testing Requirements

* Verify all endpoints work correctly
* Test with valid and invalid inputs
* Check authentication and authorization
* Validate error handling
* Test edge cases and boundary conditions

## Performance Optimization

* Use compression middleware
* Implement request logging (morgan)
* Set appropriate cache headers
* Minimize response payload size
* Use database indexes on frequently queried fields

## Documentation Requirements

* Clear README.md with setup instructions
* List all environment variables needed
* Include API endpoint documentation
* Provide example requests/responses

## Code Delivery Checklist

* [ ] Zero syntax or runtime errors
* [ ] All functions tested and working
* [ ] Proper error handling implemented
* [ ] Security best practices followed
* [ ] Code is clean and maintainable
* [ ] Front-end is responsive and professional
* [ ] Environment variables documented
* [ ] Dependencies are minimal and necessary
