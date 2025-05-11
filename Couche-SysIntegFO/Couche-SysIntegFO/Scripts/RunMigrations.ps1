# Add initial migrations
Add-Migration InitialCreate_Products -Context ProductDbContext
Add-Migration InitialCreate_Application -Context ApplicationDbContext

# Apply migrations to update databases
Update-Database -Context ProductDbContext
Update-Database -Migration InitialCreate_Application -Context ApplicationDbContext