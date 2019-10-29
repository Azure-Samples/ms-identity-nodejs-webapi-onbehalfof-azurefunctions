---
page_type: sample
languages:
- javascript
products:
- nodejs
- azure
- azure-active-directory
name: NodeJS Azure Function Web API secured by Azure AD, calling another API using On Behalf Of Flow
urlFragment: "ms-identity-nodejs-webapi-azurefunctions"
---

# NodeJS Azure Function Web API secured by Azure AD, calling another API using On Behalf Of Flow

This code example demonstrates how to secure an Azure function with Azure AD when the function uses HTTPTrigger and exposes a Web API. The Web API is written using expressjs, and the authentication is provided by passport-azure-ad.

This readme walks you through the steps of setting this code up in your Azure subscription.

While you can develop Azure functions in many ways, such as Visual Studio 2019, Visual Studio Code, etc. this guide shows how to perform the steps using Visual Studio Code.

## Contents

Outline the file contents of the repository. It helps users navigate the codebase, build configuration and any related assets.

| File/folder       | Description                                |
|-------------------|--------------------------------------------|
| `src`             | Sample source code.                        |
| `.gitignore`      | Define what to ignore at commit time.      |
| `CHANGELOG.md`    | List of changes to the sample.             |
| `CONTRIBUTING.md` | Guidelines for contributing to the sample. |
| `README.md`       | This README file.                          |
| `LICENSE`         | The license for the sample.                |
| `images`          | Images used in readme.md.                  |
| `SecureAPI`       | The target azure function.                 |
| `MiddleTierAPI`   | The azure function that does on-behalf-of. |

