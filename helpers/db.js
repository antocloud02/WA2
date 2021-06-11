const { query } = require("express-validator");
const { Client } = require("pg");

const client = new Client({
  connectionString:
    "postgres://blrpdmsvmwfule:b9e8f562d6b90b4869caefba388481508b20672be236206d856e6ef40f4e6b27@ec2-34-195-143-54.compute-1.amazonaws.com:5432/d1bbk7s6p55icc",
  // connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false,
  },
});

client.connect();

const readSession = async () => {
  try {
    const res = await client.query(
      "SELECT * FROM wa_sessions ORDER BY created_at DESC LIMIT 1"
    );
    if (res.rows.length) return res.rows[0].session;
    return "";
  } catch (err) {
    throw err;
  }
};

const saveSession = (session) => {
  client.query(
    "INSERT INTO wa_sessions (session) VALUES($1)",
    [session],
    (err, results) => {
      if (err) {
        console.error("Failed to save session!", err);
      } else {
        console.log("Session saved!");
      }
    }
  );
};

const removeSession = () => {
  client.query("DELETE FROM wa_sessions", (err, results) => {
    if (err) {
      console.error("Failed to remove session!", err);
    } else {
      console.log("Session deleted!");
    }
  });
};

module.exports = {
  readSession,
  saveSession,
  removeSession,
};
