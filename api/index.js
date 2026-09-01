/**
 * Vercel serverless entry point.
 * Imports the request handler from server.js and exports it
 * in the format Vercel expects: module.exports = (req, res) => ...
 */
const { vercelHandler } = require('../server');

module.exports = vercelHandler;