## Prerequisites
1. You must have Visual Studio Code installed
2. You must have Azure Functions core tools installed `npm install -g azure-functions-core-tools`
3. Azure functions VSCode extension (https://marketplace.visualstudio.com/items?itemName=ms-azuretools.vscode-azurefunctions)

## Register two AAD Apps

Reference: [How to register an app](https://docs.microsoft.com/en-nz/azure/active-directory/develop/quickstart-register-app)

You will need to register to Azure AD Apps. The first will act as a simple Web API, which understands AAD authentication. This role is performed by the MiddleTierAPI project. This API will accept an incoming call with a user identity on a bearer token. When such a call succeeds, it then performs on-behalf-of-flow to get a new access token, to access the second API (which is the SecureAPI)

### First lets register the MiddleTier API.

The Azure function acts as the middle tier WebAPI. There are a few things to know here.
1. The function app will run on `http://localhost:7071` when you test it locally.
2. The function app will run on `https://<yournodejsfunction>.azurewebsites.net` when you run it deployed in azure
3. The function exposes an API with app id uri `https://<yournodejsfunction>.<tenant>.onmicrosoft.com`

Note that all these values are configurable to your liking, and they are reflected in the `MyHttpTrigger\index.js` file.

Additionally, you will need a "client" for the Web API. Since this function will serve as a AAD protected Web API, any client that understands standard openid connect flows will work. The usual consent grant principals apply. 

Reference: [Azure Active Directory consent framework](https://docs.microsoft.com/en-us/azure/active-directory/develop/consent-framework)

To keep things simple, we will reuse the same app registration as both the client, and the API. This eliminates any need to provide explicit consent. For our code example here, the client will use [auth code flow](https://docs.microsoft.com/en-us/azure/active-directory/develop/v2-oauth2-auth-code-flow), for which we will also need a client secret. We are trying to mimic a web app calling this API, and a web app can act as a confidential client.

To setup the app, you can use the below azure CLI script. Note the placeholders demarcated in `<..>` brackets. Make sure to replace them with your environment specific values.

``` SHELL
az ad app create --display-name "MiddleAPI" --credential-description "middleapi" --password "p@ssword1" --reply-urls "http://localhost:7071" --identifier-uris "https://middleapi.<tenantname>.onmicrosoft.com"
```

For the above registered app, get the app ID
``` SHELL
az ad app list --query "[?displayName == 'MiddleAPI'].appId"
```

Also get your tenant ID
``` SHELL
az account show --query "tenantId"
```

Update your index.js with the values per your app registration. Specifically, update the below lines.

``` JavaScript
var tenantID = "<tenantid>";
var clientID = "<appid>";
var appIdURI = "https://middleapi.<tenantname>.onmicrosoft.com";
```

If you examine the code, our secure API is exposed at `<functionurl>/api`. And within this function, we perform an on-behalf of flow, using the `getNewAccessToken` method. Once we have the new access token, we call the SecureAPI. Lets go ahead and setup that project's app registration next.

### Next lets register the SecureAPI API.

The Azure function acts as the called SecureAPI. There are a few things to know here.
1. The function app will run on `http://localhost:7072` when you test it locally. Note that pressing F5 will attempt to run it on port 7071, however since our middle tier API is using that port we will run this on port 7072.
2. The function app will run on `https://<yournodejsfunction>.azurewebsites.net` when you run it deployed in azure
3. The function exposes an API with app id uri `https://<yournodejsfunction>.<tenant>.onmicrosoft.com`

Note that all these values are configurable to your liking, and they are reflected in the `MyHttpTrigger\index.js` file.

To setup the app, you can use the below azure CLI script. Note the placeholders demarcated in `<..>` brackets. Make sure to replace them with your environment specific values.

``` SHELL
az ad app create --display-name "SecureAPI" --credential-description "secureapi" --password "p@ssword1" --reply-urls "http://localhost:7071" --identifier-uris "https://secureapi.<tenantname>.onmicrosoft.com"
```

For the above registered app, get the app ID
``` SHELL
az ad app list --query "[?displayName == 'SecureAPI'].appId"
```

Also get your tenant ID
``` SHELL
az account show --query "tenantId"
```

Update your index.js with the values per your app registration. Specifically, update the below lines.

``` JavaScript
var tenantID = "<tenantid>";
var clientID = "<appid>";
var appIdURI = "https://secureapi.<tenantname>.onmicrosoft.com";
```

### Grant Permissions
The middle tier API will need to request a token on behalf of the user, for the Secure API. 
For this to work, we need to grant middle tier API consent to call the Secure API. Since this is not an interactive process between the APIs, this needs to be manually setup ahead of time.

Use the following steps to setup this consent.

1. In the Azure Portal, AAD settings, go to Application registrations section, and go to the "Expose an API" section.
2. In this section, choose to click the "Add client application button".
3. Here choose to add the client ID of the middle tier API, and ensure that the authorized scope for `https:/https://secureapi.<tenantname>.onmicrosoft.com/user_impersonatiom` is checked. 
4. Click the "Add Application" button at the bottom of the screen.

Your consent is now setup.

## Test your function - locally

To test this locally, you'll have to run the middle tier API and the secure API on different ports.
For the secure API, lets run it on Port 7072. Open terminal and simply run `func host start -p 7072`.

For the middle tier API, follow the following instructions,

 1. With the project open in VSCode, just hit F5, or you can also run `func host start` from the CLI.
 2. You will need an access token to call this function. In order to get the access token, open browser in private mode and visit
 ```
 https://login.microsoftonline.com/<tenantname>.onmicrosoft.com/oauth2/v2.0/authorize?response_type=code&client_id=<appid>&redirect_uri=http://localhost:7071/&scope=openid
```

This will prompt you to perform authentication and consent, and it will return a code in the query string. 
Use that code in the following request to get an access token, remember to put in the code and client secret.
I am using the client secret of `p@ssword1` as I setup in my scripts above. In production environments, you want this to be more complex.

``` SHELL
curl -X POST \
  https://login.microsoftonline.com/<tenantname>.onmicrosoft.com/oauth2/v2.0/token \
  -H 'Accept: */*' \
  -H 'Cache-Control: no-cache' \
  -H 'Connection: keep-alive' \
  -H 'Content-Type: application/x-www-form-urlencoded' \
  -H 'Host: login.microsoftonline.com' \
  -H 'accept-encoding: gzip, deflate' \
  -H 'cache-control: no-cache' \
  -d 'redirect_uri=http%3A%2F%2Flocalhost:7071&client_id=<appid>&grant_type=authorization_code&code=<put code here>&client_secret=p@ssword1&scope=https%3A%2F%funcapi.<tenantname>.onmicrosoft.com%2F/user_impersonation'
  ```
 
 3. Once you get the access token, make a GET request to `http://localhost:7071/api` with the access token as a Authorization Bearer header. Verify that you get an output similar to the below. The values marked as ..removed.. will have actual values in your output.

 ``` JSON
{
    "name": "<the username of the caller>"
}
```
You may also run this in debug mode, it will be especially interesting to set breakpoints in the middle tier API project. You'll notice that the middle tier API first authenticates the caller, it then requests a new token on behalf of the user, and then it calls the secure API. The final output is being sent from the secure API and because you see the user name printed out, it proves that the identity has gone from your machine, to the middle tier API, to the backend API.

 ## Test your function - in Azure

 1. Go ahead and create a function app in azure, ensure that you pick nodejs as it's runtime and under platform features\configuration, set the `WEBSITE_DEFAULT_NODE_VERSION` to 10.14.1 (or whatever version you are using, you can get the version using `node --version` on your local terminal)
 2. Choose to deploy the function. Repeat this for both the middle tier API and the secure API.

 ![Deploy Function](images/deployfunction.png)
 
 3. You will need an access token to call this function. In order to get the access token, open browser in private mode and visit
```
https://login.microsoftonline.com/<tenantname>.onmicrosoft.com/oauth2/v2.0/authorize?response_type=code&client_id=<appid>&redirect_uri=https://<yournodejsfunction>.azurewebsites.net/callback&scope=openid
```

This will prompt you to perform authentication, and it will return a code. 
Use that code in the following request to get an access token, remember to put in the code and client secret.

``` SHELL
curl -X POST \
  https://login.microsoftonline.com/<tenantname>.onmicrosoft.com/oauth2/v2.0/token \
  -H 'Accept: */*' \
  -H 'Cache-Control: no-cache' \
  -H 'Connection: keep-alive' \
  -H 'Content-Type: application/x-www-form-urlencoded' \
  -H 'Host: login.microsoftonline.com' \
  -H 'accept-encoding: gzip, deflate' \
  -H 'cache-control: no-cache' \
  -d 'redirect_uri=https%3A%2F%2F<yournodejsfunction>.azurewebsites.net%2Fcallback&client_id=<appid>&grant_type=authorization_code&code=<put code here>&client_secret=<put client secret here>&scope=https%3A%2F%2Fmiddleapi.<tenantname>.onmicrosoft.com%2Fuser_impersonation'
  ```
 
 3. Once you get the access token, make a GET request to `https://<yournodejsfunction>.azurewebsites.net/api` with the access token as a Authorization Bearer header. Verify that you get an output similar to the below. The values marked as ..removed.. will have actual values in your output.

``` JSON
{
    "name": "<the username of the caller>"
}
```

## Contributing

This project welcomes contributions and suggestions.  Most contributions require you to agree to a
Contributor License Agreement (CLA) declaring that you have the right to, and actually do, grant us
the rights to use your contribution. For details, visit https://cla.opensource.microsoft.com.

When you submit a pull request, a CLA bot will automatically determine whether you need to provide
a CLA and decorate the PR appropriately (e.g., status check, comment). Simply follow the instructions
provided by the bot. You will only need to do this once across all repos using our CLA.

This project has adopted the [Microsoft Open Source Code of Conduct](https://opensource.microsoft.com/codeofconduct/).
For more information see the [Code of Conduct FAQ](https://opensource.microsoft.com/codeofconduct/faq/) or
contact [opencode@microsoft.com](mailto:opencode@microsoft.com) with any additional questions or comments.
