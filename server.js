const express = require('express')
const session = require('express-session')
const { MongoClient, ObjectId } = require('mongodb')
const { check, validationResult } = require('express-validator')
const expressLayouts = require('express-ejs-layouts')
const bcrypt = require('bcrypt')
const app = express()
const port = 8080
require('dotenv').config()
const uri = process.env.MONGODB_URI
const client = new MongoClient(uri)
const flash = require('connect-flash')
const favicon = require('serve-favicon')
const path = require('path')
const SALT_ROUNDS = 12

// Xendit configuration
const XENDIT_SECRET_KEY = 'xnd_development_9YDHJULGUWulhmoYgQxildVQ3EWsAeviiJHwF3PSi9zmNcCKll8zEP3thAc5VvD9'
const XENDIT_API_URL = 'https://api.xendit.co'

app.use(favicon(path.join(__dirname, 'public', 'favicon.ico')))
app.use(session({
    secret: '4eaf42844a1772cb12e90869666b3a929f785d5bbd6d0fc5402c95ebc8721c3bca4ac502cc2fa7ec8abcbec042202876',
    resave: false,
    saveUninitialized: true,
    cookie: { secure: false }
}))
app.use(flash())
app.use((req, res, next) => {
    res.locals.success_msg = req.flash('success_msg')
    res.locals.error_msg = req.flash('error_msg')
    next()
})
app.use((req, res, next) => {
    res.locals.sidebarItems = [
        { path: '/dashboard', label: 'Home', icon: 'house' },
        { path: '/order', label: 'Orders', icon: 'box' },
        { path: '/menu', label: 'POS Menu', icon: 'list' },
        { path: '/stocks', label: 'Stocks', icon: 'warehouse' },
        { path: '/products', label: 'Products', icon: 'cart-shopping' },
        { path: '/logout', label: 'Logout', icon: 'door-open' }
    ]
    res.locals.currentPage = req.path
    next()
})
app.set('view engine', 'ejs')
app.set('views', __dirname + '/views')
app.use(express.urlencoded({ extended: true }))
app.use(express.json())
app.use(express.static(__dirname + '/public'))
app.use(expressLayouts)
app.set('layout', 'layout')
function isLoggedIn(req, res, next) {
    if (req.session.user) return next()
    res.redirect('/account/login')
}
function nocache(req, res, next) {
    res.header('Cache-Control', 'no-store, no-cache, must-revalidate, private')
    res.header('Pragma', 'no-cache')
    res.header('Expires', '0')
    next()
}
app.get('/', async (req, res) => {
    try {
        const client = await MongoClient.connect(uri)
        const db = client.db('blessingscafe')
        const collection = db.collection('users')
        const data = await collection.find({}).toArray()
        await client.close()
        res.render('login', { data, title: 'Login | Blessings Cafe', errors: {}, formData: {}, error: null, layout: false })
    } catch (err) {
        res.status(500).send('Internal Server Error')
    }
})
app.get('/account/login', (req, res) => {
    res.render('login', { title: 'Login | Blessings Cafe', errors: {}, error: null, formData: {}, layout: false })
})
app.post('/account/login', [
    check('Username').notEmpty().withMessage('Username is required'),
    check('Password').notEmpty().withMessage('Password is required'),
], async (req, res) => {
    const errorsObj = {}
    const errors = validationResult(req)
    if (!errors.isEmpty()) {
        errors.array().forEach(err => { errorsObj[err.param] = err })
        return res.render('login', {
            title: 'Login | Blessings Cafe',
            errors: errorsObj,
            error: null,
            formData: req.body,
            layout: false
        })
    }
    try {
        const client = await MongoClient.connect(uri)
        const db = client.db('blessingscafe')
        const users = db.collection('users')
        const user = await users.findOne({ username: req.body.Username })
        if (!user) {
            await client.close()
            return res.render('login', {
                title: 'Login | Blessings Cafe',
                errors: {},
                error: 'Invalid username or password',
                formData: { Username: req.body.Username },
                layout: false
            })
        }
        let passwordMatch = false
        if (user.password.startsWith('$2b$') || user.password.startsWith('$2a$')) {
            passwordMatch = await bcrypt.compare(req.body.Password, user.password)
        } else {
            if (req.body.Password === user.password) {
                passwordMatch = true
                const hashedPassword = await bcrypt.hash(req.body.Password, SALT_ROUNDS)
                await users.updateOne(
                    { _id: user._id },
                    {
                        $set: {
                            password: hashedPassword,
                            passwordUpgraded: new Date('2025-08-19T07:07:58.000Z'),
                            upgradedBy: 'auto-login'
                        }
                    }
                )
            }
        }
        await client.close()
        if (!passwordMatch) {
            return res.render('login', {
                title: 'Login | Blessings Cafe',
                errors: {},
                error: 'Invalid username or password',
                formData: { Username: req.body.Username },
                layout: false
            })
        }
        req.session.user = {
            _id: user._id,
            username: user.username,
            email: user.email,
            role: user.role || 'admin',
            loginTime: '2025-08-19 07:07:58'
        }
        res.redirect('/dashboard')
    } catch (err) {
        res.status(500).send('Internal Server Error')
    }
})
app.get('/account/register', (req, res) => {
    res.render('register', { errors: {}, formData: {}, error: null, layout: false })
})
app.get('/dashboard', isLoggedIn, nocache, async (req, res) => {
    const stats = await getDashboardStats()
    res.render('dashboard', { title: 'Dashboard | Blessings Cafe', user: req.session.user, stats })
})
app.get('/menu', isLoggedIn, nocache, async (req, res) => {
    try {
        const client = await MongoClient.connect(uri)
        const db = client.db('blessingscafe')
        const menuCollection = db.collection('Menu')
        const menuItems = await menuCollection.find().toArray()
        await client.close()
        res.render('menu', { menuItems, title: 'Menu | Blessings Cafe', user: req.session.user })
    } catch (err) {
        res.status(500).send('Internal Server Error')
    }
})
app.get('/api/addons', async (req, res) => {
    try {
        const client = await MongoClient.connect(uri)
        const db = client.db('blessingscafe')
        const addOns = await db.collection('Add-ons').find({ isEnabled: true }).toArray()
        await client.close()
        res.json(addOns)
    } catch (err) {
        res.status(500).json([])
    }
})
app.get('/api/orders/preparing-customers', async (req, res) => {
    try {
        const client = await MongoClient.connect(uri)
        const db = client.db('blessingscafe')
        const docs = await db.collection('Orders').find({ FulfillmentStatus: "Preparing" }).project({ Customer: 1 }).toArray()
        await client.close()
        res.json(docs.map(d => d.Customer))
    } catch (err) {
        res.status(500).json([])
    }
})

