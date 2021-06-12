const { query } = require("express-validator");
const { Client } = require("pg");

const client = new Client({
  // connectionString:
  //   "postgres://blrpdmsvmwfule:b9e8f562d6b90b4869caefba388481508b20672be236206d856e6ef40f4e6b27@ec2-34-195-143-54.compute-1.amazonaws.com:5432/d1bbk7s6p55icc",
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false,
  },
});

client.connect();

const readSession = async (id, description) => {
  try {
    const res = await client.query(
      "SELECT * FROM wa_sessions_multi WHERE id=$1 AND description=$2 ORDER BY created_at DESC LIMIT 1",
      [id, description]
    );
    if (res.rows.length > 0) return res.rows[0].session;
    return "";
  } catch (err) {
    throw err;
  }
};

const saveSession = (session, id, description) => {
  client.query(
    "INSERT INTO wa_sessions_multi (session,id,description) VALUES($1,$2,$3)",
    [session, id, description],
    (err, results) => {
      if (err) {
        console.error("Failed to save session!", err);
      } else {
        console.log("Session saved!");
      }
    }
  );
};

const removeSession = (id, description) => {
  client.query(
    "DELETE FROM wa_sessions_multi WHERE id=$1 AND description=$2",
    [id, description],
    (err, results) => {
      if (err) {
        console.error("Failed to remove session!", err);
      } else {
        console.log("Session deleted!");
      }
    }
  );
};

const readUsersFirst = async (id, description) => {
  try {
    const res = await client.query(
      "SELECT * FROM users WHERE id=$1 AND description=$2 ORDER BY created_at DESC LIMIT 1",
      [id, description]
    );
    if (res.rows.length > 0) return res.rows;
    return "";
  } catch (err) {
    throw err;
  }
};

const readUsers = async () => {
  try {
    const res = await client.query(
      "SELECT * FROM users ORDER BY created_at DESC"
    );
    if (res.rows.length > 0) return res.rows;
    return "";
  } catch (err) {
    throw err;
  }
};

const saveUsers = async (id, description, ready, info) => {
  try {
    const res = await client.query(
      "SELECT * FROM users WHERE id=$1 AND description=$2",
      [id, description]
    );
    if (res.rows.length > 0) {
      // if (ready) {
        client.query(
          "UPDATE users SET ready=$3, info=$4 WHERE id=$1 AND description=$2",
          [id, description, ready, info],
          (err, results) => {
            if (err) {
              console.error("Failed to update session!", err);
            } else {
              console.log("Users updated!");
            }
          }
        );
      // }
    } else if (res.rows.length <= 0) {
      client.query(
        "INSERT INTO users (id,description,ready,info) VALUES($1,$2,$3,$4)",
        [id, description, ready, info],
        (err, results) => {
          if (err) {
            console.error("Failed to save session!", err);
          } else {
            console.log("Users saved!");
          }
        }
      );
    }
    return "";
  } catch (err) {
    throw err;
  }
};

const removeUsers = (id, description) => {
  client.query(
    "DELETE FROM users WHERE id=$1 AND description=$2",
    [id, description],
    (err, results) => {
      if (err) {
        console.error("Failed to remove session!", err);
      } else {
        console.log("Users deleted!");
      }
    }
  );
};

const saveHook = async (id, description, hook) => {
  try {
    const res = await client.query(
      "SELECT * FROM users WHERE id=$1 AND description=$2",
      [id, description]
    );
    if (res.rows.length > 0) {
      client.query(
        "UPDATE users SET hook=$3 WHERE id=$1 AND description=$2",
        [id, description, hook],
        (err, results) => {
          if (err) {
            console.error("Failed to update hook!", err);
          } else {
            console.log("hook updated!");
          }
        }
      );
    }
  } catch (err) {
    throw err;
  }
};

module.exports = {
  readUsers,
  saveUsers,
  removeUsers,
  readSession,
  saveSession,
  removeSession,
  readUsersFirst,
  saveHook,
};
