const createHandler = require("azure-function-express").createHandler;
const express = require("express");
const passport = require('passport');
const https = require("https");
const http = require("http"); // for localhost testing
const qs = require("querystring");

var BearerStrategy = require("passport-azure-ad").BearerStrategy;

var tenantID = "<tenantid>";
var clientID = "<appid>";
var appIdURI = "https://middleapi.<tenantname>.onmicrosoft.com";

var tenantName = "<tenantname>";
var clientSecret = "p@ssword1"; // This is okay only because it's a demo :)
var resourceScope = "https://secureapi.<tenantname>.onmicrosoft.com/user_impersonation"; // Scope for the next API (i.e. "<resource-api-appIdURI>/openid")
var resourceHost = "localhost"; // Hostname for next API (i.e. "localhost", "app-name.onmicrosoft.com", etc.) 
var resourcePort = "7072"; // For localhost testing

var options = {
    identityMetadata: `https://login.microsoftonline.com/${tenantID}/v2.0/.well-known/openid-configuration`,
    clientID: clientID,
    issuer: `https://sts.windows.net/${tenantID}/`,
    audience: appIdURI,
    loggingLevel: "info",
    passReqToCallback: false
};

var bearerStrategy = new BearerStrategy(options, function (token, done) {
    done(null, {}, token);
});

const app = express();

app.use(require('morgan')('combined'));
app.use(require('body-parser').urlencoded({ "extended": true }));
app.use(passport.initialize());
passport.use(bearerStrategy);

// This is where your API methods are exposed
app.get(
    "/api",
    passport.authenticate("oauth-bearer", { session: false }),
    function (req, res) {
        console.log("Validated claims: ", JSON.stringify(req.authInfo));

        // the access token the user sent
        const userToken = req.get("authorization");

        // request new token and use it to call resource API on user's behalf
        getNewAccessToken(userToken, newTokenRes => {
            let tokenObj = JSON.parse(newTokenRes);
            callResourceAPI(tokenObj['access_token'], (apiResponse) => {
                res.status(200).json(JSON.parse(apiResponse));
            });
        });

    }
);

function getNewAccessToken(userToken, callback) {
    // is in form "Bearer XYZ..."
    const [bearer, tokenValue] = userToken.split(" ");

    let payload = qs.stringify({
        grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
        client_id: clientID,
        client_secret: clientSecret,
        scope: resourceScope,
        assertion: tokenValue,
        requested_token_use: 'on_behalf_of'
    });

    let options = {
        method: "POST",
        host: "login.microsoftonline.com",
        path: `/${tenantName}.onmicrosoft.com/oauth2/v2.0/token`,
        port: "443",
        headers: {
            "Accept": "*/*",
            "Cache-control": "no-cache",
            "Content-Type": "application/x-www-form-urlencoded",
            "Content-Length": Buffer.byteLength(payload)
        }
    };

    let req = https.request(options, res => {
        let data = '';
        res.on("data", chunk => {
            data += chunk;
        });
        res.on("end", () => {
            callback(data);
        });
        res.on("error", err => {
            console.log(`ERROR ${res.statusCode}: ${err}`);
        })
    });

    req.write(payload);
    req.end();
}

function callResourceAPI(newTokenValue, callback) {
    let options = {
        host: resourceHost,
        port: resourcePort,
        path: "/api",
        headers: {
            "Authorization": `Bearer ${newTokenValue}`
        }
    };

    http.get(options, res => {
        let data = '';
        res.on("data", chunk => {
            data += chunk;
        });
        res.on("end", () => {
            callback(data);
        })
    });
}

module.exports = createHandler(app);
