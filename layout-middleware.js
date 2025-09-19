const path = require('path');

// This middleware sets the correct layout based on the user's role
app.use((req, res, next) => {
  // Set layout based on user role or default to main layout
  if (req.session?.user) {
    res.locals.layout = req.session.user.role === 'admin' ? 'admin/layout' : 'user/layout';
  } else {
    res.locals.layout = 'layout'; // Default layout for non-logged-in users
  }
  
  next();
});
