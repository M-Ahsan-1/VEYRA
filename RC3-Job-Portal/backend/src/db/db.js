const dns = require('node:dns');
dns.setServers(['8.8.8.8', '1.1.1.1']);
const mongoose = require("mongoose");
const { mongoUri } = require('../config/env');

async function connectDB() {
    await mongoose.connect(mongoUri);

    mongoose.connection.on("error", console.error.bind(console, "connection error:"));

    console.log("Database Connected");
}

module.exports = connectDB;