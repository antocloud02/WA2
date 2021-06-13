const { Client, MessageMedia } = require("whatsapp-web.js");
const express = require("express");
const socketIO = require("socket.io");
const qrcode = require("qrcode");
const http = require("http");
const { phoneNumberFormatter } = require("./helpers/formatter");
const axios = require("axios");
const port = process.env.PORT || 8000;
const urlx = require("url");

const app = express();
const server = http.createServer(app);
const io = socketIO(server);

app.use(express.json());
app.use(
  express.urlencoded({
    extended: true,
  })
);

const db = require("./helpers/db_multi.js");

app.get("/", (req, res) => {
  res.sendFile("index-multiple-device.html", {
    root: __dirname,
  });
});
app.get("/realtime", (req, res) => {
  res.sendFile("realtime.html", {
    root: __dirname,
  });
});

app.post("/event", (req, res) => {
  res.status(200).json({
    status: true,
    response: req.body,
  });
  io.sockets.emit("data", req.body);
});

const sessions = [];
const clients = [];

var sss = 0;
const createSession = async (id, description) => {
  console.log("Creating session: " + id);

  const sessionCfg = await db.readSession(id, description);

  const client = new Client({
    restartOnAuthFail: true,
    puppeteer: {
      headless: true,
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
        "--disable-accelerated-2d-canvas",
        "--no-first-run",
        "--no-zygote",
        "--single-process", // <- this one doesn't works in Windows
        "--disable-gpu",
      ],
    },
    session: sessionCfg,
  });

  client.initialize();

  for (var x = 0; x < clients.length; x++) {
    if (clients[x].id == id) {
      console.log("Clinet duplicate destroy");
      if (clients[x].client) {
        clients[x].client.destroy();
      }
      clients.splice(x, 1);
    }
  }
  clients.push({
    id: id,
    client: client,
  });

  client.on("qr", (qr) => {
    console.log("QR RECEIVED", qr);
    qrcode.toDataURL(qr, (err, url) => {
      io.emit("qr", { id: id, src: url });
      io.emit("message", { id: id, text: "QR Code received, scan please!" });
    });
  });

  client.on("ready", async () => {
    io.emit("ready", { id: id, info: client.info });
    io.emit("message", { id: id, text: "Whatsapp is ready!" });
    console.log("Whatsapp is ready!");

    // Tambahkan client ke sessions
    // var id = 88;
    for (var i = 0; i < sessions.length; i++) {
      if (sessions[i].id == id) {
        sessions.splice(i, 1);
        break;
      }
    }
    // console.log(sessions);
    sessions.push({
      id: id,
      description: description,
      client: client,
    });
    db.saveUsers(id, description, true, client.info);
    sss = sss + 2;
    // console.log(sessions);
  });

  client.on("authenticated", (session) => {
    io.emit("authenticated", { id: id, info: client.info });
    io.emit("message", { id: id, text: "Whatsapp is authenticated!" });
    db.saveSession(session, id, description);
  });

  client.on("auth_failure", function (session) {
    console.log("Auth failure, restarting...");
    io.emit("message", { id: id, text: "Auth failure, restarting..." });
    db.removeSession(id, description);
    db.removeUsers(id, description);
    // db.saveUsers(id, description, false, {});
  });

  client.on("disconnected", async (reason) => {
    io.emit("disconnected", { id: id });
    io.emit("message", { id: id, text: "Whatsapp is disconnected!" });
    db.removeSession(id, description);

    let dtusers2 = await db.readUsersFirst(id, description);
    if (dtusers2 == "") {
      for (var x = 0; x < clients.length; x++) {
        if (clients[x].id == id) {
          console.log("Clinet disconnected destroy");
          if (clients[x].client) {
            clients[x].client.destroy();
          }
          clients.splice(x, 1);
        }
      }
    }
    // client.initialize();

    // Menghapus pada file sessions
    db.removeUsers(id, description);
  });

  client.on("message", async (msg) => {
    let dtusers = await db.readUsersFirst(id, description);
    let urlhook = dtusers[0].hook;
    if (msg.body == "!ping") {
      msg.reply(urlhook);
    }
    if (urlhook != "" && urlhook != null) {
      console.log(urlhook);
      axios
        .post(urlhook, {
          lastName: msg,
        })
        .then(function (response) {
          console.log("callback terkirim");
        })
        .catch(function (error) {
          console.log("callback gagal terkirim");
          console.log(error);
        });
    }
  });
};

const init = async (socket) => {
  const savedSessions = await db.readUsers();

  if (savedSessions != "") {
    if (socket) {
      socket.emit("init", savedSessions);
    } else {
      console.log("ttttttttttttt");
      savedSessions.forEach((sess) => {
        createSession(sess.id, sess.description);
      });
    }
  }
};

init();

// Socket IO
io.on("connection", function (socket) {
  let uu = urlx.parse(socket.handshake.headers.referer);
  if (uu.pathname == "/") {
    sss++;
    socket.on("key", async (data) => {
      let dtusers = await db.readUsersFirst(data.id, data.description);
      if (dtusers != "") {
        if (sss > 1) {
          socket.emit("init", dtusers[0]);
        }
      } else {
        console.log("buat session: " + data.id);
        createSession(data.id, data.description);
      }
      socket.on("disconnect", async () => {
        let dtusers2 = await db.readUsersFirst(data.id, data.description);
        if (dtusers2 == "") {
          for (var x = 0; x < clients.length; x++) {
            if (clients[x].id == data.id) {
              console.log("Client baru is Destroy!");
              if (clients[x].client) {
                clients[x].client.destroy();
              }
              clients.splice(x, 1);
            }
          }
        }
      });
    });
    socket.on("hook", function (data) {
      console.log("saved hook: " + data.id);
      db.saveHook(data.id, data.description, data.hook);
    });
  } else if (uu.pathname == "/realtime") {
    console.log("realtime...");
  }
});

// Send message
app.post("/send-message", (req, res) => {
  const sender = req.body.sender;
  const number = phoneNumberFormatter(req.body.number);
  const message = req.body.message;

  const client = sessions.find((sess) => sess.id == sender).client;

  client
    .sendMessage(number, message)
    .then((response) => {
      res.status(200).json({
        status: true,
        response: response,
      });
    })
    .catch((err) => {
      res.status(500).json({
        status: false,
        response: err,
      });
    });
});

server.listen(port, function () {
  console.log("App running on *: " + port);
});
