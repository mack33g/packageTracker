module.exports = {
    "up": "CREATE TABLE packages (userName VARCHAR(20) NOT NULL, packageName VARCHAR(255) NOT NULL, trackingId VARCHAR(255) NOT NULL, created TIMESTAMP DEFAULT CURRENT_TIMESTAMP, updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP, carrier VARCHAR(255) NOT NULL, status VARCHAR(255), details VARCHAR(255), eta VARCHAR(255), active BOOLEAN DEFAULT 1, INDEX(userName, trackingId, carrier), PRIMARY KEY(trackingId))",
    "down": "DROP TABLE packages"
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