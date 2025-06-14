// Server.js - Main backend file for the Auto-Dialer Application (Complete Version)

// --- Dependencies ---
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const bodyParser = require('body-parser');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
// Using require for node-fetch v2 which is compatible with CommonJS
const fetch = require('node-fetch');

// --- Basic Setup ---
const app = express();
// The App Platform sets the PORT environment variable.
const PORT = process.env.PORT || 8080; 
const JWT_SECRET = process.env.JWT_SECRET;
const CALL_COST = 0.05; 

// --- Google Perspective API Configuration ---
const PERSPECTIVE_API_KEY = process.env.PERSPECTIVE_API_KEY; 
const PERSPECTIVE_API_URL = `https://commentanalyzer.googleapis.com/v1alpha1/comments:analyze?key=${PERSPECTIVE_API_KEY}`;
const SPAM_THRESHOLD = 0.8; 

// --- Middleware ---
const corsOptions = {
  origin: '*', // For production, you might want to restrict this to your frontend's domain.
  methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
  allowedHeaders: ['Content-Type', 'Authorization', 'x-auth-token']
};
app.use(cors(corsOptions));
app.use(bodyParser.json());

// --- Health Check Endpoint ---
app.get('/healthz', (req, res) => {
    res.status(200).send('OK');
});

// --- MongoDB Connection ---
const MONGO_URI = process.env.MONGO_URI;
if (!MONGO_URI || !JWT_SECRET) {
    console.error('FATAL ERROR: MONGO_URI or JWT_SECRET is not defined. Please set environment variables.');
    process.exit(1);
}

const mongooseOptions = {
    useNewUrlParser: true,
    useUnifiedTopology: true,
    useFindAndModify: false,
    useCreateIndex: true,
    serverSelectionTimeoutMS: 30000 
};

// --- Database Schemas & Models ---
const User = mongoose.model('User', new mongoose.Schema({
    username: { type: String, required: true, unique: true, trim: true },
    password: { type: String, required: true },
    role: { type: String, enum: ['user', 'admin'], default: 'user' },
    balance: { type: Number, default: 0.0 },
    createdAt: { type: Date, default: Date.now }
}));

const contactSchema = new mongoose.Schema({
    name: { type: String, required: true },
    phoneNumber: { type: String, required: true },
    status: { type: String, enum: ['new', 'called', 'answered', 'unanswered'], default: 'new' },
    callNotes: { type: String, default: '' },
    campaign: { type: mongoose.Schema.Types.ObjectId, ref: 'Campaign' }
});
contactSchema.index({ phoneNumber: 1, campaign: 1 }, { unique: true });
const Contact = mongoose.model('Contact', contactSchema);

const campaignSchema = new mongoose.Schema({
    name: { type: String, required: true },
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    fromNumber: { type: String, required: true },
    ttsMessage: { type: String, required: true },
    callsPerMinute: { type: Number, default: 5, min: 1, max: 100 },
    batchDelaySeconds: { type: Number, default: 60, min: 0 },
    customBlocklist: { type: [String], default: [] },
    isActive: { type: Boolean, default: false },
    contacts: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Contact' }],
    createdAt: { type: Date, default: Date.now },
    lastBatchFetchTime: { type: Date }
});
const Campaign = mongoose.model('Campaign', campaignSchema);

const systemSettingsSchema = new mongoose.Schema({
    singletonKey: { type: String, default: 'main', unique: true, required: true }, 
    fromNumberBlocklist: { type: [String], default: [] }
});
const SystemSettings = mongoose.model('SystemSettings', systemSettingsSchema);

// --- API Router ---
const apiRouter = express.Router();

