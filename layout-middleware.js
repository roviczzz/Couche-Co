// This middleware automatically sets the correct layout based on URL path
// It should be placed right after expressLayouts middleware

app.use((req, res, next) => {
  // For admin routes, use admin layout
  if (req.path.startsWith('/admin')) {
    res.locals.layout = 'admin/layout';
  }
  // For user routes, use user layout
  else if (req.path.startsWith('/user')) {
    res.locals.layout = 'user/layout';
  }
  // Other routes use the default layout

  next();
});
