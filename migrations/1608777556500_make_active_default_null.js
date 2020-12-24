module.exports = {
    "up": "ALTER TABLE packages MODIFY active TINYINT",
    "down": "ALTER TABLE packges MODIFY active TINYINT DEFAULT 1"
}