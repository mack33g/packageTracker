module.exports = {
    "up": "ALTER TABLE packages ADD PRIMARY KEY (userName, trackingId)",
    "down": "ALTER TABLE packages DROP PRIMARY KEY"
}