const express = require('express');
const bodyParser = require('body-parser');
const ejs = require('ejs');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const bcrypt = require('bcryptjs');
const session = require('express-session');

const app = express();

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.static(path.join(__dirname, 'public')));
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(session({
    secret: 'your-secret-key',
    resave: false,
    saveUninitialized: true,
    cookie: { secure: false }
}));

const dataDir = path.join(__dirname, 'data');
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir);

const dataFiles = {
    pending: 'pending.json',
    approved: 'approved.json',
    expired: 'expired.json',
    admin: 'admin.json'
};

for (const [key, file] of Object.entries(dataFiles)) {
    const filePath = path.join(dataDir, file);
    if (!fs.existsSync(filePath)) fs.writeFileSync(filePath, JSON.stringify([]));
    if (key === 'admin' && JSON.parse(fs.readFileSync(filePath, 'utf8')).length === 0) {
        fs.writeFileSync(filePath, JSON.stringify([{
            username: 'admin',
            password: bcrypt.hashSync('admin1qq', 8)
        }]));
    }
}

function readData(file) {
    return JSON.parse(fs.readFileSync(path.join(dataDir, dataFiles[file]), 'utf8'));
}

function writeData(file, data) {
    fs.writeFileSync(path.join(dataDir, dataFiles[file]), JSON.stringify(data, null, 2));
}

const checkExpired = () => {
    const approved = readData('approved');
    const expired = readData('expired');
    const now = new Date();

    const [stillApproved, newlyExpired] = approved.reduce(([keep, expire], user) => {
        const expiryDate = new Date(user.approvedDate);
        expiryDate.setDate(expiryDate.getDate() + 30);
        return now <= expiryDate 
            ? [[...keep, user], expire]
            : [keep, [...expire, {...user, expiredDate: now.toISOString()}]];
    }, [[], []]);

    writeData('approved', stillApproved);
    writeData('expired', [...expired, ...newlyExpired]);
};

setInterval(checkExpired, 5 * 60 * 1000);

const isAuthenticated = (req, res, next) => {
    req.session.isAuthenticated ? next() : res.redirect('/login');
};

app.get('/', (req, res) => res.render('index'));

app.post('/submit', (req, res) => {
    const { name, uid, contact, transactionId } = req.body;

    if (!name || typeof name !== 'string' || name.trim() === '') {
        return res.status(400).json({ error: 'Name must be a non-empty string' });
    }

    if (!uid || typeof uid !== 'string' || !/^[0-9]+$/.test(uid)) {
        return res.status(400).json({ error: 'UID must contain only numbers' });
    }

    const pending = readData('pending');
    const approved = readData('approved');

    if (pending.some(u => u.uid === uid || u.transactionId === transactionId)) {
        return res.status(400).json({ error: 'UID or Transaction ID already exists' });
    }

    const existingApproved = approved.find(u => u.uid === uid);
    const newSubmission = {
        id: uuidv4(),
        name: name.trim(),
        uid,
        contact,
        transactionId,
        submittedAt: new Date().toISOString(),
        isRenewal: !!existingApproved
    };

    pending.push(newSubmission);
    writeData('pending', pending);
    res.json({ success: true, message: existingApproved ? 'Renewal submitted' : 'Submission successful' });
});

app.post('/admin/extend-time', isAuthenticated, (req, res) => {
    const { days, hours } = req.body;
    const pending = readData('pending');
    const updated = pending.map(user => ({
        ...user,
        extendDays: (user.extendDays || 0) + (parseInt(days) || 0),
        extendHours: (user.extendHours || 0) + (parseInt(hours) || 0)
    }));
    writeData('pending', updated);
    res.json({ success: true });
});

app.post('/admin/approve/:id', isAuthenticated, (req, res) => {
    const pending = readData('pending');
    const approved = readData('approved');
    const userIndex = pending.findIndex(u => u.id === req.params.id);
    
    if (userIndex === -1) return res.status(404).json({ error: 'User not found' });

    const user = pending[userIndex];
    const now = new Date();
    let expiryDate = new Date(now);
    
    if (user.isRenewal) {
        const existingUser = approved.find(u => u.uid === user.uid);
        if (existingUser) {
            expiryDate = new Date(existingUser.expiryDate);
        }
    }
    expiryDate.setDate(expiryDate.getDate() + 30 + (user.extendDays || 0));
    expiryDate.setHours(expiryDate.getHours() + (user.extendHours || 0));

    if (user.isRenewal) {
        const existingIndex = approved.findIndex(u => u.uid === user.uid);
        if (existingIndex !== -1) {
            approved.splice(existingIndex, 1);
        }
    }

    approved.push({
        ...user,
        approvedDate: now.toISOString(),
        expiryDate: expiryDate.toISOString(),
        approvedBy: req.session.admin
    });

    pending.splice(userIndex, 1);
    writeData('approved', approved);
    writeData('pending', pending);
    res.json({ success: true });
});

app.get('/raw/approvedlist.txt', (req, res) => {
    res.json(readData('approved').map(({ name, uid }) => ({ name, uid })));
});

app.get('/login', (req, res) => res.render('login'));

app.post('/login', (req, res) => {
    const { username, password } = req.body;
    const admins = readData('admin');
    const admin = admins.find(a => a.username === username);
    if (!admin || !bcrypt.compareSync(password, admin.password)) {
        return res.status(401).json({ error: 'Invalid credentials' });
    }
    req.session.isAuthenticated = true;
    req.session.admin = username;
    res.json({ success: true });
});

app.get('/logout', (req, res) => {
    req.session.destroy();
    res.redirect('/login');
});

app.get('/admin', isAuthenticated, (req, res) => {
    checkExpired();
    const pending = readData('pending');
    const approved = readData('approved');
    const expired = readData('expired');
    res.render('admin', { 
        pending, 
        approved, 
        expired,
        admin: req.session.admin 
    });
});

app.post('/admin/deny/:id', isAuthenticated, (req, res) => {
    const pending = readData('pending');
    const userIndex = pending.findIndex(u => u.id === req.params.id);
    if (userIndex === -1) return res.status(404).json({ error: 'User not found' });
    pending.splice(userIndex, 1);
    writeData('pending', pending);
    res.json({ success: true });
});

const PORT = process.env.PORT || 6242;
app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
