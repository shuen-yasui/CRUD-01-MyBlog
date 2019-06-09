require('dotenv').config();
const express = require('express');
const path = require('path');
const cors = require('cors');
const bodyParser = require('body-parser');
const session = require('express-session');
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

app.get('/', (req, res) => {
  if (req.userContext.userinfo) {
    res.send(`Hi ${req.userContext.userinfo.name}!`);
  } else {
    res.redirect('/home');
  }
});

app.get('/home', (req, res) => {
 res.send('<h1>Welcome!!</div><a href="/login">Login</a>');
});

app.get('/admin', oidc.ensureAuthenticated(), (req, res) =>{
  res.send('Admin page');
})

app.get('/logout', (req, res) => {
  req.logout();
  res.redirect('/home');
});

app.listen(port, () => console.log(`My Blog App listening on port ${port}!`))
