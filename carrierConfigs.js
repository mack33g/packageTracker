const carrierConfigs = {
    ups: {
        name: 'ups',
        url: 'https://www.ups.com/WebTracking?loc=en_US&trackNums=',
        readySelector: '.ups-card',
        status: {
            selector: '[id^="stApp_"]',
            index: [7]
        },
        details: {
            selector: '[id^="stApp_"]',
            index: [13,14]
        },
        // Making this a string pattern as opposed to a regex expression so that I can use this in regex
        // constructors like when looking for tracking numbers in gmail
        patterns: [
            '(1Z)[0-9A-Z]{16}',
            '(T)+[0-9A-Z]{10}',
            '[0-9]{9}',
            '[0-9]{26}'
        ]
    },
    fedex: {
        name: 'fedex',
        url: 'http://www.fedex.com/Tracking?&tracknumbers=',
        readySelector: '.redesignSnapshotTVC.snapshotController_addr_label.dest',
        status: {
            selector: '.redesignSnapshotTVC.snapshotController_addr_label.dest',
            index: [0]
        },
        details: {
            selector: '.redesignSnapshotTVC.snapshotController_date.dest',
            index: [0]
        },
        patterns: [
            '[0-9]{20}',
            '[0-9]{15}',
            '[0-9]{12}',
            '[0-9]{22}'
        ]
    },
    usps: {
        name: 'usps',
        url: 'https://tools.usps.com/go/TrackConfirmAction_input?qtc_tLabels1=',
        readySelector: '.expected_delivery',
        status: {
            selector: '.expected_delivery',
            index: [0]
        },
        details: {
            selector: '.delivery_status',
            index: [0]
        },
        patterns: [
            '(94|93|92|94|95)[0-9]{20}',
            '(94|93|92|94|95)[0-9]{22}',
            '(70|14|23|03)[0-9]{14}',
            '(M0|82)[0-9]{8}',
            '([A-Z]{2})[0-9]{9}([A-Z]{2})'
        ]
    }
};

module.exports = carrierConfigs;