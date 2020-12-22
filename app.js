var express = require("express");
var app = express();
var bodyParser = require("body-parser");
var mysql = require("mysql");
// var gmail = require("./gmail");
const appConfig = require("./config");
const playwright = require("playwright");

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

const carrierConfigs = {
    ups: {
        name: 'ups',
        url: 'https://www.ups.com/WebTracking?loc=en_US&trackNums=',
        status: {
            selector: '[id^="stApp_"]',
            index: [12]
        },
        details: {
            selector: '[id^="stApp_"]',
            index: [13]
        },
        // Making this a string pattern as opposed to a regex expression so that I can use this in regex
        // constructors like when looking for tracking numbers in gmail
        pattern: [
            '(1Z)[0-9A-Z]{16}',
            '(T)+[0-9A-Z]{10}',
            '[0-9]{9}',
            '[0-9]{26}'
        ]
    },
    fedex: {
        name: 'fedex',
        url: 'http://www.fedex.com/Tracking?&tracknumbers=',
        status: {
            selector: '.redesignSnapshotTVC.snapshotController_addr_label.dest',
            index: [0]
        },
        details: {
            selector: '.redesignSnapshotTVC.snapshotController_date.dest',
            index: [0]
        },
        pattern: [
            '[0-9]{20}',
            '[0-9]{15}',
            '[0-9]{12}',
            '[0-9]{22}'
        ]
    },
    usps: {
        name: 'usps',
        url: 'https://tools.usps.com/go/TrackConfirmAction_input?qtc_tLabels1=',
        status: {
            selector: '.expected_delivery',
            index: [0]
        },
        details: {
            selector: '.delivery_status',
            index: [0]
        },
        pattern: [
            '(94|93|92|94|95)[0-9]{20}',
            '(94|93|92|94|95)[0-9]{22}',
            '(70|14|23|03)[0-9]{14}',
            '(M0|82)[0-9]{8}',
            '([A-Z]{2})[0-9]{9}([A-Z]{2})'
        ]
    }
};

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
    const configs = Object.values(carrierConfigs);
    
    var carrierName = '';
    configs.forEach(carrier => {
        carrier.pattern.forEach(pattern => {
            var regex = new RegExp('^'+pattern+'$');
            if (regex.test(trackingId)) {
                carrierName = carrier.name;
            };
        });
    });
    console.log(carrierName);
    return carrierName;
}

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