// Xendit API Routes
app.post('/api/xendit/create-payment', async (req, res) => {
    try {
        const invoicePayload = req.body

        const response = await fetch(`${XENDIT_API_URL}/invoices`, {
            method: 'POST',
            headers: {
                'Authorization': `Basic ${Buffer.from(XENDIT_SECRET_KEY + ':').toString('base64')}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(invoicePayload)
        })

        if (!response.ok) {
            const errorData = await response.text()
            console.error('Xendit API Error:', errorData)
            return res.status(response.status).json({
                error: 'Failed to create payment',
                details: errorData
            })
        }

        const paymentData = await response.json()
        res.json(paymentData)
    } catch (error) {
        console.error('Error creating Xendit payment:', error)
        res.status(500).json({ error: 'Internal server error' })
    }
})

app.get('/api/xendit/check-payment/:paymentId', async (req, res) => {
    try {
        const { paymentId } = req.params

        const response = await fetch(`${XENDIT_API_URL}/invoices/${paymentId}`, {
            method: 'GET',
            headers: {
                'Authorization': `Basic ${Buffer.from(XENDIT_SECRET_KEY + ':').toString('base64')}`,
                'Content-Type': 'application/json'
            }
        })

        if (!response.ok) {
            const errorData = await response.text()
            console.error('Xendit API Error:', errorData)
            return res.status(response.status).json({
                error: 'Failed to check payment status',
                details: errorData
            })
        }

        const paymentData = await response.json()
        res.json(paymentData)
    } catch (error) {
        console.error('Error checking payment status:', error)
        res.status(500).json({ error: 'Internal server error' })
    }
})

app.post('/api/xendit/webhook', express.raw({type: 'application/json'}), (req, res) => {
    try {
        const payload = JSON.parse(req.body)

        console.log('Xendit webhook received:', payload)

        if (payload.status === 'PAID') {
            console.log(`Payment completed for invoice: ${payload.external_id}`)
            // You can add your order update logic here
        }

        res.status(200).send('OK')
    } catch (error) {
        console.error('Webhook error:', error)
        res.status(400).send('Bad Request')
    }
})

app.get('/products', isLoggedIn, nocache, async (req, res) => {
    try {
        const client = new MongoClient(uri)
        const db = client.db('blessingscafe')
        const productCollection = db.collection('Menu')
        const products = await productCollection.find().toArray()
        await client.close()
        res.render('products', { products, title: 'Products | Blessings Cafe', user: req.session.user })
    } catch (err) {
        res.status(500).send('Internal Server Error')
    }
})
app.post('/toggle-availability/:id', async (req, res) => {
    const productId = req.params.id
    const isEnabled = req.body.isEnabled === true || req.body.isEnabled === 'true'
    try {
        const client = await MongoClient.connect(uri)
        const db = client.db('blessingscafe')
        const product = await db.collection('Menu').findOne({ _id: new ObjectId(productId) })
        if (!product) {
            await client.close()
            return res.status(404).json({ success: false, message: 'Product not found' })
        }
        const result = await db.collection('Menu').updateOne(
            { _id: new ObjectId(productId) },
            { $set: { isEnabled: isEnabled } }
        )
        await client.close()
        if (result.modifiedCount === 0) {
            return res.status(500).json({ success: false, message: 'No change made to product' })
        }
        res.json({ success: true, productName: product.Name })
    } catch (err) {
        res.status(500).json({ success: false })
    }
})
app.post('/products/add', async (req, res) => {
    const {
        categoryShortcut, productCode, Name, size16, size22,
        Ingredients, Allergen, imagelink, isEnabled, BasePrice
    } = req.body
    const categoryMap = { CF: "Coffee", MT: "Milktea", FT: "Fruit Tea", BK: "Pastries" }
    const Category = categoryMap[categoryShortcut] || null
    if (!Category || !productCode) {
        req.flash('error_msg', 'Please select a category and enter a product code.')
        return res.redirect('/add-product')
    }
    const ProductID = `${categoryShortcut.toUpperCase()}-${productCode.toUpperCase()}`
    const Sizes = []
    if (size16) Sizes.push({ Size: '16oz', BasePrice: parseFloat(size16) })
    if (size22) Sizes.push({ Size: '22oz', BasePrice: parseFloat(size22) })
    const ingredientsArray = Ingredients ? Ingredients.split(',').map(i => i.trim()) : []
    const productData = {
        ProductID,
        Name,
        Sizes: Sizes.length > 0 ? Sizes : null,
        Ingredients: ingredientsArray,
        Category,
        Allergen: Allergen || null,
        imagelink: imagelink || 'placeholder',
        isEnabled: isEnabled === 'true'
    }
    if (Category.toLowerCase() === 'pastries' && !isNaN(parseFloat(BasePrice))) {
        productData.BasePrice = parseFloat(BasePrice)
    }
    try {
        const client = await MongoClient.connect(uri)
        const db = client.db('blessingscafe')
        await db.collection('Menu').insertOne(productData)
        await client.close()
        req.flash('success_msg', `${Name} has been added to the menu`)
        res.redirect('/products')
    } catch (err) {
        res.status(500).send('Internal Server Error')
    }
})
app.post('/products/edit/:id', async (req, res) => {
    const { id } = req.params
    const { Name, Price, Category, imagelink, BasePrice, size16, size22, Ingredients, Allergen, isEnabled } = req.body
    try {
        const client = await MongoClient.connect(uri)
        const db = client.db('blessingscafe')
        const productCollection = db.collection('Menu')
        const updateFields = {
            Name,
            Price: parseFloat(Price),
            Category,
            imagelink,
            Allergen: Allergen || '',
            isEnabled: isEnabled === 'true',
            Ingredients: Ingredients ? Ingredients.split(',').map(i => i.trim()) : [],
        }
        if (Category.toLowerCase() === 'pastries' && BasePrice) {
            updateFields.BasePrice = parseFloat(BasePrice)
        }
        if (size16 || size22) {
            const Sizes = []
            if (size16) Sizes.push({ Size: '16oz', BasePrice: parseFloat(size16) })
            if (size22) Sizes.push({ Size: '22oz', BasePrice: parseFloat(size22) })
            updateFields.Sizes = Sizes
        } else {
            updateFields.Sizes = []
        }
        await productCollection.updateOne(
            { _id: new ObjectId(id) },
            { $set: updateFields }
        )
        await client.close()
        req.flash('success_msg', `${Name} has been updated`)
        res.redirect('/products')
    } catch (err) {
        res.status(500).send('Internal Server Error')
    }
})
app.get('/management', async (req, res) => {
    res.render('management', { currentPage: '/management' })
})
app.get('/forgot-password', (req, res) => {
    res.render('forgot-password', { layout: false })
})
app.post('/forgot-password', async (req, res) => {
    const { username, secretCode, newPassword } = req.body
    if (!username || !secretCode || !newPassword) {
        return res.status(400).send('Username, secret code, and new password are required')
    }
    let client
    try {
        client = await MongoClient.connect(uri)
        const db = client.db('blessingscafe')
        const usersCollection = db.collection('users')
        const user = await usersCollection.findOne({ username: username, secretCode: secretCode })
        if (!user) {
            await client.close()
            return res.status(404).send('User not found or invalid secret code')
        }
        await usersCollection.updateOne(
            { username: username, secretCode: secretCode },
            { $set: { password: newPassword } }
        )
        await client.close()
        res.send('Password updated successfully. You can now log in.')
    } catch (error) {
        if (client) await client.close()
        res.status(500).send('Server error')
    }
})
app.post('/delete-product/:id', async (req, res) => {
    const productId = req.params.id
    try {
        const client = await MongoClient.connect(uri)
        const db = client.db('blessingscafe')
        const result = await db.collection('Menu').deleteOne({ _id: new ObjectId(productId) })
        await client.close()
        if (result.deletedCount === 1) {
            req.flash('success_msg', `Product has been deleted`)
            res.redirect('/products')
        } else {
            res.status(404).send('Product not found')
        }
    } catch (err) {
        res.status(500).send('Internal Server Error')
    }
})
app.get('/add-product', isLoggedIn, nocache, (req, res) => {
    res.render('add-product', { title: 'Add Product | Blessings Cafe', user: req.session.user })
})
app.get('/edit-product/:id', isLoggedIn, nocache, async (req, res) => {
    const { id } = req.params;
    try {
        const client = await MongoClient.connect(uri);
        const db = client.db('blessingscafe');
        const product = await db.collection('Menu').findOne({ _id: new ObjectId(id) });
        await client.close();

        if (!product) return res.status(404).send('Product not found');

        res.render('edit-product', { title: 'Edit Product | Blessings Cafe', product, user: req.session.user});
    } catch (err) {
        console.error('Error fetching product for editing:', err);
        res.status(500).send('Internal Server Error');
    }
});

app.get('/stocks', isLoggedIn, nocache, async (req, res) => {
    try {
        const client = await MongoClient.connect(uri);
        const db = client.db('blessingscafe');
        const ingredients = await db.collection('Ingredients').find().toArray();
        const addons = await db.collection('Add-ons').find().toArray();
        await client.close();

        const message = req.query.msg || null;
        res.render('stocks', {
            ingredients,
            addons,
            title: 'Inventory Management | Blessings Cafe',
            user: req.session.user,
            message
        });
    } catch (err) {
        console.error(`[2025-09-03 15:26:01] Error loading inventory:`, err);
        res.status(500).send('Failed to load inventory');
    }
});

app.post('/stocks', async (req, res) => {
    const { IngredientID, IngredientPrefix, IngredientSuffix, Name, Quantity, Category, Allergen, isAvailable, isEnabled } = req.body;

    let finalIngredientID = IngredientID;
    if (IngredientPrefix && IngredientSuffix) {
        finalIngredientID = `${IngredientPrefix}-${IngredientSuffix}`;
    }

    try {
        const client = await MongoClient.connect(uri);
        const db = client.db('blessingscafe');

        const existingIngredient = await db.collection('Ingredients').findOne({
            IngredientID: finalIngredientID
        });

        if (existingIngredient) {
            await client.close();
            return res.redirect('/stocks?msg=duplicate_id');
        }

        const newIngredient = {
            IngredientID: finalIngredientID,
            Name: Name.trim(),
            Quantity: parseInt(Quantity),
            Category: Category.trim(),
            Allergen: Allergen ? Allergen.trim() : 'None',
            isAvailable: isAvailable === 'true',
            isEnabled: isEnabled === 'true',
            createdAt: new Date(),
            lastModified: new Date()
        };

        await db.collection('Ingredients').insertOne(newIngredient);
        await client.close();

        console.log(`[2025-09-03 15:26:01] Ingredient added: ${finalIngredientID} by MathDaenniel`);
        res.redirect('/stocks?msg=add_success');
    } catch (err) {
        console.error(`[2025-09-03 15:26:01] Error adding ingredient:`, err);
        res.status(500).send('Failed to add ingredient');
    }
});

app.post('/stocks/edit/:id', async (req, res) => {
    const id = req.params.id;
    const { IngredientID, IngredientPrefix, IngredientSuffix, Name, Quantity, Category, Allergen, isAvailable, isEnabled } = req.body;

    let finalIngredientID;

    if (IngredientID && IngredientID.trim()) {
        finalIngredientID = IngredientID.trim();
    }
    else if (IngredientPrefix && IngredientSuffix) {
        finalIngredientID = `${IngredientPrefix}-${IngredientSuffix}`;
    }

    if (!finalIngredientID) {
        console.log(`[2025-09-03 15:26:01] Missing ingredient ID data for update: ID ${id} by MathDaenniel`);
        return res.redirect('/stocks?msg=item_not_found');
    }

    try {
        const client = await MongoClient.connect(uri);
        const db = client.db('blessingscafe');

        const currentIngredient = await db.collection('Ingredients').findOne({ _id: new ObjectId(id) });
        if (!currentIngredient) {
            await client.close();
            return res.redirect('/stocks?msg=item_not_found');
        }

        if (finalIngredientID !== currentIngredient.IngredientID) {
            const existingIngredient = await db.collection('Ingredients').findOne({
                IngredientID: finalIngredientID,
                _id: { $ne: new ObjectId(id) }
            });

            if (existingIngredient) {
                await client.close();
                return res.redirect('/stocks?msg=duplicate_id');
            }
        }

        const updateData = {
            IngredientID: finalIngredientID,
            Name: Name.trim(),
            Quantity: parseInt(Quantity),
            Category: Category.trim(),
            Allergen: Allergen ? Allergen.trim() : 'None',
            isAvailable: isAvailable === 'true',
            isEnabled: isEnabled === 'true',
            lastModified: new Date()
        };

        const result = await db.collection('Ingredients').updateOne(
            { _id: new ObjectId(id) },
            { $set: updateData }
        );

        await client.close();

        if (result.matchedCount === 0) {
            console.log(`[2025-09-03 15:26:01] Ingredient not found for update: ID ${id} by MathDaenniel`);
            return res.redirect('/stocks?msg=item_not_found');
        }

        console.log(`[2025-09-03 15:26:01] Ingredient updated: ${currentIngredient.IngredientID} -> ${finalIngredientID} by MathDaenniel`);
        res.redirect('/stocks?msg=update_success');
    } catch (err) {
        console.error(`[2025-09-03 15:26:01] Error updating ingredient:`, err);
        res.status(500).send('Failed to update ingredient');
    }
});

app.post('/stocks/delete/:id', async (req, res) => {
    const id = req.params.id;

    try {
        const client = await MongoClient.connect(uri);
        const db = client.db('blessingscafe');

        const ingredientToDelete = await db.collection('Ingredients').findOne({ _id: new ObjectId(id) });

        if (!ingredientToDelete) {
            await client.close();
            return res.redirect('/stocks?msg=item_not_found');
        }

        const result = await db.collection('Ingredients').deleteOne({ _id: new ObjectId(id) });

        await client.close();

        if (result.deletedCount === 0) {
            console.log(`[2025-09-03 15:26:01] Ingredient not found for deletion: ID ${id} by MathDaenniel`);
            return res.redirect('/stocks?msg=delete_failed');
        }

        console.log(`[2025-09-03 15:26:01] Ingredient deleted: ${ingredientToDelete.IngredientID} by MathDaenniel`);
        res.redirect('/stocks?msg=delete_success');
    } catch (err) {
        console.error(`[2025-09-03 15:26:01] Error deleting ingredient:`, err);
        res.status(500).send('Failed to delete ingredient');
    }
});

app.post('/addons', async (req, res) => {
    const { AddOnID, AddOnPrefix, AddOnSuffix, Name, Quantity, Category, Allergen, isEnabledAddon } = req.body;

    let finalAddOnID = AddOnID;
    if (AddOnPrefix && AddOnSuffix) {
        finalAddOnID = `${AddOnPrefix}-${AddOnSuffix}`;
    }

    try {
        const client = await MongoClient.connect(uri);
        const db = client.db('blessingscafe');

        const existingAddOn = await db.collection('Add-ons').findOne({
            AddOnID: finalAddOnID
        });

        if (existingAddOn) {
            await client.close();
            return res.redirect('/stocks?msg=duplicate_id');
        }

        const newAddOn = {
            AddOnID: finalAddOnID,
            Name: Name.trim(),
            Quantity: parseInt(Quantity),
            Category: Category.trim(),
            Allergen: Allergen ? Allergen.trim() : 'None',
            isEnabled: isEnabledAddon === 'true',
            createdAt: new Date(),
            lastModified: new Date()
        };

        await db.collection('Add-ons').insertOne(newAddOn);
        await client.close();

        console.log(`[2025-09-03 15:26:01] Add-on added: ${finalAddOnID} by MathDaenniel`);
        res.redirect('/stocks?msg=add_success');
    } catch (err) {
        console.error(`[2025-09-03 15:26:01] Error adding add-on:`, err);
        res.status(500).send('Failed to add add-on');
    }
});

app.post('/addons/edit/:id', async (req, res) => {
    const id = req.params.id;
    const { AddOnID, AddOnPrefix, AddOnSuffix, Name, Quantity, Category, Allergen, isEnabled } = req.body;

    let finalAddOnID;

    if (AddOnID && AddOnID.trim()) {
        finalAddOnID = AddOnID.trim();
    }
    else if (AddOnPrefix && AddOnSuffix) {
        finalAddOnID = `${AddOnPrefix}-${AddOnSuffix}`;
    }

    if (!finalAddOnID) {
        console.log(`[2025-09-03 15:26:01] Missing add-on ID data for update: ID ${id} by MathDaenniel`);
        return res.redirect('/stocks?msg=item_not_found');
    }

    try {
        const client = await MongoClient.connect(uri);
        const db = client.db('blessingscafe');

        const currentAddOn = await db.collection('Add-ons').findOne({ _id: new ObjectId(id) });
        if (!currentAddOn) {
            await client.close();
            return res.redirect('/stocks?msg=item_not_found');
        }

        if (finalAddOnID !== currentAddOn.AddOnID) {
            const existingAddOn = await db.collection('Add-ons').findOne({
                AddOnID: finalAddOnID,
                _id: { $ne: new ObjectId(id) }
            });

            if (existingAddOn) {
                await client.close();
                return res.redirect('/stocks?msg=duplicate_id');
            }
        }

        const updateData = {
            AddOnID: finalAddOnID,
            Name: Name.trim(),
            Quantity: parseInt(Quantity),
            Category: Category.trim(),
            Allergen: Allergen ? Allergen.trim() : 'None',
            isEnabled: isEnabled === 'true',
            lastModified: new Date()
        };

        const result = await db.collection('Add-ons').updateOne(
            { _id: new ObjectId(id) },
            { $set: updateData }
        );

        await client.close();

        if (result.matchedCount === 0) {
            console.log(`[2025-09-03 15:26:01] Add-on not found for update: ID ${id} by MathDaenniel`);
            return res.redirect('/stocks?msg=item_not_found');
        }

        console.log(`[2025-09-03 15:26:01] Add-on updated: ${currentAddOn.AddOnID} -> ${finalAddOnID} by MathDaenniel`);
        res.redirect('/stocks?msg=update_success');
    } catch (err) {
        console.error(`[2025-09-03 15:26:01] Error updating add-on:`, err);
        res.status(500).send('Failed to update add-on');
    }
});

app.post('/addons/delete/:id', async (req, res) => {
    const id = req.params.id;

    try {
        const client = await MongoClient.connect(uri);
        const db = client.db('blessingscafe');

        const addonToDelete = await db.collection('Add-ons').findOne({ _id: new ObjectId(id) });

        if (!addonToDelete) {
            await client.close();
            return res.redirect('/stocks?msg=item_not_found');
        }

        const result = await db.collection('Add-ons').deleteOne({ _id: new ObjectId(id) });

        await client.close();

        if (result.deletedCount === 0) {
            console.log(`[2025-09-03 15:26:01] Add-on not found for deletion: ID ${id} by MathDaenniel`);
            return res.redirect('/stocks?msg=delete_failed');
        }

        console.log(`[2025-09-03 15:26:01] Add-on deleted: ${addonToDelete.AddOnID} by MathDaenniel`);
        res.redirect('/stocks?msg=delete_success');
    } catch (err) {
        console.error(`[2025-09-03 15:26:01] Error deleting add-on:`, err);
        res.status(500).send('Failed to delete add-on');
    }
});

app.get('/stocks/details/:id', isLoggedIn, async (req, res) => {
    const id = req.params.id;

    try {
        const client = await MongoClient.connect(uri);
        const db = client.db('blessingscafe');
        const ingredient = await db.collection('Ingredients').findOne({ _id: new ObjectId(id) });
        await client.close();

        if (!ingredient) {
            return res.status(404).json({ error: 'Ingredient not found' });
        }

        res.json(ingredient);
    } catch (err) {
        console.error(`[2025-09-03 15:26:01] Error fetching ingredient details:`, err);
        res.status(500).json({ error: 'Failed to fetch ingredient details' });
    }
});

app.get('/addons/details/:id', isLoggedIn, async (req, res) => {
    const id = req.params.id;

    try {
        const client = await MongoClient.connect(uri);
        const db = client.db('blessingscafe');
        const addon = await db.collection('Add-ons').findOne({ _id: new ObjectId(id) });
        await client.close();

        if (!addon) {
            return res.status(404).json({ error: 'Add-on not found' });
        }

        res.json(addon);
    } catch (err) {
        console.error(`[2025-09-03 15:26:01] Error fetching add-on details:`, err);
        res.status(500).json({ error: 'Failed to fetch add-on details' });
    }
});

app.post('/stocks/bulk-update', isLoggedIn, async (req, res) => {
    const { updates } = req.body;

    try {
        const client = await MongoClient.connect(uri);
        const db = client.db('blessingscafe');

        const bulkOps = updates.map(update => ({
            updateOne: {
                filter: { _id: new ObjectId(update.id) },
                update: {
                    $set: {
                        ...update.data,
                        lastModified: new Date()
                    }
                }
            }
        }));

        const result = await db.collection('Ingredients').bulkWrite(bulkOps);
        await client.close();

        console.log(`[2025-09-03 15:26:01] Bulk update completed: ${result.modifiedCount} ingredients updated by MathDaenniel`);
        res.json({ success: true, modified: result.modifiedCount });
    } catch (err) {
        console.error(`[2025-09-03 15:26:01] Error in bulk update:`, err);
        res.status(500).json({ error: 'Failed to perform bulk update' });
    }
});

app.post('/addons/bulk-update', isLoggedIn, async (req, res) => {
    const { updates } = req.body;

    try {
        const client = await MongoClient.connect(uri);
        const db = client.db('blessingscafe');

        const bulkOps = updates.map(update => ({
            updateOne: {
                filter: { _id: new ObjectId(update.id) },
                update: {
                    $set: {
                        ...update.data,
                        lastModified: new Date()
                    }
                }
            }
        }));

        const result = await db.collection('Add-ons').bulkWrite(bulkOps);
        await client.close();

        console.log(`[2025-09-03 15:26:01] Bulk update completed: ${result.modifiedCount} add-ons updated by MathDaenniel`);
        res.json({ success: true, modified: result.modifiedCount });
    } catch (err) {
        console.error(`[2025-09-03 15:26:01] Error in bulk update:`, err);
        res.status(500).json({ error: 'Failed to perform bulk update' });
    }
});

app.get('/stocks/export', isLoggedIn, async (req, res) => {
    try {
        const client = await MongoClient.connect(uri);
        const db = client.db('blessingscafe');
        const ingredients = await db.collection('Ingredients').find().toArray();
        const addons = await db.collection('Add-ons').find().toArray();
        await client.close();

        const exportData = {
            ingredients,
            addons,
            exportedAt: new Date(),
            exportedBy: 'MathDaenniel',
            version: 'V3.0',
            timestamp: '[2025-09-03 15:26:01]'
        };

        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Content-Disposition', 'attachment; filename="inventory-export-v3.json"');
        res.json(exportData);

        console.log(`[2025-09-03 15:26:01] Inventory data exported by MathDaenniel`);
    } catch (err) {
        console.error(`[2025-09-03 15:26:01] Error exporting inventory data:`, err);
        res.status(500).json({ error: 'Failed to export inventory data' });
    }
});

app.get('/stocks/search', isLoggedIn, async (req, res) => {
    const { query, type = 'all' } = req.query;

    if (!query) {
        return res.json({ ingredients: [], addons: [] });
    }

    try {
        const client = await MongoClient.connect(uri);
        const db = client.db('blessingscafe');

        const searchRegex = new RegExp(query, 'i');
        const searchFilter = {
            $or: [
                { Name: searchRegex },
                { Category: searchRegex },
                { Allergen: searchRegex },
                { IngredientID: searchRegex },
                { AddOnID: searchRegex }
            ]
        };

        let ingredients = [];
        let addons = [];

        if (type === 'all' || type === 'ingredients') {
            ingredients = await db.collection('Ingredients').find(searchFilter).toArray();
        }

        if (type === 'all' || type === 'addons') {
            addons = await db.collection('Add-ons').find(searchFilter).toArray();
        }

        await client.close();

        console.log(`[2025-09-03 15:26:01] Search performed for "${query}" by MathDaenniel`);
        res.json({
            ingredients,
            addons,
            searchQuery: query,
            searchType: type,
            resultCount: ingredients.length + addons.length,
            timestamp: '[2025-09-03 15:26:01]'
        });
    } catch (err) {
        console.error(`[2025-09-03 15:26:01] Error searching inventory:`, err);
        res.status(500).json({ error: 'Failed to search inventory' });
    }
});

app.get('/stocks/stats', isLoggedIn, async (req, res) => {
    try {
        const client = await MongoClient.connect(uri);
        const db = client.db('blessingscafe');

        const ingredientStats = await db.collection('Ingredients').aggregate([
            {
                $group: {
                    _id: null,
                    totalIngredients: { $sum: 1 },
                    enabledIngredients: { $sum: { $cond: ['$isEnabled', 1, 0] } },
                    totalQuantity: { $sum: '$Quantity' },
                    categories: { $addToSet: '$Category' }
                }
            }
        ]).toArray();

        const addonStats = await db.collection('Add-ons').aggregate([
            {
                $group: {
                    _id: null,
                    totalAddons: { $sum: 1 },
                    enabledAddons: { $sum: { $cond: ['$isEnabled', 1, 0] } },
                    totalQuantity: { $sum: '$Quantity' },
                    categories: { $addToSet: '$Category' }
                }
            }
        ]).toArray();

        await client.close();

        const stats = {
            ingredients: ingredientStats[0] || { totalIngredients: 0, enabledIngredients: 0, totalQuantity: 0, categories: [] },
            addons: addonStats[0] || { totalAddons: 0, enabledAddons: 0, totalQuantity: 0, categories: [] },
            generatedAt: new Date(),
            generatedBy: 'MathDaenniel',
            version: 'V3.0',
            timestamp: '[2025-09-03 15:26:01]'
        };

        console.log(`[2025-09-03 15:26:01] Inventory statistics generated by MathDaenniel`);
        res.json(stats);
    } catch (err) {
        console.error(`[2025-09-03 15:26:01] Error generating inventory statistics:`, err);
        res.status(500).json({ error: 'Failed to generate inventory statistics' });
    }
});

app.get('/stocks/alerts', isLoggedIn, async (req, res) => {
    const { threshold = 10 } = req.query;
    const lowStockThreshold = parseInt(threshold);

    try {
        const client = await MongoClient.connect(uri);
        const db = client.db('blessingscafe');

        const lowStockIngredients = await db.collection('Ingredients').find({
            Quantity: { $lte: lowStockThreshold },
            isEnabled: true
        }).toArray();

        const lowStockAddons = await db.collection('Add-ons').find({
            Quantity: { $lte: lowStockThreshold },
            isEnabled: true
        }).toArray();

        await client.close();

        const alerts = {
            lowStockIngredients,
            lowStockAddons,
            threshold: lowStockThreshold,
            totalAlerts: lowStockIngredients.length + lowStockAddons.length,
            generatedAt: new Date(),
            generatedBy: 'MathDaenniel',
            timestamp: '[2025-09-03 15:26:01]'
        };

        console.log(`[2025-09-03 15:26:01] Low stock alerts generated (threshold: ${lowStockThreshold}) by MathDaenniel`);
        res.json(alerts);
    } catch (err) {
        console.error(`[2025-09-03 15:26:01] Error generating low stock alerts:`, err);
        res.status(500).json({ error: 'Failed to generate low stock alerts' });
    }
});

app.get('/stocks/categories', isLoggedIn, async (req, res) => {
    try {
        const client = await MongoClient.connect(uri);
        const db = client.db('blessingscafe');

        const ingredientCategories = await db.collection('Ingredients').distinct('Category');
        const addonCategories = await db.collection('Add-ons').distinct('Category');

        await client.close();

        const categories = {
            ingredients: ingredientCategories.filter(cat => cat && cat.trim()),
            addons: addonCategories.filter(cat => cat && cat.trim()),
            all: [...new Set([...ingredientCategories, ...addonCategories])].filter(cat => cat && cat.trim()),
            generatedAt: new Date(),
            generatedBy: 'MathDaenniel',
            timestamp: '[2025-09-03 15:26:01]'
        };

        console.log(`[2025-09-03 15:26:01] Categories retrieved by MathDaenniel`);
        res.json(categories);
    } catch (err) {
        console.error(`[2025-09-03 15:26:01] Error retrieving categories:`, err);
        res.status(500).json({ error: 'Failed to retrieve categories' });
    }
});

app.get('/stocks/health', isLoggedIn, async (req, res) => {
    try {
        const client = await MongoClient.connect(uri);
        const db = client.db('blessingscafe');

        await db.admin().ping();

        const ingredientCount = await db.collection('Ingredients').countDocuments();
        const addonCount = await db.collection('Add-ons').countDocuments();

        await client.close();

        const healthStatus = {
            status: 'healthy',
            database: 'connected',
            ingredients: ingredientCount,
            addons: addonCount,
            version: 'V3.0',
            timestamp: new Date(),
            checkedBy: 'MathDaenniel'
        };

        console.log(`[2025-09-03 15:26:01] Health check performed by MathDaenniel`);
        res.json(healthStatus);
    } catch (err) {
        console.error(`[2025-09-03 15:26:01] Health check failed:`, err);
        res.status(500).json({
            status: 'unhealthy',
            database: 'disconnected',
            error: err.message,
            timestamp: new Date(),
            checkedBy: 'MathDaenniel'
        });
    }
});

app.get('/order', isLoggedIn, nocache, async (req, res) => {
    try {
        const client = await MongoClient.connect(uri)
        const db = client.db('blessingscafe')
        const ordersCollection = db.collection('Orders')
        const menuCollection = db.collection('Menu')
        const orders = await ordersCollection.find().toArray()
        const menu = await menuCollection.find().toArray()
        await client.close()
        res.render('order', {
            orders,
            menu,
            title: 'Orders | Blessings Cafe',
            user: req.session.user
        })
    } catch (err) {
        res.status(500).send('Internal Server Error')
    }
})

app.patch('/orders/:OrderID/fulfillment', isLoggedIn, nocache, async (req, res) => {
    const { OrderID } = req.params
    const { FulfillmentStatus } = req.body

    if (!FulfillmentStatus) {
        return res.status(400).json({ error: 'FulfillmentStatus is required' })
    }

    if (!OrderID || OrderID.trim() === '') {
        return res.status(400).json({ error: 'Invalid OrderID format' })
    }

    let client
    try {
        client = await MongoClient.connect(uri)
        const db = client.db('blessingscafe')
        const ordersCollection = db.collection('Orders')

        const filter = { OrderID: OrderID }
        const updateDoc = { $set: { FulfillmentStatus } }

        const updateResult = await ordersCollection.updateOne(filter, updateDoc)
        const updatedOrder = await ordersCollection.findOne(filter)

        if (!updatedOrder) {
            await client.close()
            return res.status(404).json({ error: `Order with ID ${OrderID} not found` })
        }

        await client.close()
        return res.status(200).json({
            success: true,
            message: `Fulfillment status updated to "${FulfillmentStatus}"`,
            order: updatedOrder
        })
    } catch (error) {
        if (client) await client.close()
        return res.status(500).json({ error: 'Server error while updating order' })
    }
})

app.patch('/orders/:OrderID/payment-status', isLoggedIn, nocache, async (req, res) => {
    const { OrderID } = req.params
    const { PaymentStatus } = req.body

    if (!PaymentStatus) {
        return res.status(400).json({ error: 'PaymentStatus is required' })
    }

    if (!OrderID || OrderID.trim() === '') {
        return res.status(400).json({ error: 'Invalid OrderID format' })
    }

    let client
    try {
        client = await MongoClient.connect(uri)
        const db = client.db('blessingscafe')
        const ordersCollection = db.collection('Orders')

        const filter = { OrderID: OrderID }
        const updateDoc = { $set: { PaymentStatus } }

        const updateResult = await ordersCollection.updateOne(filter, updateDoc)
        const updatedOrder = await ordersCollection.findOne(filter)

        if (!updatedOrder) {
            await client.close()
            return res.status(404).json({ error: `Order with ID ${OrderID} not found` })
        }

        await client.close()
        return res.status(200).json({
            success: true,
            message: `Payment status updated to "${PaymentStatus}"`,
            order: updatedOrder
        })
    } catch (error) {
        if (client) await client.close()
        return res.status(500).json({ error: 'Server error while updating order' })
    }
})

app.patch('/orders/:OrderID/cancel', isLoggedIn, nocache, async (req, res) => {
    const { OrderID } = req.params

    if (!OrderID || OrderID.trim() === '') {
        return res.status(400).json({ error: 'Invalid OrderID format' })
    }

    let client
    try {
        client = await MongoClient.connect(uri)
        const db = client.db('blessingscafe')
        const ordersCollection = db.collection('Orders')

        const filter = { OrderID: OrderID }
        const updateDoc = {
            $set: {
                PaymentStatus: 'Cancelled',
                FulfillmentStatus: 'Cancelled'
            }
        }

        const updateResult = await ordersCollection.updateOne(filter, updateDoc)
        const updatedOrder = await ordersCollection.findOne(filter)

        if (!updatedOrder) {
            await client.close()
            return res.status(404).json({ error: `Order with ID ${OrderID} not found` })
        }

        await client.close()
        return res.status(200).json({
            success: true,
            message: 'Order cancelled successfully',
            order: updatedOrder
        })
    } catch (error) {
        if (client) await client.close()
        return res.status(500).json({ error: 'Server error while cancelling order' })
    }
})

app.patch('/orders/:OrderID/restore', isLoggedIn, nocache, async (req, res) => {
    const { OrderID } = req.params

    if (!OrderID || OrderID.trim() === '') {
        return res.status(400).json({ error: 'Invalid OrderID format' })
    }

    let client
    try {
        client = await MongoClient.connect(uri)
        const db = client.db('blessingscafe')
        const ordersCollection = db.collection('Orders')

        const filter = { OrderID: OrderID }
        const updateDoc = {
            $set: {
                PaymentStatus: 'Pending',
                FulfillmentStatus: 'Preparing'
            }
        }

        const updateResult = await ordersCollection.updateOne(filter, updateDoc)
        const updatedOrder = await ordersCollection.findOne(filter)

        if (!updatedOrder) {
            await client.close()
            return res.status(404).json({ error: `Order with ID ${OrderID} not found` })
        }

        await client.close()
        return res.status(200).json({
            success: true,
            message: 'Order restored successfully',
            order: updatedOrder
        })
    } catch (error) {
        if (client) await client.close()
        return res.status(500).json({ error: 'Server error while restoring order' })
    }
})

app.get('/orders/edit/:id', isLoggedIn, nocache, async (req, res) => {
    const orderId = req.params.id;

    if (!ObjectId.isValid(orderId)) {
        return res.status(400).send('Invalid order ID');
    }

    try {
        const client = await MongoClient.connect(uri);
        const db = client.db('blessingscafe');
        const ordersCollection = db.collection('Orders');
        const menuCollection = db.collection('Menu');

        const order = await ordersCollection.findOne({ _id: new ObjectId(orderId) });

        if (!order) {
            await client.close();
            return res.status(404).send('Order not found');
        }

        if (order.Cart && Array.isArray(order.Cart)) {
            for (let i = 0; i < order.Cart.length; i++) {
                const productId = order.Cart[i].ProductID;
                if (productId && ObjectId.isValid(productId)) {
                    const menuItem = await menuCollection.findOne({ _id: new ObjectId(productId) });
                    order.Cart[i].imagelink = menuItem && menuItem.imagelink ? menuItem.imagelink : null;
                } else {
                    order.Cart[i].imagelink = null;
                }
            }
        }

        await client.close();

        res.render('edit-order', {
            order,
            title: `Edit Order #${order.OrderID}`,
            user: req.session.user
        });
    } catch (err) {
        console.error('Error in /orders/edit/:id:', err);
        res.status(500).send('Internal Server Error');
    }
});

app.get('/discounts', isLoggedIn, nocache, async (req, res) => {
    try {
        console.log(`[2025-08-26 17:33:44] Loading discounts page for user: ${req.session.user.username} by MathDaenniel`);

        const client = await MongoClient.connect(uri);
        const db = client.db('blessingscafe');
        const promosCollection = db.collection('Promos');
        const promos = await promosCollection.find().toArray();
        await client.close();

        console.log(`[2025-08-26 17:33:44] Fetched ${promos.length} promos from database by MathDaenniel`);

        const message = req.query.msg || null;
        res.render('discounts', {
            promos,
            title: 'Promo Management | Blessings Cafe',
            user: req.session.user,
            message,
            currentPage: req.path
        });
    } catch (err) {
        console.error(`[2025-08-26 17:33:44] Error fetching promos:`, err, 'by MathDaenniel');
        res.status(500).send('Failed to load promos');
    }
});

app.post('/discounts/add', isLoggedIn, async (req, res) => {
    console.log(`[2025-08-26 17:33:44] Promo add request started for user: ${req.session.user.username} by MathDaenniel`);
    console.log(`[2025-08-26 17:33:44] Request body:`, req.body, 'by MathDaenniel');

    try {
        if (!req.body || typeof req.body !== 'object') {
            console.log(`[2025-08-26 17:33:44] Critical error: req.body is not an object by MathDaenniel`);
            return res.status(400).json({
                success: false,
                message: 'Request body parsing failed. Please check form configuration.',
                debug: {
                    bodyType: typeof req.body,
                    bodyValue: req.body,
                    contentType: req.headers['content-type']
                }
            });
        }

        const { event, startDate, endDate, description, discountPercentage } = req.body;

        console.log(`[2025-08-26 17:33:44] Extracted fields:`, {
            event, startDate, endDate, description, discountPercentage
        }, 'by MathDaenniel');

        if (!event || !startDate || !endDate || !description || discountPercentage === undefined || discountPercentage === null) {
            console.log(`[2025-08-26 17:33:44] Validation failed - missing fields by MathDaenniel`);
            return res.status(400).json({
                success: false,
                message: 'All fields are required',
                received: { event, startDate, endDate, description, discountPercentage }
            });
        }

        const trimmedEvent = String(event).trim();
        const trimmedDescription = String(description).trim();

        if (!trimmedEvent || !trimmedDescription) {
            console.log(`[2025-08-26 17:33:44] Validation failed - empty fields after trim by MathDaenniel`);
            return res.status(400).json({
                success: false,
                message: 'Fields cannot be empty'
            });
        }

        const discountPercent = parseFloat(discountPercentage);
        if (isNaN(discountPercent) || discountPercent < 0 || discountPercent > 100) {
            console.log(`[2025-08-26 17:33:44] Discount percentage validation failed by MathDaenniel`);
            return res.status(400).json({
                success: false,
                message: 'Discount percentage must be a number between 0 and 100'
            });
        }

        const start = new Date(startDate);
        const end = new Date(endDate);

        console.log(`[2025-08-26 17:33:44] Date parsing:`, {
            start, end,
            startValid: !isNaN(start.getTime()),
            endValid: !isNaN(end.getTime())
        }, 'by MathDaenniel');

        if (isNaN(start.getTime()) || isNaN(end.getTime())) {
            console.log(`[2025-08-26 17:33:44] Date validation failed - invalid dates by MathDaenniel`);
            return res.status(400).json({
                success: false,
                message: 'Invalid date format'
            });
        }

        if (start > end) {
            console.log(`[2025-08-26 17:33:44] Date validation failed - start date after end date by MathDaenniel`);
            return res.status(400).json({
                success: false,
                message: 'End date must be after or equal to start date'
            });
        }

        console.log(`[2025-08-26 17:33:44] Connecting to MongoDB by MathDaenniel`);

        const client = await MongoClient.connect(uri);
        const db = client.db('blessingscafe');
        const promosCollection = db.collection('Promos');

        const existingPromo = await promosCollection.findOne({
            event: trimmedEvent,
            $or: [
                { startDate: { $lte: end }, endDate: { $gte: start } }
            ]
        });

        if (existingPromo) {
            await client.close();
            console.log(`[2025-08-26 17:33:44] Duplicate promo detected by MathDaenniel`);
            return res.status(400).json({
                success: false,
                message: 'A promo with the same event name already exists in the selected date range'
            });
        }

        const newPromo = {
            event: trimmedEvent,
            startDate: start,
            endDate: end,
            description: trimmedDescription,
            discountPercentage: discountPercent,
            isActive: true,
            createdAt: new Date(),
            createdBy: 'MathDaenniel',
            lastModified: new Date(),
            lastModifiedBy: 'MathDaenniel'
        };

        console.log(`[2025-08-26 17:33:44] Document to insert:`, newPromo, 'by MathDaenniel');

        const result = await promosCollection.insertOne(newPromo);
        console.log(`[2025-08-26 17:33:44] Insert result:`, result, 'by MathDaenniel');

        const insertedDoc = await promosCollection.findOne({ _id: result.insertedId });
        console.log(`[2025-08-26 17:33:44] Verification - discount percentage saved:`, insertedDoc?.discountPercentage, 'by MathDaenniel');

        const totalCount = await promosCollection.countDocuments();
        console.log(`[2025-08-26 17:33:44] Total promos in collection: ${totalCount} by MathDaenniel`);

        await client.close();

        console.log(`[2025-08-26 17:33:44] Promo add request completed successfully by MathDaenniel`);

        res.json({
            success: true,
            message: 'Promo added successfully',
            promo: {
                _id: result.insertedId,
                ...newPromo
            }
        });
    } catch (err) {
        console.error(`[2025-08-26 17:33:44] Error adding promo:`, err, 'by MathDaenniel');

        res.status(500).json({
            success: false,
            message: 'Database error occurred. Please check server logs.',
            error: process.env.NODE_ENV === 'development' ? err.message : 'Internal server error',
            timestamp: '[2025-08-26 17:33:44]'
        });
    }
});

app.post('/discounts/edit/:id', isLoggedIn, async (req, res) => {
    const { id } = req.params;

    try {
        console.log(`[2025-08-26 17:33:44] Edit promo request for ID: ${id} by MathDaenniel`);

        let event, startDate, endDate, description, discountPercentage;

        if (req.headers['content-type'] && req.headers['content-type'].includes('application/json')) {
            ({ event, startDate, endDate, description, discountPercentage } = req.body);
        } else {
            event = req.body.event;
            startDate = req.body.startDate;
            endDate = req.body.endDate;
            description = req.body.description;
            discountPercentage = req.body.discountPercentage;
        }

        console.log(`[2025-08-26 17:33:44] Edit request data:`, {
            event, startDate, endDate, description, discountPercentage
        }, 'by MathDaenniel');

        if (!event || !startDate || !endDate || !description || discountPercentage === undefined || discountPercentage === null) {
            console.log(`[2025-08-26 17:33:44] Edit validation failed - missing fields by MathDaenniel`);
            return res.status(400).json({
                success: false,
                message: 'All fields are required',
                received: { event, startDate, endDate, description, discountPercentage }
            });
        }

        const discountPercent = parseFloat(discountPercentage);
        if (isNaN(discountPercent) || discountPercent < 0 || discountPercent > 100) {
            console.log(`[2025-08-26 17:33:44] Edit discount percentage validation failed by MathDaenniel`);
            return res.status(400).json({
                success: false,
                message: 'Discount percentage must be a number between 0 and 100'
            });
        }

        const start = new Date(startDate);
        const end = new Date(endDate);

        if (isNaN(start.getTime()) || isNaN(end.getTime())) {
            console.log(`[2025-08-26 17:33:44] Edit date validation failed by MathDaenniel`);
            return res.status(400).json({
                success: false,
                message: 'Invalid date format'
            });
        }

        if (start > end) {
            console.log(`[2025-08-26 17:33:44] Edit date range validation failed by MathDaenniel`);
            return res.status(400).json({
                success: false,
                message: 'End date must be after or equal to start date'
            });
        }

        if (!ObjectId.isValid(id)) {
            console.log(`[2025-08-26 17:33:44] Invalid ObjectId: ${id} by MathDaenniel`);
            return res.status(400).json({
                success: false,
                message: 'Invalid promo ID'
            });
        }

        const client = await MongoClient.connect(uri);
        const db = client.db('blessingscafe');
        const promosCollection = db.collection('Promos');

        const currentPromo = await promosCollection.findOne({ _id: new ObjectId(id) });
        if (!currentPromo) {
            await client.close();
            console.log(`[2025-08-26 17:33:44] Promo not found for edit: ${id} by MathDaenniel`);
            return res.status(404).json({
                success: false,
                message: 'Promo not found'
            });
        }

        const duplicatePromo = await promosCollection.findOne({
            _id: { $ne: new ObjectId(id) },
            event: String(event).trim(),
            $or: [
                { startDate: { $lte: end }, endDate: { $gte: start } }
            ]
        });

        if (duplicatePromo) {
            await client.close();
            console.log(`[2025-08-26 17:33:44] Duplicate promo detected during edit by MathDaenniel`);
            return res.status(400).json({
                success: false,
                message: 'A promo with the same event name already exists in the selected date range'
            });
        }

        const updateResult = await promosCollection.updateOne(
            { _id: new ObjectId(id) },
            {
                $set: {
                    event: String(event).trim(),
                    startDate: start,
                    endDate: end,
                    description: String(description).trim(),
                    discountPercentage: discountPercent,
                    lastModified: new Date(),
                    lastModifiedBy: 'MathDaenniel'
                }
            }
        );

        console.log(`[2025-08-26 17:33:44] Update result:`, updateResult, 'by MathDaenniel');

        await client.close();

        if (updateResult.matchedCount === 0) {
            console.log(`[2025-08-26 17:33:44] No promo matched for update: ${id} by MathDaenniel`);
            return res.status(404).json({
                success: false,
                message: 'Promo not found'
            });
        }

        console.log(`[2025-08-26 17:33:44] Promo updated: ${currentPromo.event} -> ${String(event).trim()} by MathDaenniel`);

        res.json({
            success: true,
            message: 'Promo updated successfully'
        });
    } catch (err) {
        console.error(`[2025-08-26 17:33:44] Error editing promo:`, err, 'by MathDaenniel');
        res.status(500).json({
            success: false,
            message: 'Database error: ' + err.message
        });
    }
});

app.post('/discounts/delete/:id', isLoggedIn, async (req, res) => {
    const { id } = req.params;

    console.log(`[2025-08-26 17:33:44] Deleting promo: ${id} by MathDaenniel`);

    if (!ObjectId.isValid(id)) {
        console.log(`[2025-08-26 17:33:44] Invalid ObjectId for delete: ${id} by MathDaenniel`);
        return res.status(400).json({
            success: false,
            message: 'Invalid promo ID'
        });
    }

    try {
        const client = await MongoClient.connect(uri);
        const db = client.db('blessingscafe');
        const promosCollection = db.collection('Promos');

        const promo = await promosCollection.findOne({ _id: new ObjectId(id) });

        if (!promo) {
            await client.close();
            console.log(`[2025-08-26 17:33:44] Promo not found for delete: ${id} by MathDaenniel`);
            return res.status(404).json({
                success: false,
                message: 'Promo not found'
            });
        }

        const deleteResult = await promosCollection.deleteOne({ _id: new ObjectId(id) });

        console.log(`[2025-08-26 17:33:44] Delete result:`, deleteResult, 'by MathDaenniel');

        await client.close();

        if (deleteResult.deletedCount === 0) {
            console.log(`[2025-08-26 17:33:44] No promo deleted: ${id} by MathDaenniel`);
            return res.status(404).json({
                success: false,
                message: 'Promo not found'
            });
        }

        console.log(`[2025-08-26 17:33:44] Promo "${promo.event}" deleted by MathDaenniel`);

        res.json({
            success: true,
            message: 'Promo deleted successfully'
        });
    } catch (err) {
        console.error(`[2025-08-26 17:33:44] Error deleting promo:`, err, 'by MathDaenniel');
        res.status(500).json({
            success: false,
            message: 'Database error: ' + err.message
        });
    }
});

app.post('/discounts/toggle-switch', isLoggedIn, async (req, res) => {
    const { promoId, enabled } = req.body;

    try {
        console.log(`[2025-08-26 17:33:44] Promo ${promoId} toggled to: ${enabled} by MathDaenniel`);

        if (!ObjectId.isValid(promoId)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid promo ID'
            });
        }

        const client = await MongoClient.connect(uri);
        const db = client.db('blessingscafe');
        const promosCollection = db.collection('Promos');

        const updateResult = await promosCollection.updateOne(
            { _id: new ObjectId(promoId) },
            {
                $set: {
                    isActive: enabled === true || enabled === 'true',
                    lastModified: new Date(),
                    lastModifiedBy: 'MathDaenniel'
                }
            }
        );

        await client.close();

        if (updateResult.matchedCount === 0) {
            return res.status(404).json({
                success: false,
                message: 'Promo not found'
            });
        }

        res.json({
            success: true,
            message: `Promo switch ${enabled ? 'enabled' : 'disabled'} successfully`
        });
    } catch (err) {
        console.error(`[2025-08-26 17:33:44] Error toggling promo switch:`, err, 'by MathDaenniel');
        res.status(500).json({
            success: false,
            message: 'Failed to toggle promo switch'
        });
    }
});

