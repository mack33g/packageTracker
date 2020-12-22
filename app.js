var express = require("express");
var app = express();
var bodyParser = require("body-parser");
var mysql = require("mysql");
// var gmail = require("./gmail");
const appConfig = require("./config");
const playwright = require("playwright");
const carrierConfigs = require("./carrierConfigs");

app.use(express.static("public"));
app.use(bodyParser.urlencoded({extended: true}));

var con = mysql.createConnection({
    host: appConfig.host,
    user: appConfig.user,
    password: appConfig.password,
    database: appConfig.database
  });
  
con.connect(function(err) {
if (err) throw err;
console.log("Connected to mySQL!");
});

app.get("/", function(req, res) {
    res.render("home.ejs");
    console.log(req.ip + " visited " + req.url);
})

app.post('/u/', function(req, res) {
        // TO DO: sanitize characters
        var userName = sanitize(req.body.userName);
        res.redirect("/u/" + userName);
})

app.get("/u/:userName", function(req, res) {
    // console.log("checking packages");
    (async function checkPackages() {
        const packages = [];
        let sql = `SELECT * FROM packages WHERE userName = ${mysql.escape(req.params.userName)} AND active = 1`;
        con.query(sql, (error, results, fields) => {
            if (error) {
                return console.error(error.message);
            }
            results.forEach(result => {
                packages.push({
                    name: result.packageName,
                    trackingId: result.trackingId,
                    carrier: result.carrier
                });
            });
            var packageResults = {};
            packageResults = Promise.all(packages.map(async (package) => {
                const packageResult = await checkPackage(package, carrierConfigs[package.carrier]);   
                return packageResult;
            })).then(packageResults => {
                res.render('results.ejs', {results: packageResults, userName: req.params.userName});
            });
        });
    })();
    console.log(req.ip + " visited " + req.url);
});

app.post("/addPackage", function (req, res) {
    console.log("adding a package");
    let userName = mysql.escape(req.body.userName);
    let packageName = mysql.escape(req.body.packageName);
    let trackingId = mysql.escape(req.body.trackingId);
    let carrier = mysql.escape(identifyCarrier(req.body.trackingId));
    // let carrier = mysql.escape(req.body.carrier);
    let sql = `INSERT INTO packages (userName, packageName, trackingId, carrier) VALUES (${userName}, ${packageName}, ${trackingId}, ${carrier}) ON DUPLICATE KEY UPDATE active = 1, updated = CURRENT_TIMESTAMP()`;
    console.log(sql);
    con.query(sql, (error, results, fields) => {
        if (error) {
            return console.error(error.message);
        }
        res.redirect("/u/"+req.body.userName);
    });
});

app.post("/removePackage", function (req, res) {
    console.log("removing a package");
    console.log(req.body);
    let trackingId = mysql.escape(req.body.trackingId);
    let sql = `UPDATE packages SET active = 0 WHERE trackingId = ${trackingId} LIMIT 1`;
    console.log(sql);
    con.query(sql, (error, results, fields) => {
        if (error) {
            return console.error(error.message);
        }
        res.redirect("back");
    })
})

app.get("/oauthcallback", function (req, res) {
    console.log(req);
})


app.listen(3000, '0.0.0.0', function() {
    console.log("Server has started!");
})


// Functions

function identifyCarrier(trackingId) {
    // Get each of the top level objects in carrierConfigs (ups, fedex, usps)
    const carriers = Object.values(carrierConfigs);
    
    var carrierName = '';
    carriers.forEach(carrier => {
        carrier.patterns.forEach(pattern => {
            var regex = new RegExp('^'+pattern+'$');
            if (regex.test(trackingId)) {
                carrierName = carrier.name;
            };
        });
    });
    console.log(carrierName);
    return carrierName;
}

// identifyCarrier(781126852060);

async function checkPackage(package, carrier) {
    const browser = (appConfig.environment == 'mac') ? await playwright.chromium.launch({ 
        // headless: false
    }) : await playwright.chromium.launch({executablePath: '/usr/bin/chromium-browser' });
    const context = await browser.newContext(); 
    const page = await context.newPage();
    const url = carrier.url+package.trackingId;
    await page.goto(url);
    await page.waitForFunction(carrier => {
        const statusContainer = document.querySelectorAll(carrier.status.selector);
        return statusContainer.length > 0;
    }, carrier);

    const status = await page.$$eval(carrier.status.selector, (headers) => {
        return headers.map(header => {
            const text = header.innerText.trim();
            return text;
        });
    });

    const description = await page.$$eval(carrier.details.selector, (headers) => {
        return headers.map(header => {
            const text = header.innerText.trim();
            return text;
        });
    });
    console.log('\n');
    // console.log(package.name);
    // console.log('Tracking ID: ' + package.trackingId);
    // console.log(status);
    // console.log(description);

    var result = {
        name: package.name,
        status: '',
        description: '',
        url: url,
        carrier: package.carrier,
        trackingId: package.trackingId
    };

    carrier.status.index.forEach(index => {
        // console.log(status[index]);
        result.status += status[index];
    });

    carrier.details.index.forEach(index => {
        // console.log(description[index]);
        result.description += description[index];
    })

    await browser.close();
    return result;
}; 

function sanitize(string) {
    return string.toLowerCase();
}