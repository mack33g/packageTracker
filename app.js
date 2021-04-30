var express = require("express");
var app = express();
var bodyParser = require("body-parser");
var mysql = require("mysql");
var suggestNewPackages = require("./gmail");
const appConfig = require("./config");
const playwright = require("playwright");
const carrierConfigs = require("./carrierConfigs");
const SHOWBROWSER = !false;

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
        var packages = [];
        let sql = `SELECT * FROM packages WHERE userName = ${mysql.escape(req.params.userName)} AND active = 1`;
        suggestNewPackages(sanitize(req.params.userName));
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
                // console.log(packageResult); 
                return packageResult;
            })).then(packageResults => {
                // console.log(packageResults);
                let sql = `SELECT COUNT (*) as numSuggestedPackages FROM packages WHERE userName = ${mysql.escape(req.params.userName)} AND active IS NULL`;
                con.query(sql, (error, queryResults, fields) => {
                    if (error) {
                        return console.error(error.message);
                    }
                    let numSuggestedPackages = queryResults[0].numSuggestedPackages;
                    // console.log(numSuggestedPackages);
                    // suggestedPackages = JSON.parse(JSON.stringify(suggestedPackages[0].trackingId));
                    // console.log(suggestedPackages);
                    res.render('results.ejs', {results: packageResults, userName: req.params.userName, numSuggestedPackages: numSuggestedPackages});
                })
                
            });
        });
    })();
    console.log(req.ip + " visited " + req.url);
});

app.get("/u/:userName/suggestedPackages", function(req, res) {
    let sql = `SELECT trackingId FROM packages WHERE userName = ${mysql.escape(req.params.userName)} AND active IS NULL`;
    con.query(sql, (error, suggestedPackages, fields) => {
        if (error) {
            return console.error(error.message);
        }
        // console.log(JSON.stringify(suggestedPackages));
        suggestedPackages = suggestedPackages.map(rowDataPacket => new TrackingInfo(rowDataPacket.trackingId));
        // console.log(suggestedPackages);
        // 
        res.render('suggestedPackages.ejs', {userName: req.params.userName, suggestedPackages: suggestedPackages});
    });
    console.log(req.ip + " visited " + req.url);
})

app.get("/u/:userName/rejectSuggestedPackage/:trackingId", function(req, res) {
    console.log(req.ip + " visited " + req.url);
    let sql = `UPDATE packages SET active=3 WHERE userName = ${mysql.escape(req.params.userName)} AND trackingId = ${mysql.escape(req.params.trackingId)} LIMIT 1`;
    con.query(sql, (error, results, fields) => {
        if (error) {
            return console.error(error.message);
        }
        console.log(sql);
        res.redirect(`/u/${req.params.userName}/suggestedPackages`);
    });
    
})

app.post("/addPackage", function (req, res) {
    console.log("adding a package");
    let userName = mysql.escape(req.body.userName);
    let packageName = mysql.escape(req.body.packageName);
    let trackingId = mysql.escape(req.body.trackingId);
    let carrier = mysql.escape(identifyCarrier(req.body.trackingId));
    // let carrier = mysql.escape(req.body.carrier);
    let sql = `INSERT INTO packages (userName, packageName, trackingId, carrier, active) VALUES (${userName}, ${packageName}, ${trackingId}, ${carrier}, 1) ON DUPLICATE KEY UPDATE packageName = ${packageName}, carrier = ${carrier}, active = 1, updated = CURRENT_TIMESTAMP()`;
    console.log(sql);
    con.query(sql, (error, results, fields) => {
        if (error) {
            return console.error(error.message);
        }
        res.redirect('back');
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
    console.log("Token saved successfully");
    res.send(req.params.code);
    console.log(req.query);
})


app.listen(appConfig.port, '0.0.0.0', function() {
    console.log("Server has started!");
})


// Functions

// async function findGmailTrackingIds() {
//     const trackingIds = require("./gmail");
//     return trackingIds;
//     // trackingIds().then(trackingIds => {
//         let sql = `SELECT * FROM packages WHERE trackingId IN ('${trackingIds}')`;
//         // let sql = "SELECT * FROM packages WHERE trackingId IN ('781626367100','781126852060')"
//         // console.log(sql);
//         con.query(sql, (error, results, fields) => {
//             if (error) {
//                 return console.error(error.message);
//             }
//             // console.log(results);
//         })
//     // });


    
// }

// // (async function() {
//     let test = findGmailTrackingIds();
// // });

function identifyCarrier(trackingId) {
    // Get each of the top level objects in carrierConfigs (ups, fedex, usps)
    const carriers = Object.values(carrierConfigs);
    var carrierName = '';
    carriers.forEach(carrier => {
        carrier.patterns.forEach(pattern => {
            var regex = new RegExp('^'+pattern+'$','i');
            // console.log(regex);
            if (regex.test(trackingId)) {
                carrierName = carrier.name;
            };
        });
    });
    return carrierName;
}

async function checkPackage(package, carrier) {
    const browser = (appConfig.environment == 'mac') ? await playwright.webkit.launch({ 
        // headless: false
        // executablePath: '/usr/bin/chromium-browser' 
    }) : await playwright.chromium.launch({executablePath: '/usr/bin/chromium-browser' });
    const context = await browser.newContext(); 
    const page = await context.newPage();
    const url = package.carrier == 'amazon' ? package.trackingId : carrier.url+package.trackingId;
    await page.goto(url);
    await page.waitForFunction(carrier => {
        const statusContainer = document.querySelectorAll(carrier.readySelector);
        return statusContainer.length > 0;
    }, carrier);
    await page.waitForFunction(carrier => {
        const statusContainer = document.querySelectorAll(carrier.readySelector);
        // after 4 seconds
        // call a function that returns true
        // function timeOut(callback) {
        //     window.setTimeout(function() {
        //         callback();
        //     }, 1000);
        // }

        // timeOut(function() { console.log('test');});

        return statusContainer.length > 0;
        
    }, carrier);
    // await page.waitForLoadState('domcontentloaded');
    // await page.waitForTimeout(5000);


    const status = await page.$$eval(carrier.status.selector, (headers) => {
        return headers.map(header => {
            const text = header.innerText.trim();
            return text;
        });
    });

    const description = await page.$$eval(carrier.details.selector, (headers) => {
        return headers.map(header => {
            const text = header.innerText.trim();
            // console.log(text);
            return text;
        });
    });
    // console.log('\n');
    // console.log(package.name);
    // console.log('Tracking ID: ' + package.trackingId);
    // console.log('status:');
    // console.log(status);
    // console.log('description:');
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
        if (description[index]) {

            result.description += description[index]+'<BR>';
        }
    })
    // console.log(result.description);
    await browser.close();
    return result;
}; 

function TrackingInfo(trackingId) {
    this.trackingId = trackingId;
    this.carrier = identifyCarrier(trackingId);
    // console.log(this.trackingId);
    // console.log(this.carrier);
    let carrier = this.carrier;
    // Can get rid of this condition if tracking info is always created with
    // if (this.carrier != null) {
    this.url = this.carrier == 'amazon' ? trackingId : carrierConfigs[carrier].url+trackingId;
    // }
}

function sanitize(string) {
    return string.toLowerCase();
}