app.get('/discounts/stats', isLoggedIn, async (req, res) => {
    try {
        const client = await MongoClient.connect(uri);
        const db = client.db('blessingscafe');
        const promosCollection = db.collection('Promos');

        const now = new Date();

        const stats = await promosCollection.aggregate([
            {
                $group: {
                    _id: null,
                    totalPromos: { $sum: 1 },
                    activePromos: { $sum: { $cond: ['$isActive', 1, 0] } },
                    currentPromos: {
                        $sum: {
                            $cond: [
                                { $and: [
                                        { $lte: ['$startDate', now] },
                                        { $gte: ['$endDate', now] },
                                        '$isActive'
                                    ]},
                                1,
                                0
                            ]
                        }
                    },
                    avgDiscountPercentage: { $avg: '$discountPercentage' }
                }
            }
        ]).toArray();

        await client.close();

        const result = {
            ...(stats[0] || { totalPromos: 0, activePromos: 0, currentPromos: 0, avgDiscountPercentage: 0 }),
            generatedAt: new Date(),
            generatedBy: 'MathDaenniel',
            timestamp: '[2025-08-26 17:33:44]'
        };

        console.log(`[2025-08-26 17:33:44] Promo statistics generated by MathDaenniel`);
        res.json(result);
    } catch (err) {
        console.error(`[2025-08-26 17:33:44] Error generating promo statistics:`, err, 'by MathDaenniel');
        res.status(500).json({ error: 'Failed to generate promo statistics' });
    }
});

