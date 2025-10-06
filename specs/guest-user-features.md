# Guest User Features Specifications

This document outlines the features and functionality to implement for unlogged (guest) users on the Blessings Cafe website.

## Overview
Currently, guest users can only access the home page. Most features require login. The goal is to provide a better experience for prospective customers who want to browse the menu, learn about the cafe, and potentially register or place orders.

## Features Checklist

### 🔍 **Menu Browsing (High Priority)**
- [ ] Create public menu route (remove login requirement from `/menu`)
- [ ] Implement guest-friendly menu view with product images and descriptions
- [ ] Display pricing for available sizes/options
- [ ] Show allergen information when available
- [ ] Add "Login to Order" call-to-action buttons on menu items

### 📄 **Content Pages (High Priority)**
- [ ] Create `views/about.ejs` template with cafe history, mission, and location
- [ ] Create `views/contact.ejs` template with contact information, hours, and location
- [ ] Implement public routes for `/about` and `/contact` (currently routes exist but views are missing)

### 🔐 **User Registration (Medium Priority)**
- [ ] Add "Register" button to home page and footer
- [ ] Create public registration route/page
- [ ] Implement registration form with email, password, and basic info
- [ ] Add email verification process
- [ ] Redirect to login page after successful registration

### 📊 **Enhanced Home Page (Medium Priority)**
- [ ] Update hero section to include testimonials or featured items
- [ ] Add quick access buttons for menu, about, and contact
- [ ] Optionally display popular/featured menu items on home page
- [ ] Improve mobile responsiveness

### 🛒 **Guest Ordering (Low Priority)**
- [ ] Implement guest checkout system (no account required for simple orders)
- [ ] Add cart functionality for guests
- [ ] Create guest order form with delivery/pickup options
- [ ] Send order confirmation email to provided email address

### 🎨 **User Experience Improvements (Medium Priority)**
- [ ] Create consistent navigation for logged-out users
- [ ] Add footer with contact info, social links, and quick links
- [ ] Implement responsive design for mobile guests
- [ ] Add loading states and error handling for better UX

### 📧 **Newsletter Signup (Low Priority)**
- [ ] Add newsletter signup form to footer or home page
- [ ] Store guest email addresses in database
- [ ] Send welcome email upon signup

## Technical Requirements

### Routing Updates
- Remove `isLoggedIn` middleware from public routes like `/menu`
- Modify routes to conditionally show/hide features based on auth status
- Add API endpoints for guest actions (newsletter signup, guest orders)

### Database Changes
- Add collection for guest orders (if implementing guest checkout)
- Add collection for newsletter subscribers
- Consider temporary cart storage (Redis or session-based)

### Security Considerations
- Rate limiting on newsletter signup to prevent spam
- Input validation on all guest-submittable forms
- CSRF protection on forms

## Implementation Notes
- Prioritize features that help convert guests to customers (menu browsing, registration)
- Maintain visual consistency with existing design
- Ensure mobile-first responsive design
- Test all new routes and functionality thoroughly

## Future Considerations
- Loyalty program for registered users
- Guest order tracking system
- Social media integration
- Reviews and ratings system
