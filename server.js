const express = require('express');
const multer = require('multer');
const sqlite3 = require('sqlite3').verbose();
const nodemailer = require('nodemailer');
const path = require('path');
const fs = require('fs');
const session = require('express-session');
const bcrypt = require('bcrypt');

const app = express();
app.set('view engine', 'ejs');
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));

// Session
app.use(session({
  secret: 'zyntrix-secret-key',
  resave: false,
  saveUninitialized: false
}));

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
  db.run(`CREATE TABLE IF NOT EXISTS users(
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE,
    email TEXT UNIQUE,
    password TEXT
  )`);
});

// Multer storage
const upload = multer({ dest: uploadDir });

// Email setup (dummy credentials)
let transporter = nodemailer.createTransport({
  host: "smtp.gmail.com",
  port: 587,
  secure: false,
  auth: { user: "mail@zyntrixtech.xyz", pass: "dummy" }
});

// Middleware to expose userId to templates
app.use((req,res,next)=>{
  res.locals.userId = req.session.userId;
  next();
});

// Routes

// Home
app.get('/', (req,res)=>res.render('home'));

// Sign Up
app.get('/signup', (req,res)=>res.render('signup'));
app.post('/signup', async (req,res)=>{
  const {username,email,password} = req.body;
  const hash = await bcrypt.hash(password,10);
  db.run("INSERT INTO users(username,email,password) VALUES(?,?,?)",[username,email,hash],function(err){
    if(err) return res.send("Error: User/email may already exist.");
    req.session.userId = this.lastID;
    res.redirect('/');
  });
});

// Sign In
app.get('/signin', (req,res)=>res.render('signin'));
app.post('/signin',(req,res)=>{
  const {email,password} = req.body;
  db.get("SELECT * FROM users WHERE email=?",[email],async (err,user)=>{
    if(!user) return res.send("User not found.");
    const match = await bcrypt.compare(password,user.password);
    if(match){
      req.session.userId = user.id;
      res.redirect('/');
    } else {
      res.send("Incorrect password.");
    }
  });
});

// Logout
app.get('/logout',(req,res)=>{
  req.session.destroy();
  res.redirect('/');
});

// Checkout / Invoices
app.post('/checkout',(req,res)=>{
  if(!req.session.userId) return res.redirect('/signin');
  const {plan,amount} = req.body;
  db.get("SELECT username FROM users WHERE id=?",[req.session.userId],(err,row)=>{
    db.run("INSERT INTO invoices(user,plan,amount,status) VALUES(?,?,?,?)",[row.username,plan,amount,"UNPAID"],function(){
      res.redirect('/invoice/'+this.lastID);
    });
  });
});

// Invoice page
app.get('/invoice/:id',(req,res)=>{
  db.get("SELECT * FROM invoices WHERE id=?",[req.params.id],(err,row)=>{
    res.render('invoice',{
      invoice: row,
      upi: "8755016597@fam",
      ltc: "ltc1qyl3cvhlvyx32yunr5ltw0utkjp6mma0wsu9uhn"
    });
  });
});

// Upload screenshot
app.post('/invoice/:id/upload', upload.single('ss'),(req,res)=>{
  db.run("UPDATE invoices SET screenshot=?, status=? WHERE id=?",[req.file.filename,"PENDING",req.params.id]);
  res.redirect('/invoice/'+req.params.id);
});

// Admin
app.get('/admin', (req,res)=>{
  db.all("SELECT * FROM invoices",(err,rows)=>res.render('admin',{invoices:rows}));
});

// Approve/Reject
app.get('/admin/approve/:id',(req,res)=>{
  db.run("UPDATE invoices SET status='PAID' WHERE id=?",[req.params.id]);
  res.redirect('/admin');
});
app.get('/admin/reject/:id',(req,res)=>{
  db.run("UPDATE invoices SET status='REJECTED' WHERE id=?",[req.params.id]);
  res.redirect('/admin');
});

const PORT = process.env.PORT || 3000;
app.listen(PORT,()=>console.log(`Billing panel running on port ${PORT}`));