app.get('/discounts/export', isLoggedIn, async (req, res) => {
    try {
        const client = await MongoClient.connect(uri);
        const db = client.db('blessingscafe');
        const promosCollection = db.collection('Promos');
        const promos = await promosCollection.find().toArray();
        await client.close();

        const exportData = {
            promos,
            exportedAt: new Date(),
            exportedBy: 'MathDaenniel',
            version: 'V12',
            timestamp: '[2025-08-26 17:33:44]'
        };

        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Content-Disposition', 'attachment; filename="promos-export-v12.json"');
        res.json(exportData);

        console.log(`[2025-08-26 17:33:44] Promo data exported by MathDaenniel`);
    } catch (err) {
        console.error(`[2025-08-26 17:33:44] Error exporting promo data:`, err, 'by MathDaenniel');
        res.status(500).json({ error: 'Failed to export promo data' });
    }
});

app.get('/settings', isLoggedIn, nocache, (req, res) => {
    res.render('settings', {
        title: 'Settings | Blessings Cafe',
        user: req.session.user,
        currentPage: req.path
    })
})

app.get('/admin/settings', isLoggedIn, nocache, (req, res) => {
    res.render('settings', {
        title: 'Admin Settings | Blessings Cafe',
        user: req.session.user,
        currentPage: req.path
    })
})

