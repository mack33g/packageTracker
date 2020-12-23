module.exports = {
    "up": "ALTER TABLE packages DROP PRIMARY KEY",
    "down": "ALTER TABLE packages ADD PRIMARY KEY (trackingId)"
}

// ALTER TABLE packages ADD PRIMARY KEY (userName, trackingId)
// ALTER TABLE packages DROP PRIMARY KEY