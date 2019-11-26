const debug = require('debug')('api:email');
const path = require('path');
const ejs = require('ejs');

// AWS clients
const AWS = require('aws-sdk');
const SES = new AWS.SES({apiVersion: '2010-12-01'});

const config = require('../../config');

const DEFAULT_SUBJECT = '';
const SUBJECTS = {
    'forgot_password': 'Password Reset',
    'new_user': 'Account Activation Required',
    'password_was_changed': 'Password Has Been Changed'
};

// For now just a simple wrapper around the aws sdk
// Should eventually do some idiot-proofing
module.exports.send = async function(to, from, emailType, data) {
    const subject = SUBJECTS[emailType] || DEFAULT_SUBJECT;
    if (config.get('NODE_ENV') !== 'tests') {
        debug(`Sending '${subject}' to ${to}`);
        let html = '';
        try {
            html = await ejs.renderFile(path.join(__dirname, 'templates', `${emailType}.ejs`), data);
        } catch(err) {
            console.log(err); // eslint-disable-line
            return;
        }
        let text = '';
        try {
            text = await ejs.renderFile(path.join(__dirname, 'templates', `${emailType}_text.ejs`), data);
        } catch(err) {
            console.log(err); // eslint-disable-line
        } // eslint-disable-line no-empty

        let params = {
            Destination: {
                ToAddresses: [
                    to
                ]
            },
            Message: {
                Body: {
                    Html: {
                        Charset: 'UTF-8',
                        Data: html
                    },
                    Text: {
                        Charset: 'UTF-8',
                        Data: text
                    }
                },
                Subject: {
                    Charset: 'UTF-8',
                    Data: subject
                }
            },
            Source: from
        };
        SES.sendEmail(params).promise(); // Not even sure we need to wait for this, maybe long term
        // For now not even going to return anything, just fire and forget
    }
};