app.post('/admin/change-password', isLoggedIn, async (req, res) => {
    try {
        const { currentPassword, newPassword } = req.body
        if (!currentPassword || !newPassword) {
            return res.status(400).json({ success: false, message: 'Current password and new password are required' })
        }
        if (newPassword.length < 8) {
            return res.status(400).json({ success: false, message: 'New password must be at least 8 characters long', field: 'newPassword' })
        }
        if (currentPassword === newPassword) {
            return res.status(400).json({ success: false, message: 'New password must be different from current password', field: 'newPassword' })
        }
        const client = await MongoClient.connect(uri)
        const db = client.db('blessingscafe')
        const users = db.collection('users')
        const user = await users.findOne({ _id: new ObjectId(req.session.user._id) })
        if (!user) {
            await client.close()
            return res.status(404).json({ success: false, message: 'User not found' })
        }
        let currentPasswordValid = false
        if (user.password.startsWith('$2b$') || user.password.startsWith('$2a$')) {
            currentPasswordValid = await bcrypt.compare(currentPassword, user.password)
        } else {
            currentPasswordValid = (currentPassword === user.password)
        }
        if (!currentPasswordValid) {
            await client.close()
            return res.status(400).json({ success: false, message: 'Current password is incorrect', field: 'currentPassword' })
        }
        const hashedNewPassword = await bcrypt.hash(newPassword, SALT_ROUNDS)
        const updateResult = await users.updateOne(
            { _id: user._id },
            {
                $set: {
                    password: hashedNewPassword,
                    passwordChangedAt: new Date('2025-08-19T07:07:58.000Z'),
                    passwordChangedBy: req.session.user.username,
                    lastModified: new Date('2025-08-19T07:07:58.000Z')
                }
            }
        )
        await client.close()
        if (updateResult.modifiedCount === 1) {
            res.json({
                success: true,
                message: 'Password changed successfully! For security purposes, please log in again with your new password.'
            })
        } else {
            res.status(500).json({ success: false, message: 'Failed to update password in database' })
        }
    } catch (error) {
        res.status(500).json({ success: false, message: 'Internal server error occurred while changing password' })
    }
})

