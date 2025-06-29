using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using SmartCafe_BlessingsCafe.Data;

var builder = WebApplication.CreateBuilder(args);

// 1. Configure DB context
builder.Services.AddDbContext<SmartCafe_BlessingsCafeContext>(options =>
    options.UseSqlServer(builder.Configuration.GetConnectionString("SmartCafe_BlessingsCafeContext")
    ?? throw new InvalidOperationException("Connection string 'SmartCafe_BlessingsCafeContext' not found.")));

// 2. Add MVC + Session support
builder.Services.AddControllersWithViews();
builder.Services.AddSession(); // ✅ Add this line for session

var app = builder.Build();

// 3. Configure middleware
if (!app.Environment.IsDevelopment())
{
    app.UseExceptionHandler("/Home/Error");
    app.UseHsts();
}

app.UseHttpsRedirection();
app.UseStaticFiles();

app.UseRouting();

app.UseSession();       // ✅ Enable session before Authorization
app.UseAuthorization();

// 4. Set the default route to the login page
app.MapControllerRoute(
    name: "default",
    pattern: "{controller=Account}/{action=Login}/{id?}");

app.Run();
