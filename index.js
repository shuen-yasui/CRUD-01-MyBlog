require('dotenv').config();
const express = require('express');
const path = require('path');
const cors = require('cors');
const bodyParser = require('body-parser');
const session = require('express-session');
const Sequelize = require('sequelize');
const epilogue = require('epilogue'), ForbiddenError = epilogue.Errors.ForbiddenError;
const { ExpressOIDC } = require('@okta/oidc-middleware');

const app = express();
const port = 3000;
// session support is required to use ExpressOIDC
const oidc = new ExpressOIDC({
    issuer: process.env.OKTA_ORG_URL,
    client_id: process.env.OKTA_CLIENT_ID,
    client_secret: process.env.OKTA_CLIENT_SECRET,
    redirect_uri: process.env.REDIRECT_URL,
    appBaseUrl: 'http://localhost:3000',
    scope: 'openid profile',
    routes: {
        callback: {
            path: '/authorization-code/callback',
            defaultRedirect: '/admin'
        }
    }
});

app.use(session({
    secret: process.env.RANDOM_SECRET_WORD,
    resave: true,
    saveUninitialized: false
}));

// ExpressOIDC will attach handlers for the /login and /authorization-code/callback routes
app.use(oidc.router);
app.use(cors());
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'public')));

app.get('/', (req, res) => {
  if (req.isAuthenticated()) {
    res.redirect('/admin');
  } else {
    res.redirect('/home');
  }
});

app.get('/home', (req, res) => {
   res.sendFile(path.join(__dirname, './public/home.html'));
});

app.get('/admin', oidc.ensureAuthenticated(), (req, res) => {
   res.sendFile(path.join(__dirname, './public/admin.html'));
});

app.get('/logout', (req, res) => {
  req.logout();
  res.redirect('/home');
});

const database = new Sequelize({
    dialect: 'sqlite',
    storage: './db.sqlite'
});

const Post = database.define('posts', {
    title: Sequelize.STRING,
    content: Sequelize.TEXT
});

epilogue.initialize({
  app: app,
  sequelize: database
});

const PostResource = epilogue.resource({
    model: Post,
    endpoints: ['/posts', '/posts/:id']
});

PostResource.all.auth(function (req, res, context) {
    return new Promise(function (resolve, reject) {
        if (!req.isAuthenticated()) {
            res.status(401).send({ message: "Unauthorized" });
            resolve(context.stop);
        } else {
            resolve(context.continue);
        }
    });
});

database.sync().then(() => {
    oidc.on('ready', () => {
        app.listen(port, () => console.log(`My Blog App listening on port ${port}!`))
    });
});

oidc.on('error', err => {
    // An error occurred while setting up OIDC
    console.log("oidc error: ", err);
});