app.post('/admin/migrate-passwords', isLoggedIn, async (req, res) => {
    if (req.session.user.role !== 'admin') {
        return res.status(403).json({ success: false, message: 'Unauthorized' })
    }
    try {
        const client = await MongoClient.connect(uri)
        const db = client.db('blessingscafe')
        const users = db.collection('users')
        const plainTextUsers = await users.find({ password: { $not: { $regex: /^\$2[ab]\$/ } } }).toArray()
        let migratedCount = 0
        for (const user of plainTextUsers) {
            if (user.password && user.password.length > 0) {
                const hashedPassword = await bcrypt.hash(user.password, SALT_ROUNDS)
                await users.updateOne(
                    { _id: user._id },
                    {
                        $set: {
                            password: hashedPassword,
                            passwordMigratedAt: new Date('2025-08-19T07:07:58.000Z'),
                            migratedBy: req.session.user.username
                        }
                    }
                )
                migratedCount++
            }
        }
        await client.close()
        res.json({
            success: true,
            message: `Successfully migrated ${migratedCount} passwords to bcrypt hashing`,
            migratedCount: migratedCount
        })
    } catch (error) {
        res.status(500).json({ success: false, message: 'Error during password migration' })
    }
})

app.get('/logout', (req, res) => {
    req.session.destroy((err) => {
        res.redirect('/account/login')
    })
})