// --- Helper Functions & Middleware ---
async function isTextFlagged(text, customBlocklist = []) {
    if (PERSPECTIVE_API_KEY && PERSPECTIVE_API_KEY !== 'YOUR_GOOGLE_PERSPECTIVE_API_KEY') {
        try {
            const response = await fetch(PERSPECTIVE_API_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ comment: { text }, languages: ['en'], requestedAttributes: { SPAM: {}, TOXICITY: {}, THREAT: {} } })
            });
            if (response.ok) {
                const data = await response.json(); const scores = data.attributeScores;
                if (scores.SPAM.summaryScore.value > SPAM_THRESHOLD || scores.TOXICITY.summaryScore.value > SPAM_THRESHOLD || scores.THREAT.summaryScore.value > SPAM_THRESHOLD) return true;
            }
        } catch (error) { console.error("Error connecting to Perspective API:", error); }
    }
    const lowerCaseText = text.toLowerCase();
    for (const blockedWord of customBlocklist) {
        const regex = new RegExp(`\\b${blockedWord.trim()}\\b`, 'i');
        if (regex.test(lowerCaseText)) return true;
    }
    return false;
}
const authMiddleware = (req, res, next) => {
    const token = req.header('x-auth-token');
    if (!token) return res.status(401).json({ message: 'No token, authorization denied.' });
    try { req.user = jwt.verify(token, JWT_SECRET).user; next(); } catch (e) { res.status(400).json({ message: 'Token is not valid.' }); }
};
const adminMiddleware = async (req, res, next) => {
    try {
        const user = await User.findById(req.user.id);
        if (user.role !== 'admin') { return res.status(403).json({ message: 'Access denied. Admin role required.' }); }
        next();
    } catch (e) { res.status(500).send({ message: 'Server error.' }); }
};

