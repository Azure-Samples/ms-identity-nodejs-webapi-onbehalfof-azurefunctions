const createHandler = require("azure-function-express").createHandler;
const express = require("express");
const passport = require('passport');

var BearerStrategy = require("passport-azure-ad").BearerStrategy;

var tenantID = "<tenantid>";
var clientID = "<appid>";
var appIdURI = "https://secureapi.<tenantname>.onmicrosoft.com";

var options = {
    identityMetadata: "https://login.microsoftonline.com/" + tenantID + "/v2.0/.well-known/openid-configuration",
    clientID: clientID,
    issuer: "https://sts.windows.net/" + tenantID + "/",
    audience: appIdURI,
    loggingLevel: "info",
    passReqToCallback: false
};

var bearerStrategy = new BearerStrategy(options, function (token, done) {
    done(null, {}, token);
});

const app = express();

app.use(require('morgan')('combined'));
app.use(require('body-parser').urlencoded({ extended: true }));
app.use(passport.initialize());
passport.use(bearerStrategy);

// Enable CORS for * because this is a demo project
app.use(function (req, res, next) {
    res.header("Access-Control-Allow-Origin", "*");
    res.header(
        "Access-Control-Allow-Headers",
        "Authorization, Origin, X-Requested-With, Content-Type, Accept"
    );
    next();
});

// This is where your API methods are exposed
app.get(
    "/api",
    passport.authenticate("oauth-bearer", { session: false }),
    function (req, res) {
        var claims = req.authInfo;
        console.log("User info: ", req.user);
        console.log("Validated claims: ", claims);
        res.status(200).json({ name: claims["name"] });
    }
);

module.exports = createHandler(app);