app.post('/api/orders', async (req, res) => {
    try {
        const orderData = req.body
        if (!orderData || !orderData.OrderID || !orderData.Date || !orderData.Cart || !orderData.Customer) {
            return res.status(400).json({ success: false, error: 'Missing required order fields' })
        }
        const client = await MongoClient.connect(uri)
        const db = client.db('blessingscafe')
        await db.collection('Orders').insertOne(orderData)
        await client.close()
        res.json({ success: true, orderId: orderData.OrderID })
    } catch (err) {
        res.status(500).json({ success: false, error: 'Failed to save order' })
    }
})

app.post('/api/orders/update-payment-status', async (req, res) => {
    const { paymentId, status } = req.body;
    if (!paymentId || !status) {
        return res.status(400).json({ success: false, error: 'Missing paymentId or status.' });
    }
    try {
        await client.connect();
        const db = client.db('blessingscafe');
        const orders = db.collection('Orders');
        const result = await orders.updateOne(
            { XenditPaymentID: paymentId },
            { $set: { PaymentStatus: status } }
        );
        if (result.matchedCount === 0) {
            return res.status(404).json({ success: false, error: 'Order not found.' });
        }
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ success: false, error: 'Database error.' });
    } finally {
        await client.close();
    }
});

let ordersCollection
let menuCollection
async function connectDB() {
    await client.connect()
    const db = client.db('blessingscafe')
    ordersCollection = db.collection('Orders')
    menuCollection = db.collection('Menu')
}

connectDB()
    .then(() => console.log("Connected to MongoDB"))
    .catch(err => console.error("DB connection error:", err))

async function getPopularProducts() {
    try {
        const results = await ordersCollection.aggregate([
            { $unwind: "$Cart" },
            {
                $group: {
                    _id: "$Cart.ProductName",
                    totalQuantity: { $sum: "$Cart.Quantity" }
                }
            },
            { $sort: { totalQuantity: -1 } }
        ]).toArray()
        return results
    } catch (error) {
        return []
    }
}

app.get('/analytics/popular-products', async (req, res) => {
    try {
        const results = await getPopularProducts()
        res.json(results)
    } catch (err) {
        res.status(500).json({ error: 'Error generating analytics' })
    }
})

app.get('/analytics/average-sales-per-day', async (req, res) => {
    try {
        const salesPerDay = await ordersCollection.aggregate([
            {
                $addFields: {
                    parsedDate: {
                        $cond: {
                            if: { $eq: [{ $type: "$Date" }, "string"] },
                            then: { $dateFromString: { dateString: "$Date" } },
                            else: "$Date"
                        }
                    }
                }
            },
            {
                $group: {
                    _id: { $dateToString: { format: "%Y-%m-%d", date: "$parsedDate" } },
                    avgSales: { $avg: "$Total" }
                }
            },
            { $sort: { _id: 1 } }
        ]).toArray();

        res.json(salesPerDay);
    } catch (err) {
        console.error(err);
        res.status(500).send("Error fetching average sales per day");
    }
});

app.get("/ingredients/search", async (req, res) => {
    try {
        const query = req.query.q || "";

        const db = client.db("blessingscafe");

        const results = await db.collection("Ingredients").distinct("Name", {
            Name: { $regex: query, $options: "i" }
        });

        res.json(results.slice(0, 50));
    } catch (err) {
        console.error("Error in /ingredients/search:", err);
        res.status(500).json({ error: "Server error" });
    }
});

app.get('/analytics', isLoggedIn, nocache, (req, res) => {
    res.render('analytics', {
        title: 'Analytics | Blessings Cafe',
        user: req.session.user,
        currentPage: req.path
    })
})

app.get('/analytics/sales-performance', isLoggedIn, async (req, res) => {
    const days = parseInt(req.query.days) || 14
    try {
        const client = await MongoClient.connect(uri)
        const db = client.db('blessingscafe')
        const ordersCollection = db.collection('Orders')
        const endDate = new Date()
        const startDate = new Date()
        startDate.setDate(startDate.getDate() - days)
        const pipeline = [
            {
                $addFields: {
                    orderDate: {
                        $cond: {
                            if: { $eq: [{ $type: "$Date" }, "string"] },
                            then: { $dateFromString: { dateString: "$Date" } },
                            else: "$Date"
                        }
                    }
                }
            },
            {
                $match: {
                    orderDate: { $gte: startDate, $lte: endDate },
                    PaymentStatus: { $ne: "Cancelled" }
                }
            },
            {
                $group: {
                    _id: { $dateToString: { format: "%Y-%m-%d", date: "$orderDate" } },
                    earnings: { $sum: "$Total" },
                    count: { $sum: 1 }
                }
            },
            { $sort: { _id: 1 } }
        ]
        let results = await ordersCollection.aggregate(pipeline).toArray()
        const dateMap = {}
        results.forEach(item => { dateMap[item._id] = item })
        const allDates = []
        for (let i = 0; i < days; i++) {
            const date = new Date()
            date.setDate(date.getDate() - i)
            const dateStr = date.toISOString().split('T')[0]
            allDates.unshift(dateStr)
        }
        const formattedResults = allDates.map(dateStr => {
            if (dateMap[dateStr]) {
                return {
                    date: dateStr,
                    earnings: dateMap[dateStr].earnings || 0,
                    costs: dateMap[dateStr].earnings * 0.6 || 0,
                    orders: dateMap[dateStr].count || 0
                }
            } else {
                return {
                    date: dateStr,
                    earnings: 0,
                    costs: 0,
                    orders: 0
                }
            }
        })
        await client.close()
        res.json(formattedResults)
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch sales performance data' })
    }
})

app.get('/analytics/dashboard-stats', isLoggedIn, async (req, res) => {
    try {
        const client = await MongoClient.connect(uri)
        const db = client.db('blessingscafe')
        const ordersCollection = db.collection('Orders')
        const today = new Date()
        today.setHours(0, 0, 0, 0)
        const yesterday = new Date(today)
        yesterday.setDate(yesterday.getDate() - 1)
        const weekAgo = new Date(today)
        weekAgo.setDate(weekAgo.getDate() - 7)
        const totalSalesResult = await ordersCollection.aggregate([
            {
                $match: {
                    PaymentStatus: { $ne: "Cancelled" }
                }
            },
            {
                $group: {
                    _id: null,
                    total: { $sum: "$Total" }
                }
            }
        ]).toArray()
        const totalSales = totalSalesResult.length > 0 ? totalSalesResult[0].total : 0
        const weekSalesResult = await ordersCollection.aggregate([
            {
                $addFields: {
                    orderDate: {
                        $cond: {
                            if: { $eq: [{ $type: "$Date" }, "string"] },
                            then: { $dateFromString: { dateString: "$Date" } },
                            else: "$Date"
                        }
                    }
                }
            },
            {
                $match: {
                    orderDate: { $gte: weekAgo },
                    PaymentStatus: { $ne: "Cancelled" }
                }
            },
            {
                $group: {
                    _id: null,
                    total: { $sum: "$Total" }
                }
            }
        ]).toArray()
        const totalSalesWeek = weekSalesResult.length > 0 ? weekSalesResult[0].total : 0
        const prevWeekAgo = new Date(weekAgo)
        prevWeekAgo.setDate(prevWeekAgo.getDate() - 7)
        const prevWeekSalesResult = await ordersCollection.aggregate([
            {
                $addFields: {
                    orderDate: {
                        $cond: {
                            if: { $eq: [{ $type: "$Date" }, "string"] },
                            then: { $dateFromString: { dateString: "$Date" } },
                            else: "$Date"
                        }
                    }
                }
            },
            {
                $match: {
                    orderDate: { $gte: prevWeekAgo, $lt: weekAgo },
                    PaymentStatus: { $ne: "Cancelled" }
                }
            },
            {
                $group: {
                    _id: null,
                    total: { $sum: "$Total" }
                }
            }
        ]).toArray()
        const prevWeekSales = prevWeekSalesResult.length > 0 ? prevWeekSalesResult[0].total : 0
        const totalSalesPercent = prevWeekSales === 0 ? 100 : Math.round(((totalSalesWeek - prevWeekSales) / prevWeekSales) * 100)
        const incomingOrdersCount = await ordersCollection.countDocuments({
            FulfillmentStatus: {
                $nin: ["Completed", "Cancelled"]
            }
        })
        const yesterdayIncomingResult = await ordersCollection.aggregate([
            {
                $addFields: {
                    orderDate: {
                        $cond: {
                            if: { $eq: [{ $type: "$Date" }, "string"] },
                            then: { $dateFromString: { dateString: "$Date" } },
                            else: "$Date"
                        }
                    }
                }
            },
            {
                $match: {
                    FulfillmentStatus: {
                        $nin: ["Completed", "Cancelled"]
                    },
                    orderDate: { $gte: yesterday, $lt: today }
                }
            },
            {
                $count: "count"
            }
        ]).toArray()
        const yesterdayIncomingOrdersCount = yesterdayIncomingResult.length > 0 ? yesterdayIncomingResult[0].count : 0
        const incomingOrdersPercent = yesterdayIncomingOrdersCount === 0 ? 0 : Math.round(((incomingOrdersCount - yesterdayIncomingOrdersCount) / yesterdayIncomingOrdersCount) * 100)
        const ordersTodayResult = await ordersCollection.aggregate([
            {
                $addFields: {
                    orderDate: {
                        $cond: {
                            if: { $eq: [{ $type: "$Date" }, "string"] },
                            then: { $dateFromString: { dateString: "$Date" } },
                            else: "$Date"
                        }
                    }
                }
            },
            {
                $match: {
                    orderDate: { $gte: today }
                }
            },
            {
                $count: "count"
            }
        ]).toArray()
        const ordersTodayCount = ordersTodayResult.length > 0 ? ordersTodayResult[0].count : 0
        const yesterdayOrdersResult = await ordersCollection.aggregate([
            {
                $addFields: {
                    orderDate: {
                        $cond: {
                            if: { $eq: [{ $type: "$Date" }, "string"] },
                            then: { $dateFromString: { dateString: "$Date" } },
                            else: "$Date"
                        }
                    }
                }
            },
            {
                $match: {
                    orderDate: { $gte: yesterday, $lt: today }
                }
            },
            {
                $count: "count"
            }
        ]).toArray()
        const yesterdayOrdersCount = yesterdayOrdersResult.length > 0 ? yesterdayOrdersResult[0].count : 0
        const ordersTodayPercent = yesterdayOrdersCount === 0 ? 0 : Math.round(((ordersTodayCount - yesterdayOrdersCount) / yesterdayOrdersCount) * 100)
        await client.close()
        res.json({
            totalSales,
            totalSalesWeek,
            totalSalesPercent,
            incomingOrders: incomingOrdersCount,
            incomingOrdersPercent,
            ordersToday: ordersTodayCount,
            ordersTodayPercent
        })
    } catch (err) {
        res.status(500).json({
            totalSales: 0,
            totalSalesWeek: 0,
            totalSalesPercent: 0,
            incomingOrders: 0,
            incomingOrdersPercent: 0,
            ordersToday: 0,
            ordersTodayPercent: 0
        })
    }
})

