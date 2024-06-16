const express = require('express');
const ejs = require('ejs');
const path = require('path');
const app = express();
const bodyParser = require('body-parser');
const mongoose = require('mongoose');
const session = require('express-session');
const MongoStore = require('connect-mongo')(session);
const csrf = require('csurf');

// MongoDB URI and connection
const MongoDBURI = process.env.MONGO_URI || 'mongodb+srv://omer:omer@omer.frlbk3e.mongodb.net/?retryWrites=true&w=majority&appName=omer';

mongoose.connect(MongoDBURI, {
  useUnifiedTopology: true,
  useNewUrlParser: true
});

const db = mongoose.connection;
db.on('error', console.error.bind(console, 'connection error:'));
db.once('open', () => {
  console.log('Connected to MongoDB');
});

// Session configuration
app.use(session({
  secret: 'work hard',
  resave: true,
  saveUninitialized: false,
  store: new MongoStore({
    mongooseConnection: db
  })
}));

// Body parser middleware
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));

// CSRF protection middleware
const csrfProtection = csrf();
app.use(csrfProtection);

// Serve static files
app.use(express.static(__dirname + '/views'));

// Set views engine
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');

// Middleware to pass CSRF token to all views
app.use((req, res, next) => {
  res.locals.csrfToken = req.csrfToken();
  next();
});

// Routes
const index = require('./routes/index');
app.use('/', index);

// Catch 404 and forward to error handler
app.use((req, res, next) => {
  const err = new Error('File Not Found');
  err.status = 404;
  next(err);
});

// Error handler
app.use((err, req, res, next) => {
  res.status(err.status || 500);
  res.send(err.message);
});

// Start the server
app.listen(process.env.PORT || 3000, () => {
  console.log('Express app listening on port 3000');
});
