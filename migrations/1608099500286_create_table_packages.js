module.exports = {
    "up": "INSERT INTO packages (userName, packageName, trackingId, carrier) VALUES ('leo', 'Keyboard switches', '9400111202555425054544', 'usps' ), ('leo', 'Succulents', '1Z98434W0332330878', 'ups')",
    "down": "DELETE FROM packages WHERE trackingID IN ('9400111202555425054544','1Z98434W0332330878')"
}

/*
PACKAGES
- userName
- packageName
- trackingId
- created
- updated
- carrier
- status
- details
- eta
- active
*/