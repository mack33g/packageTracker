const fs = require('fs');
const readline = require('readline');
var parseMessage = require('gmail-api-parse-message');
const {google} = require('googleapis');
const { match } = require('assert');
const carrierConfigs = require('./carrierConfigs');
var uniqueTrackingNumbers;

// callback packages.leogong.net/oauthcallback

// If modifying these scopes, delete token.json.
const SCOPES = ['https://www.googleapis.com/auth/gmail.readonly'];
// The file token.json stores the user's access and refresh tokens, and is
// created automatically when the authorization flow completes for the first
// time.
const TOKEN_PATH = 'token.json';

/**
 * Lists the uniqueTrackingNumbers in the user's account.
 * First returns the last x emails
 * Then calls regex function to look for tracking numbers
 *
 * @param {google.auth.OAuth2} auth An authorized OAuth2 client.
 */

function returnTrackingNumbers(auth) {
    const gmail = google.gmail({version: 'v1', auth});
    gmail.users.messages.list({
        userId: 'me',
        maxResults: 5,
        q: "tracking number shipped"
    }, async function (err, res) {
        if (err)
          return console.log('The API returned an error: ' + err);
        const emails = res.data.messages;
        var trackingNumbers = [];
        if (emails && emails.length) {
          // using for... of because async doesn't work in foreach since the callback completes before each loop
          // returns. https://medium.com/@patarkf/synchronize-your-asynchronous-code-using-javascripts-async-await-5f3fa5b1366d
          for (let message of emails) {
            const messageDetails = await gmail.users.messages.get({
              userId: 'me',
              id: message.id
            });
            // Other useful results that get outputted by parseMessage:
            // snippet, headers.date, headers.from, headers.subject, textHtml, textPlain
            parsedMessage = parseMessage(messageDetails.data);
            // console.log(parsedMessage.headers.subject);
            // console.log(parsedMessage.snippet);
            const results = findTrackingNumber(parsedMessage.textPlain ? parsedMessage.textPlain : parsedMessage.textHtml);
            if (results.length) {
              trackingNumbers = trackingNumbers.concat(results);
              // console.log(trackingNumbers);
            }
            // console.log("\n");
          };
          uniqueTrackingNumbers = [...new Set(trackingNumbers)];
          console.log(uniqueTrackingNumbers);
          return(uniqueTrackingNumbers);
        } else {
          console.log('No messages found.');
        }
      });
    
}

// Sub function used to regex to find parsing numbers
function findTrackingNumber(emailBody) {
    // Create an array for the tracking numbers we find
    var results = [];
    // Load up the ups, fedex, usps etc carrier objects
    const carriers = Object.values(carrierConfigs);
    carriers.forEach(carrier => {
        // Iterate through each of the tracking number patterns
        carrier.patterns.forEach(pattern => {
            // Since most of the patterns start and end in a number, check to make sure that the matched
            // string isn't bookended by numbers - that way you don't end up finding multiple matches
            // e.g. if you're looking for 4 numbers, and there is an 8 digit string, you don't return 5 matches
            const regex = new RegExp('\\D' + pattern + '\\D', 'gi');
            // The search will return a positive match if the entire string is letters
            // But we know those aren't real tracking numbers so we exclude them.
            const onlyLetters = new RegExp('^[A-Z]+$', 'i');
            // Declare the variables for operating regex
            var result, match;
            // Iterate through the emailBody and look for the regex pattern of the tracking number
            while ((match = regex.exec(emailBody))) {
                // If you find it, trim up the non numbers that are bookending the match.
                result = match[0].substring(1,match[0].length-1);
                // And if it isn't just all letters, add it to the results array
                if (onlyLetters.exec(result) == null) {
                    results.push(result);
                }
            }
        });
    });
    // The dupes get processed in listDeliveryEmails
    // console.log(results);
    return results;
}

// Load client secrets from a local file.
let gmailResults = new Promise((resolve, reject) => { 
  fs.readFile('./credentials.json', (err, content) => {
    if (err) return console.log('Error loading client secret file:', err);
    // Authorize a client with credentials, then call the Gmail API.
    // let results = new Promise((resolve, reject) => {
      authorize(JSON.parse(content), returnTrackingNumbers)
    // };
    resolve(results);
    // setTimeout(function(){
    //   return('Success!');
    // }, 2000);
  });
});

// Update the packages database with the unique tracking ids
// Set them with status = 2 which stands for unprocessed
// For app.js when opening /u/username: Update tracking ids table
// When it's up to date, load the page
// function updateTrackingIds(user) {
  // TO DO: convert user to gmail userid
  gmailResults.then(trackingNumbers => {
      // Arrow notation returns the resolution
      console.log('test');
      console.log(trackingNumbers);
  })
  // let test = await gmailResults;
  // console.log(test);
// }

// module.exports = updateTrackingIds();

// ********** AUTH STUFF **********

/**
 * Create an OAuth2 client with the given credentials, and then execute the
 * given callback function.
 * @param {Object} credentials The authorization client credentials.
 * @param {function} callback The callback to call with the authorized client.
 */
function authorize(credentials, callback) {
  const {client_secret, client_id, redirect_uris} = credentials.web;
  const oAuth2Client = new google.auth.OAuth2(
      client_id, client_secret, redirect_uris[0]);

  // Check if we have previously stored a token.
  fs.readFile(TOKEN_PATH, (err, token) => {
    if (err) return getNewToken(oAuth2Client, callback);
    oAuth2Client.setCredentials(JSON.parse(token));
    callback(oAuth2Client);
  });
}

/**
 * Get and store new token after prompting for user authorization, and then
 * execute the given callback with the authorized OAuth2 client.
 * @param {google.auth.OAuth2} oAuth2Client The OAuth2 client to get token for.
 * @param {getEventsCallback} callback The callback for the authorized client.
 */
function getNewToken(oAuth2Client, callback) {
  const authUrl = oAuth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: SCOPES,
  });
  console.log('Authorize this app by visiting this url:', authUrl);
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  rl.question('Enter the code from that page here: ', (code) => {
    rl.close();
    oAuth2Client.getToken(code, (err, token) => {
      if (err) return console.error('Error retrieving access token', err);
      oAuth2Client.setCredentials(token);
      // Store the token to disk for later program executions
      fs.writeFile(TOKEN_PATH, JSON.stringify(token), (err) => {
        if (err) return console.error(err);
        console.log('Token stored to', TOKEN_PATH);
      });
      callback(oAuth2Client);
    });
  });
}