app.get('/analytics/top-categories', isLoggedIn, async (req, res) => {
    try {
        const client = await MongoClient.connect(uri)
        const db = client.db('blessingscafe')
        const ordersCollection = db.collection('Orders')
        const pipeline = [
            { $unwind: "$Cart" },
            {
                $lookup: {
                    from: "Menu",
                    localField: "Cart.ProductID",
                    foreignField: "ProductID",
                    as: "productInfo"
                }
            },
            { $unwind: { path: "$productInfo", preserveNullAndEmptyArrays: true } },
            {
                $group: {
                    _id: "$productInfo.Category",
                    value: { $sum: "$Cart.BasePrice" },
                    quantity: { $sum: "$Cart.Quantity" },
                    orders: { $addToSet: "$OrderID" }
                }
            },
            {
                $project: {
                    name: { $ifNull: ["$_id", "Other"] },
                    value: 1,
                    quantity: 1,
                    orderCount: { $size: "$orders" },
                    _id: 0
                }
            },
            { $sort: { value: -1 } },
            { $limit: 6 }
        ]
        let categories = await ordersCollection.aggregate(pipeline).toArray()
        if (categories.length === 0) {
            categories = [
                { name: "Coffee", value: 25500, quantity: 128, orderCount: 85 },
                { name: "Milktea", value: 18900, quantity: 95, orderCount: 72 },
                { name: "Fruit Tea", value: 12400, quantity: 76, orderCount: 58 },
                { name: "Pastries", value: 8200, quantity: 45, orderCount: 34 },
                { name: "Other", value: 1800, quantity: 18, orderCount: 12 }
            ]
        }
        await client.close()
        res.json(categories)
    } catch (err) {
        res.status(500).json([
            { name: "Coffee", value: 25500, quantity: 128, orderCount: 85 },
            { name: "Milktea", value: 18900, quantity: 95, orderCount: 72 },
            { name: "Fruit Tea", value: 12400, quantity: 76, orderCount: 58 },
            { name: "Pastries", value: 8200, quantity: 45, orderCount: 34 },
            { name: "Other", value: 1800, quantity: 18, orderCount: 12 }
        ])
    }
})

app.get('/analytics/export-performance', isLoggedIn, async (req, res) => {
    const days = parseInt(req.query.days) || 14
    try {
        const client = await MongoClient.connect(uri)
        const db = client.db('blessingscafe')
        const ordersCollection = db.collection('Orders')
        const endDate = new Date()
        const startDate = new Date()
        startDate.setDate(startDate.getDate() - days)
        const pipeline = [
            {
                $addFields: {
                    orderDate: {
                        $cond: {
                            if: { $eq: [{ $type: "$Date" }, "string"] },
                            then: { $dateFromString: { dateString: "$Date" } },
                            else: "$Date"
                        }
                    }
                }
            },
            {
                $match: {
                    orderDate: { $gte: startDate, $lte: endDate },
                    PaymentStatus: { $ne: "Cancelled" }
                }
            },
            {
                $group: {
                    _id: { $dateToString: { format: "%Y-%m-%d", date: "$orderDate" } },
                    earnings: { $sum: "$Total" },
                    orders: { $sum: 1 }
                }
            },
            { $sort: { _id: 1 } }
        ]
        const results = await ordersCollection.aggregate(pipeline).toArray()
        await client.close()
        const csvHeader = 'Date,Earnings,Orders\n'
        const csvData = results.map(row =>
            `${row._id},${row.earnings},${row.orders}`
        ).join('\n')
        res.setHeader('Content-Type', 'text/csv')
        res.setHeader('Content-Disposition', `attachment; filename="sales-performance-${days}days.csv"`)
        res.send(csvHeader + csvData)
    } catch (err) {
        res.status(500).send('Error exporting data')
    }
})

async function getDashboardStats() {
    const db = client.db('blessingscafe')
    const ordersCollection = db.collection('Orders')
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const yesterday = new Date(today)
    yesterday.setDate(yesterday.getDate() - 1)
    const weekAgo = new Date(today)
    weekAgo.setDate(weekAgo.getDate() - 7)
    const totalSalesResult = await ordersCollection.aggregate([
        { $match: { PaymentStatus: { $ne: "Cancelled" } } },
        { $group: { _id: null, total: { $sum: "$Total" }, count: { $sum: 1 } } }
    ]).toArray()
    const totalSales = totalSalesResult.length > 0 ? totalSalesResult[0].total : 0
    const totalOrders = totalSalesResult.length > 0 ? totalSalesResult[0].count : 0
    const weekSalesResult = await ordersCollection.aggregate([
        { $addFields: { orderDate: { $cond: { if: { $eq: [{ $type: "$Date" }, "string"] }, then: { $dateFromString: { dateString: "$Date" } }, else: "$Date" } } } },
        { $match: { orderDate: { $gte: weekAgo }, PaymentStatus: { $ne: "Cancelled" } } },
        { $group: { _id: null, total: { $sum: "$Total" } } }
    ]).toArray()
    const totalSalesWeek = weekSalesResult.length > 0 ? weekSalesResult[0].total : 0
    const prevWeekAgo = new Date(weekAgo)
    prevWeekAgo.setDate(prevWeekAgo.getDate() - 7)
    const prevWeekSalesResult = await ordersCollection.aggregate([
        { $addFields: { orderDate: { $cond: { if: { $eq: [{ $type: "$Date" }, "string"] }, then: { $dateFromString: { dateString: "$Date" } }, else: "$Date" } } } },
        { $match: { orderDate: { $gte: prevWeekAgo, $lt: weekAgo }, PaymentStatus: { $ne: "Cancelled" } } },
        { $group: { _id: null, total: { $sum: "$Total" } } }
    ]).toArray()
    const prevWeekSales = prevWeekSalesResult.length > 0 ? prevWeekSalesResult[0].total : 0
    const totalSalesPercent = prevWeekSales === 0 ? 100 : Math.round(((totalSalesWeek - prevWeekSales) / prevWeekSales) * 100)
    const incomingOrdersCount = await ordersCollection.countDocuments({ FulfillmentStatus: { $nin: ["Completed", "Cancelled"] } })
    const yesterdayIncomingResult = await ordersCollection.aggregate([
        { $addFields: { orderDate: { $cond: { if: { $eq: [{ $type: "$Date" }, "string"] }, then: { $dateFromString: { dateString: "$Date" } }, else: "$Date" } } } },
        { $match: { FulfillmentStatus: { $nin: ["Completed", "Cancelled"] }, orderDate: { $gte: yesterday, $lt: today } } },
        { $count: "count" }
    ]).toArray()
    const yesterdayIncomingOrdersCount = yesterdayIncomingResult.length > 0 ? yesterdayIncomingResult[0].count : 0
    const incomingOrdersPercent = yesterdayIncomingOrdersCount === 0 ? 0 : Math.round(((incomingOrdersCount - yesterdayIncomingOrdersCount) / yesterdayIncomingOrdersCount) * 100)
    const ordersTodayResult = await ordersCollection.aggregate([
        { $addFields: { orderDate: { $cond: { if: { $eq: [{ $type: "$Date" }, "string"] }, then: { $dateFromString: { dateString: "$Date" } }, else: "$Date" } } } },
        { $match: { orderDate: { $gte: today } } },
        { $count: "count" }
    ]).toArray()
    const ordersTodayCount = ordersTodayResult.length > 0 ? ordersTodayResult[0].count : 0
    const yesterdayOrdersResult = await ordersCollection.aggregate([
        { $addFields: { orderDate: { $cond: { if: { $eq: [{ $type: "$Date" }, "string"] }, then: { $dateFromString: { dateString: "$Date" } }, else: "$Date" } } } },
        { $match: { orderDate: { $gte: yesterday, $lt: today } } },
        { $count: "count" }
    ]).toArray()
    const yesterdayOrdersCount = yesterdayOrdersResult.length > 0 ? yesterdayOrdersResult[0].count : 0
    const ordersTodayPercent = yesterdayOrdersCount === 0 ? 0 : Math.round(((ordersTodayCount - yesterdayOrdersCount) / yesterdayOrdersCount) * 100)
    return {
        totalSales,
        totalOrders,
        totalSalesWeek,
        totalSalesPercent,
        incomingOrders: incomingOrdersCount,
        incomingOrdersPercent,
        ordersToday: ordersTodayCount,
        ordersTodayPercent
    }
}

app.listen(port, () => {
    console.log(`Server is running on http://localhost:${port}`)
})

