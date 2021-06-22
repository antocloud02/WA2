const { Client, MessageMedia, Message } = require("whatsapp-web.js");
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

app.use(express.json({ limit: "50mb" }));
app.use(
  express.urlencoded({
    extended: true,
    limit: "50mb",
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
    if (msg.hasMedia) {
      console.log("media");
      console.log(msg.id._serialized);
    }
    if (urlhook != "" && urlhook != null) {
      console.log(urlhook);
      axios
        .post(urlhook, setrespon(msg))
        .then(function (response) {
          if (response.status == 0) {
            console.log(response);
          }
          console.log("callback terkirim");
        })
        .catch(function (error) {
          console.log("callback gagal terkirim");
          console.log(error);
        });
    }
    if (msg.body == "!ping") {
      msg.reply(urlhook);
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

function setrespon(response) {
  response["key_chat"] = response.id._serialized;
  response["dari_saya"] = response.fromMe;
  response["id"] = response.id.id;
  response["file_status"] = response.hasMedia;
  response["tipe"] = response.type;
  response["teks"] = response.body;
  response["pengirim"] = response.from;
  response["tujuan"] = response.to;
  response["diteruskan"] = response.isForwarded;
  if (response.type == "vcard") {
    response["vcard"] = response.body;
    response["teks"] = "";
  }
  if (response.type == "location") {
    response["lokasi"] = response.location;
    response["ket_lokasi"] = response.body;
    response["teks"] = "";
  }
  response["author"] = "";
  response["location"] = "";
  delete response.ack;
  delete response.hasMedia;
  delete response.type;
  delete response.body;
  delete response.fromMe;
  delete response.from;
  delete response.to;
  delete response.hasQuotedMsg;
  delete response.vCards;
  delete response.mentionedIds;
  delete response.isStarred;
  delete response.isForwarded;
  delete response.mediaKey;
  delete response.author;
  delete response.location;
  if (typeof response.links !== "undefined") {
    delete response.links;
  }
  if (typeof response.isStatus !== "undefined") {
    delete response.isStatus;
  }
  if (typeof response.broadcast !== "undefined") {
    delete response.broadcast;
  }
  return response;
}

// Download file
app.post("/download-file", async (req, res) => {
  if (typeof req.body.key_chat == "undefined") {
    return res.status(422).json({
      status: false,
      respon: "Parameter key_chat tidak ada!",
    });
  }
  if (typeof req.body.key == "undefined") {
    return res.status(422).json({
      status: false,
      respon: "Parameter key tidak ada!",
    });
  }
  const key = req.body.key_chat;
  const id = req.body.key;

  if (key == "") {
    return res.status(422).json({
      status: false,
      respon: "Key Chat tidak boleh kosong!",
    });
  }

  if (id == "") {
    return res.status(422).json({
      status: false,
      respon: "Key tidak boleh kosong!",
    });
  }

  const client = sessions.find((sess) => sess.id == id).client;
  let message = new Message(client, {
    id: { _serialized: key },
    clientUrl: true,
  });
  const file = await message.downloadMedia();
  console.log("download file");
  res.status(200).json({
    status: true,
    respon: file,
  });
});

// Kirim Pesan
app.post("/kirim-pesan", async (req, res) => {
  if (typeof req.body.nomor == "undefined") {
    return res.status(422).json({
      status: false,
      respon: "Parameter nomor tidak ada!",
    });
  }
  if (typeof req.body.key == "undefined") {
    return res.status(422).json({
      status: false,
      respon: "Parameter key tidak ada!",
    });
  }

  const keyuser = req.body.key;
  const nomor = phoneNumberFormatter(req.body.nomor);
  let type = "text";
  if (typeof req.body.tipe !== "undefined") {
    type = req.body.tipe;
  }

  if (nomor == "") {
    return res.status(422).json({
      status: false,
      respon: "Nomor tidak boleh kosong!",
    });
  }

  if (keyuser == "") {
    return res.status(422).json({
      status: false,
      respon: "Key tidak boleh kosong!",
    });
  }

  let teks = "";
  if (req.body.teks !== "undefined") {
    teks = req.body.teks;
  }
  if (type != "file") {
    if (typeof req.body.teks == "undefined") {
      return res.status(422).json({
        status: false,
        respon: "Parameter teks tidak ada!",
      });
    }
    if (teks == "") {
      return res.status(422).json({
        status: false,
        respon: "Teks tidak boleh kosong!",
      });
    }
  } else {
    if (typeof req.body.fileUrl == "undefined") {
      return res.status(422).json({
        status: false,
        respon: "Parameter fileUrl tidak ada!",
      });
    }
    if (req.body.fileUrl == "") {
      return res.status(422).json({
        status: false,
        respon: "fileUrl tidak boleh kosong!",
      });
    }
  }

  const clientx = sessions.find((sess) => sess.id == keyuser);
  if (typeof clientx == "undefined") {
    return res.status(422).json({
      status: false,
      respon: "Key tidak terdaftar!",
    });
  }
  const client = clientx.client;
  const isRegisteredNumber = await client.isRegisteredUser(nomor);

  if (!isRegisteredNumber) {
    return res.status(422).json({
      status: false,
      respon: "Nomor tidak terdaftar!",
    });
  }

  if (type == "file") {
    const fileUrl = req.body.fileUrl;
    let mimetype;
    const attachment = await axios
      .get(fileUrl, {
        responseType: "arraybuffer",
      })
      .then((response) => {
        mimetype = response.headers["content-type"];
        return response.data.toString("base64");
      });

    const media = new MessageMedia(mimetype, attachment, "Media");

    client
      .sendMessage(nomor, media, {
        caption: teks,
      })
      .then((response) => {
        let responstatus = setrespon(response);
        res.status(200).json({
          status: true,
          respon: responstatus,
        });
      })
      .catch((err) => {
        res.status(500).json({
          status: false,
          respon: err,
        });
      });
  } else {
    client
      .sendMessage(nomor, teks)
      .then((response) => {
        let responstatus = setrespon(response);
        res.status(200).json({
          status: true,
          respon: responstatus,
        });
      })
      .catch((err) => {
        res.status(500).json({
          status: false,
          respon: err,
        });
      });
  }
});

server.listen(port, function () {
  console.log("App running on *: " + port);
});
