const express = require("express");
const passport = require('passport');
const fetch = require('node-fetch');
const qs = require("querystring");
const auth = require('../auth.json');

const createHandler = require("azure-function-express").createHandler;

const BearerStrategy = require("passport-azure-ad").BearerStrategy;

const options = {
    identityMetadata: `https://${auth.authority}/${auth.tenantID}/${auth.version}/${auth.discovery}`,
    issuer: `https://${auth.authority}/${auth.tenantID}/${auth.version}`,
    clientID: auth.clientID,
    validateIssuer: auth.validateIssuer,
    audience: auth.audience,
    loggingLevel: auth.loggingLevel,
    passReqToCallback: auth.passReqToCallback,
};

const bearerStrategy = new BearerStrategy(options, function (token, done) {
    done(null, {}, token);
});

const app = express();

app.use(require('morgan')('combined'));
app.use(require('body-parser').urlencoded({ "extended": true }));
app.use(passport.initialize());
passport.use(bearerStrategy);

// Enable CORS (for local testing only -remove in production/deployment)
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Headers', 'Authorization, Origin, X-Requested-With, Content-Type, Accept');
    next();
});

// This is where your API methods are exposed
app.get("/api", passport.authenticate("oauth-bearer", { session: false }),
    async (req, res) => {
        console.log("Validated claims: ", JSON.stringify(req.authInfo));

        // the access token the user sent
        const userToken = req.get("authorization");

        // request new token and use it to call resource API on user's behalf
        let tokenObj = await getNewAccessToken(userToken);
        let apiResponse = await callResourceAPI(tokenObj['access_token'], auth.resourceUri)
        res.status(200).json(apiResponse);
    }
);

async function getNewAccessToken(userToken, callback) {

    // is in form "Bearer XYZ..."
    const [bearer, tokenValue] = userToken.split(" ");

    let payload = qs.stringify({
        grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
        client_id: auth.clientID,
        client_secret: auth.clientSecret,
        scope: auth.resourceScope,
        assertion: tokenValue,
        requested_token_use: 'on_behalf_of'
    });

    let options = {
        method: "POST",
        host: "login.microsoftonline.com",
        path: `/${auth.tenantName}/oauth2/v2.0/token`,
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

// async function getNewAccessToken(userToken) {

//     // is in form "Bearer XYZ..."
//     const [bearer, tokenValue] = userToken.split(" ");

//     let payload = qs.stringify({
//         grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
//         client_id: auth.clientID,
//         client_secret: auth.clientSecret,
//         scope: auth.resourceScope,
//         assertion: tokenValue,
//         requested_token_use: 'on_behalf_of'
//     });

//     let options = {
//         method: "POST",
//         headers: {
//             "Accept": "*/*",
//             "Cache-control": "no-cache",
//             "Content-Type": "application/x-www-form-urlencoded",
//             "Content-Length": Buffer.byteLength(payload)
//         }
//     };

//     let response = await fetch(`https://login.microsoftonline.com/${auth.tenantName}/oauth2/v2.0/token`, options);

// 	let json = await response.json();
    
//     return json;
// }

async function callResourceAPI(newTokenValue, resourceURI) {
  
    let options = {
        method: "GET",
        headers: {
            "Authorization": `Bearer ${newTokenValue}`,
            "Content-type": "application/json",
            "Accept": "application/json",
            "Accept-Charset": "utf-8"
        },
    };
    
    let response = await fetch(resourceURI, options);
	let json = await response.json();
    return json;
}

module.exports = createHandler(app);
