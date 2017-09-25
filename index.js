var _ = require('lodash'),
    colors = require('colors/safe'),
    Table = require('cli-table2'),
    format = require('util').format,
    util = require('../../util'),
    cliUtils = require('./cli-utils'),
    print = require('../../print'),
    pad = cliUtils.padLeft,

    LF = '\n',
    SPC = ' ',
    DOT = '.',
    E = '',

    PostmanCLIReporter;

const { URL } = require('url');
// sets theme for colors for console logging
colors.setTheme({
    log: 'grey',
    info: 'cyan',
    warn: 'yellow',
    debug: 'blue',
    error: 'red'
});

/**
 * CLI reporter
 *
 * @param {EventEmitter} emitter - An EventEmitter instance with event handler attachers to trigger reporting.
 * @param {Object} reporterOptions - CLI reporter options object.
 * @param {Boolean=} reporterOptions.silent - Boolean flag to turn off CLI reporting altogether, if set to true.
 * @param {Boolean=} reporterOptions.noAssertions - Boolean flag to turn off assertion reporting, if set to true.
 * @param {Boolean=} reporterOptions.noSummary - Boolean flag to turn off summary reporting altogether, if set to true.
 * @param {Boolean=} reporterOptions.noFailures - Boolean flag to turn off failure reporting altogether, if set to true.
 * @param {Boolean=} reporterOptions.noConsole - Boolean flag to turn off console logging, if set to true.
 * @param {Object} options - A set of generic collection run options.
 * @returns {*}
 */
PostmanCLIReporter = function (emitter, reporterOptions, options) {
    // print("TEST TEST");
    var resultdict = {};
    var currentGroup = options.collection,
        inspect = cliUtils.inspector(options),
        wrap = cliUtils.wrapper(),
        symbols = cliUtils.symbols(options.disableUnicode);

    // respect silent option to not report anything
    if (reporterOptions.silent || options.silent) {
        return; // we simply do not register anything!
    }

    // we register the `done` listener first so that in case user does not want to show results of collection run, we
    // simply do not register the other events
    emitter.on('done', function () {
        // for some reason, if there is no run summary, it is unexpected and hence don't validate this
        var run = this.summary.run;
        }
    });

    emitter.on('start', function () {
        // print("TEST TEST START")
        var collectionIdentifier = currentGroup && (currentGroup.name || currentGroup.id);

        // print the newman banner
        print('%s\n\n', colors.reset('newman'));

        // print the collection name and newman info line
        collectionIdentifier && print.lf('%s', colors.reset(collectionIdentifier));
    });

    emitter.on('beforeIteration', function (err, o) {
        // print("TEST TEST beforeIteration \n")
        if (err || o.cursor.cycles <= 1) {
            return; // do not print iteration banner if it is a single iteration run
        }

        // print the iteration info line
        print.lf(LF + colors.gray.underline('Iteration %d/%d'), o.cursor.iteration + 1, o.cursor.cycles);
    });

    emitter.on('beforeItem', function (err, o) {
        // print("TEST TEST beforeItem")
        // clear result object
        resultdict = {};
        if (err) { return; }
        var itemGroup = o.item.parent(),
            root = !itemGroup || (itemGroup === options.collection);

        // in case this item belongs to a separate folder, print that folder name
        if (itemGroup && (currentGroup !== itemGroup)) {
            // print("TEST TEST folder name?? ")
            !root && print('\n%s %s', symbols.folder, colors.reset(util.getFullName(itemGroup)));

            // set the flag that keeps track of the currently running group
            currentGroup = itemGroup;
        }

        // we print the item name. the symbol prefix denotes if the item is in root or under folder.
        // @todo - when we do indentation, we would not need symbolic representation
        //  set name
        resultdict.test_name = o.item.name;
        
        o.item && print.lf('\n%s %s', (root ?
            
            symbols.root : symbols.sub), colors.reset(o.item.name || E));
    });

    // print out the request name to be executed and start a spinner
    emitter.on('beforeRequest', function (err, o) {
        // print("TEST TEST beforeRequest")
        if (err) { return; }
        resultdict['http.request.method'] = o.request.method;
        const requestUrl = new URL(o.request.url);
        resultdict['http.request.host'] = requestUrl.hostname;
        resultdict['http.request.uri.keyword'] = requestUrl.path;
        print(o);
        o.request && print('  %s %s ', colors.gray(o.request.method), colors.gray(o.request.url)).wait(colors.gray);
    });

    // output the response code, reason and time
    emitter.on('request', function (err, o) {
        // print("TEST TEST Request")
        if (err) { 
            resultdict['error'] = 'Error in Newman Test Request';
            print(JSON.stringify(resultdict))
            return; 
        }

        var size = o.response && o.response.size();
        size = size && (size.header || 0) + (size.body || 0) || 0;
        
        err ? print.lf(colors.red('[errored]')) :
            print.lf(colors.gray('[%d %s, %s, %s]'), o.response.code, o.response.reason(),
                util.filesize(size), util.prettyms(o.response.responseTime));
    });

    // Print script errors in real time
    emitter.on('script', function (err, o) {
        err && print.lf(colors.red.bold('%s⠄ %s in %s-script'), pad(this.summary.run.failures.length, 3, SPC), err.name,
            o.event && o.event.listen || 'unknown');
    });

    emitter.on('assertion', function (err, o) {
        // print("TEST TEST assertion")
        var passed = !err;

        // handle skipped test display
        if (o.skipped) {
            print.lf('%s %s', colors.cyan('  - '), colors.cyan('[skipped] ' + o.assertion));
            return;
        }

        // print each test assertions
        print.lf('%s %s', passed ? colors.green(`  ${symbols.ok} `) :
            colors.red.bold(pad(this.summary.run.failures.length, 3, SPC) + symbols.dot), passed ?
            colors.gray(o.assertion) : colors.red.bold(o.assertion));
    });

    // show user console logs in a neatly formatted way (provided user has not disabled the same)
    !reporterOptions.noConsole && emitter.on('console', function (err, o) {
        if (err) { return; }

        var color = colors[o.level] || colors.gray,
            message;

        // we first merge all messages to a string. while merging we run the values to util.inspect to colour code the
        // messages based on data type
        message = wrap(_.reduce(o.messages, function (log, message) { // wrap the whole message to the window size
            return (log += (log ? colors.white(', ') : '') + inspect(message));
        }, E), `  ${color(symbols.console.middle)} `); // add an indentation line at the beginning

        print.buffer(color(`  ${symbols.console.top}\n`), color(`  ${symbols.console.bottom}\n`))
            // tweak the message to ensure that its surrounding is not brightly coloured.
            // also ensure to remove any blank lines generated due to util.inspect
            .nobuffer(colors.gray(message.replace(/\n\s*\n/g, LF) + LF));
    });
};


// Mark the CLI reporter as dominant, so that no two dominant reporters are together
PostmanCLIReporter.prototype.dominant = true;

module.exports = PostmanCLIReporter;
