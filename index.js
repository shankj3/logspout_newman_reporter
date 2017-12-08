var _ = require('lodash'),
    moment = require('moment'),

    LF = '\n',
    SPC = ' ',
    DOT = '.',
    E = '',

    LogspoutReporter;

const { URL } = require('url');

function isEmptyObject(obj) {
  return !Object.keys(obj).length;
}

/**
 * Logspout Reporter
 *
 * @param {EventEmitter} emitter - An EventEmitter instance with event handler attachers to trigger reporting.
 * @param {Object} options - A set of generic collection run options.
 * @returns {*}
 * 
 * Modified from cli reporter in Newman Code 
 * https://github.com/postmanlabs/newman.git
 */

LogspoutReporter = function (emitter, options) {
    var elasticResult = {};
    var currentGroup = options.collection;

    // respect silent option to not report anything
    if (options.silent) {
        return; // we simply do not register anything!
    }

    // we register the `done` listener first so that in case user does not want to show results of collection run, we
    // simply do not register the other events
    emitter.on('done', function () {
        // for some reason, if there is no run summary, it is unexpected and hence don't validate this
        var run = this.summary.run;
    });

    emitter.on('start', function () {
        // todo: figure out if you want to add anything to elasticResult on start. Probaly not because
        // its wiped on every beforeItem
        var collectionIdentifier = currentGroup && (currentGroup.name || currentGroup.id);
    });

    emitter.on('beforeItem', function (err, o) {
        var collectionIdentifier = currentGroup && (currentGroup.name || currentGroup.id);

        // print previous result object
        if (typeof elasticResult !== 'undefined' && elasticResult !== null ) {
            if (!isEmptyObject(elasticResult)) {
                console.log(JSON.stringify(elasticResult))
            }
        }
        // clear result object
        elasticResult = {};
        elasticResult["assertion_errors"] = [];
        elasticResult["assertion_errors_length"] = 0;
        // // add in ELK identifiers & collection name since it's all the same for one run
        // elasticResult['@timestamp'] = moment().format('YYYY-MM-DD HH:mm:ss.SSSSSS');
        // elasticResult['@version'] = 1;
        elasticResult['collection'] = collectionIdentifier;

        // No need to even print out any json for ELK here, since nothing of value has happened, request hasn't
        // been sent yet
        if (err) { return; }
        var itemGroup = o.item.parent(),
            root = !itemGroup || (itemGroup === options.collection);

        // in case this item belongs to a separate folder, print that folder name
        if (itemGroup && (currentGroup !== itemGroup)) {
            // set the flag that keeps track of the currently running group
            currentGroup = itemGroup;
        }

        //  set name of test to elasticResult
        elasticResult.test_name = o.item.name;
    });

    // print out the request name to be executed and start a spinner
    emitter.on('beforeRequest', function (err, o) {
        if (err) { return; }
        elasticResult['http.request.method'] = o.request.method;
        // todo: replace this URl instantiation
        const requestUrl = new URL(o.request.url);
        elasticResult['http.request.host'] = requestUrl.hostname;
        elasticResult['http.request.uri.keyword'] = o.request.url.getPathWithQuery();
        o.request;
    });

    // output the response code, reason and time
    emitter.on('request', function (err, o) {
        elasticResult.execution_time = moment().format('X')
        // if there was an error in the request for any reason, add the error and 
        // the error_object for analysis 
        // also set test_passed to false, so you can index on this as well if you want. 
        if (err) { 
            elasticResult['error'] = true;
            elasticResult['error_object'] = err;
            elasticResult.test_passed = false;
            console.log(JSON.stringify(elasticResult))
            return; 
        }
        elasticResult['http.response.status'] = o.response.code;
        elasticResult.run_time = o.response.responseTime;

        var size = o.response && o.response.size();
        size = size && (size.header || 0) + (size.body || 0) || 0;
        elasticResult.size = size
    });

    // Add script errors to ELK object 
    emitter.on('script', function (err, o) {
        // keeping in this print for now because i don't know when this happens. 
        if (err) {
            elasticResult.error = true;
            elasticResult.error_object = err;
        
        }
    });

    emitter.on('assertion', function (err, o) {
        var passed = !err;

        // handle skipped test
        if (o.skipped) {
            // if skipped, we don't care with logstash.. or do we?? I'm not sure yet
            // @todo: figure out if skipped is necessary
            return;
        }
        // if it didn't pass, return the assertion error in the array 
        if (!passed) {
            elasticResult["assertion_errors"].push(o.assertion);
            elasticResult["assertion_errors_length"]++;
        }
        elasticResult.test_passed = passed;
    });

    // show user console logs in a neatly formatted way (provided user has not disabled the same)
    //  
    // I don't htink i actually care about console logs right now. - Jessi
    //
    // emitter.on('console', function (err, o) {
    //     do something?
    // });
};


// Mark the CLI reporter as dominant, so that no two dominant reporters are together
LogspoutReporter.prototype.dominant = true;

module.exports = LogspoutReporter;