// --- API Endpoints (attached to apiRouter) ---
apiRouter.post('/auth/register', async (req, res) => {
    try {
        const { username, password, role } = req.body;
        if (await User.findOne({ username })) return res.status(400).json({ message: 'User already exists.' });
        const user = new User({ username, password, role }); user.password = await bcrypt.hash(password, await bcrypt.genSalt(10)); await user.save();
        const payload = { user: { id: user.id } };
        jwt.sign(payload, JWT_SECRET, { expiresIn: 3600 }, (err, token) => { if (err) throw err; res.json({ token }); });
    } catch (err) { res.status(500).send('Server error'); }
});
apiRouter.post('/auth/login', async (req, res) => {
    try {
        const { username, password } = req.body;
        const user = await User.findOne({ username });
        if (!user || !(await bcrypt.compare(password, user.password))) return res.status(400).json({ message: 'Invalid credentials.' });
        const payload = { user: { id: user.id } };
        jwt.sign(payload, JWT_SECRET, { expiresIn: 3600 }, (err, token) => { if (err) throw err; res.json({ token }); });
    } catch (err) { res.status(500).send('Server error'); }
});
apiRouter.get('/admin/overview', [authMiddleware, adminMiddleware], async (req, res) => {
    try {
        const [totalUsers, totalCampaigns, totalCallsMade] = await Promise.all([User.countDocuments(), Campaign.countDocuments(), Contact.countDocuments({ status: { $ne: 'new' } })]);
        res.json({ totalUsers, totalCampaigns, totalCallsMade });
    } catch (err) { res.status(500).send('Server Error'); }
});
apiRouter.get('/admin/users', [authMiddleware, adminMiddleware], async (req, res) => {
    try {
        const page = parseInt(req.query.page, 10) || 1; const limit = parseInt(req.query.limit, 10) || 5; const skip = (page - 1) * limit;
        const totalUsers = await User.countDocuments(); const users = await User.find().select('-password').sort({ createdAt: -1 }).skip(skip).limit(limit);
        res.json({ users, totalPages: Math.ceil(totalUsers / limit), currentPage: page });
    } catch (err) { res.status(500).send('Server error'); }
});
apiRouter.post('/admin/users/:userId/add-balance', [authMiddleware, adminMiddleware], async (req, res) => {
    try {
        const { amount } = req.body;
        if (typeof amount !== 'number' || amount <= 0) return res.status(400).json({ message: 'Invalid amount.' });
        const user = await User.findByIdAndUpdate(req.params.userId, { $inc: { balance: amount } }, { new: true }).select('-password');
        if (!user) return res.status(404).json({ message: 'User not found.' }); res.json(user);
    } catch (err) { res.status(500).send('Server error'); }
});
apiRouter.get('/admin/settings/blocklist', [authMiddleware, adminMiddleware], async (req, res) => {
    const settings = await SystemSettings.findOne({ singletonKey: 'main' }); res.json(settings.fromNumberBlocklist || []);
});
apiRouter.post('/admin/settings/blocklist', [authMiddleware, adminMiddleware], async (req, res) => {
    const numbersToAdd = req.body.numbers ? req.body.numbers.split(',').map(n => n.trim()).filter(n => n) : [];
    const settings = await SystemSettings.findOneAndUpdate({ singletonKey: 'main' }, { $addToSet: { fromNumberBlocklist: { $each: numbersToAdd } } }, { new: true, upsert: true });
    res.json(settings.fromNumberBlocklist);
});
apiRouter.delete('/admin/settings/blocklist', [authMiddleware, adminMiddleware], async (req, res) => {
    const { numberToRemove } = req.body;
    const settings = await SystemSettings.findOneAndUpdate({ singletonKey: 'main' }, { $pull: { fromNumberBlocklist: numberToRemove } }, { new: true });
    res.json(settings.fromNumberBlocklist);
});
apiRouter.post('/campaigns', authMiddleware, async (req, res) => {
    try {
        const { name, fromNumber, ttsMessage, contactsData, customBlocklist } = req.body;
        const blocklistArray = customBlocklist ? customBlocklist.split(',').map(w => w.trim().toLowerCase()).filter(Boolean) : [];
        if (await isTextFlagged(ttsMessage, blocklistArray)) return res.status(400).json({ message: 'Message content flagged.' });
        const settings = await SystemSettings.findOne({ singletonKey: 'main' });
        if (settings && settings.fromNumberBlocklist.includes(fromNumber)) return res.status(403).json({ message: `This From Number is blocked.` });
        const campaign = new Campaign({ ...req.body, customBlocklist: blocklistArray, user: req.user.id }); await campaign.save();
        const contactsToInsert = contactsData.map(c => ({ ...c, campaign: campaign._id })); const contacts = await Contact.insertMany(contactsToInsert, { ordered: false });
        campaign.contacts = contacts.map(c => c._id); await campaign.save(); res.status(201).json(campaign);
    } catch (error) { res.status(error.code === 11000 ? 409 : 500).json({ message: 'Error creating campaign.' }); }
});
apiRouter.get('/campaigns', authMiddleware, async (req, res) => { const campaigns = await Campaign.find({ user: req.user.id }).populate('contacts'); res.json(campaigns); });
apiRouter.get('/campaigns/:id/next-contacts/:count', authMiddleware, async (req, res) => {
    try {
        const user = await User.findById(req.user.id);
        const batchSize = parseInt(req.params.count, 10) || 5;
        const requiredBalance = CALL_COST * batchSize;
        if (user.balance < requiredBalance) { await Campaign.findByIdAndUpdate(req.params.id, { isActive: false }); return res.status(402).json({ message: `Insufficient balance. Campaign paused.` }); }
        const campaign = await Campaign.findOne({ _id: req.params.id, user: req.user.id });
        if (!campaign || !campaign.isActive) return res.status(404).json({ message: 'Campaign not found or is inactive.' });
        user.balance -= requiredBalance; await user.save();
        const contacts = await Contact.find({ campaign: req.params.id, status: 'new' }).limit(batchSize);
        if (contacts.length === 0) return res.status(404).json({ message: 'No new contacts to call.' });
        campaign.lastBatchFetchTime = new Date(); await campaign.save(); res.json({ contacts, newBalance: user.balance });
    } catch (error) { res.status(500).json({ message: 'Error fetching contacts.' }); }
});

// **FIX**: Mount the main API router synchronously before starting async operations.
app.use('/api', apiRouter);

// --- Application Startup ---
const startServer = async () => {
    // Start listening immediately for health checks
    const server = app.listen(PORT, '0.0.0.0', () => {
        console.log(`Backend server process started and listening on port ${PORT}`);
    });

    try {
        // Now, connect to the database
        await mongoose.connect(MONGO_URI, mongooseOptions);
        console.log('Successfully connected to MongoDB.');

        // Initialize any post-connection settings
        const settings = await SystemSettings.findOne({ singletonKey: 'main' });
        if (!settings) {
            console.log('Initializing system settings...');
            await new SystemSettings().save();
        }
        
        console.log('Application is ready to accept API requests.');

    } catch (err) {
        console.error('Failed to connect to database or initialize settings:', err);
        // If DB connection fails, shut down the server gracefully.
        server.close(() => {
            process.exit(1);
        });
    }
};

startServer();
