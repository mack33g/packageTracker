module.exports = {
    "up": "ALTER TABLE packages MODIFY packageName VARCHAR(255),\
     MODIFY carrier VARCHAR(255), MODIFY active tinyint DEFAULT 1",
    "down": "ALTER TABLE packages MODIFY packageName VARCHAR(255) NOT NULL,\
     MODIFY carrier VARCHAR(255) NOT NULL, MODIFY active boolean DEFAULT 1"
}