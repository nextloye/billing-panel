const express = require('express');
const multer = require('multer');
const sqlite3 = require('sqlite3').verbose();
const nodemailer = require('nodemailer');
const path = require('path');
const fs = require('fs');

const app = express();
app.set('view engine', 'ejs');
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));

// Ensure uploads folder exists
const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir);
app.use('/uploads', express.static(uploadDir));

// Database
const db = new sqlite3.Database('./db.sqlite');
db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS invoices(
    id INTEGER PRIMARY KEY,
    user TEXT,
    plan TEXT,
    amount INTEGER,
    screenshot TEXT,
    status TEXT
  )`);
});

// Multer storage
const upload = multer({ dest: uploadDir });

// Email setup (dummy credentials, replace with real SMTP if needed)
let transporter = nodemailer.createTransport({
  host: "smtp.gmail.com",
  port: 587,
  secure: false,
  auth: { user: "mail@zyntrixtech.xyz", pass: "dummy" }
});

// Routes

// Home
app.get('/', (req, res) => res.render('home'));

// Checkout / create invoice
app.post('/checkout', (req, res) => {
  const { user, plan, amount } = req.body;
  db.run(
    "INSERT INTO invoices(user, plan, amount, status) VALUES (?,?,?,?)",
    [user, plan, amount, "UNPAID"],
    function () {
      res.redirect('/invoice/' + this.lastID);
    }
  );
});

// Invoice page
app.get('/invoice/:id', (req, res) => {
  db.get("SELECT * FROM invoices WHERE id=?", req.params.id, (err, row) => {
    res.render('invoice', {
      invoice: row,
      upi: "8755016597@fam",
      ltc: "ltc1qyl3cvhlvyx32yunr5ltw0utkjp6mma0wsu9uhn"
    });
  });
});

// Upload screenshot
app.post('/invoice/:id/upload', upload.single('ss'), (req, res) => {
  db.run(
    "UPDATE invoices SET screenshot=?, status=? WHERE id=?",
    [req.file.filename, "PENDING", req.params.id]
  );
  res.redirect('/invoice/' + req.params.id);
});

// Admin login
app.get('/admin', (req, res) => res.render('admin_login'));
app.post('/admin', (req, res) => {
  if (
    req.body.email === "cloundown8@gmail.com" &&
    req.body.password === "nextloyed@#1billing"
  ) {
    return res.redirect('/admin/panel');
  }
  res.send("Invalid credentials");
});

// Admin panel
app.get('/admin/panel', (req, res) => {
  db.all("SELECT * FROM invoices", (err, rows) => {
    res.render('admin', { invoices: rows });
  });
});

// Approve/Reject
app.get('/admin/approve/:id', (req, res) => {
  db.run("UPDATE invoices SET status='PAID' WHERE id=?", req.params.id);
  res.redirect('/admin/panel');
});
app.get('/admin/reject/:id', (req, res) => {
  db.run("UPDATE invoices SET status='REJECTED' WHERE id=?", req.params.id);
  res.redirect('/admin/panel');
});

// Use dynamic PORT for Render
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Billing panel running on port ${PORT}`));
