const { Client, MessageMedia } = require("whatsapp-web.js");
const express = require("express");
const { body, validationResult } = require("express-validator");
const socketIO = require("socket.io");
const qrcode = require("qrcode");
const http = require("http");
const { phoneNumberFormatter } = require("./helpers/formatter");
// const fileUpload = require("express-fileupload");
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
// app.use(
//   fileUpload({
//     debug: true,
//   })
// );

const db = require("./helpers/db.js");

var urlwebhook = "http://whatsapp.sisfobis.com/api/balascs";

(async () => {
  app.get("/", (req, res) => {
    res.sendFile("index.html", {
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

  app.post("/setwebhook", (req, res) => {
    // res.status(200).json({
    //   status: "ok",
    //   response: "ok",
    // });
    // console.log("login");
    // console.log(req);
    console.log(req.body.webhook);
    urlwebhook = req.body.webhook;
    res.redirect("/");
    // res.sendFile("index.html", {
    //   root: __dirname,
    // });
  });
  // db.removeSession();
  const savedSession = await db.readSession();
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
    session: savedSession,
  });

  client.on("message", (msg) => {
    axios
      .post(urlwebhook, {
        firstName: "Fred",
        lastName: msg,
      })
      .then(function (response) {
        console.log("callback terkirim");
        console.log(response);
      })
      .catch(function (error) {
        console.log("callback gagal terkirim");
        console.log(error);
      });
    if (msg.body == "!ping") {
      msg.reply("pong");
    } else if (msg.body == "good morning") {
      msg.reply("selamat pagi");
    } else if (msg.body == "!groups") {
      client.getChats().then((chats) => {
        const groups = chats.filter((chat) => chat.isGroup);

        if (groups.length == 0) {
          msg.reply("You have no group yet.");
        } else {
          let replyMsg = "*YOUR GROUPS*\n\n";
          groups.forEach((group, i) => {
            replyMsg += `ID: ${group.id._serialized}\nName: ${group.name}\n\n`;
          });
          replyMsg +=
            "_You can use the group id to send a message to the group._";
          msg.reply(replyMsg);
        }
      });
    }
  });
  // console.log(client.pupPage);

  client.initialize();
  // Socket IO
  // var interval;
  var sss = 0;
  var hhh = 0;
  var statusio = false;
  var ffffff = false;
  // console.log("check io", socket.connected);
  io.on("connection", function (socket) {
    let uu = urlx.parse(socket.handshake.headers.referer);
    if (uu.pathname == "/") {
      sss++;
      ffffff = socket;
      statusio = socket.connected;
      ffffff.emit("URL WEBHOOK", urlwebhook);
      console.log("URL WEBHOOK", urlwebhook);
      ffffff.emit("message", "Connecting...");
      console.log("Connecting...");
      if (client.pupBrowser != null) {
        if (client.pupBrowser._process.killed) {
          console.log("PUPBROWSER...");
          db.removeSession();
          client.destroy();
          client.initialize();
        } else {
          console.log(client.info);
          if (typeof client.info !== "undefined") {
            (async () => {
              checkSession = await db.readSession();
              console.log(checkSession);
              if (checkSession != "") {
                console.log("message", "Whatsapp is ready2!");
                ffffff.emit("ready", "Whatsapp is ready2!");
                ffffff.emit("message", "Whatsapp is ready2!");
              }
            })();
          }
        }
      }
      // if (client.pupPage != null) {
      //   console.log("Client tidak null");
      //   if (!client.pupPage.isClosed()) {
      //     // client.destroy();
      //     // client.initialize();
      //   }
      // }
      // statusio = "connect";
      // db.removeSession();
      // console.log(client.pupPage);
      // sss = 0;

      // interval = setInterval(function () {
      //   console.log(sss);
      //   if (sss > 20) {
      //     clearInterval(interval);
      //     console.log("ooooooooooooooooooooooooooooo");
      //     client.destroy();
      //     client.initialize();
      //   }
      //   sss++;
      // }, 1000);
      console.log(sss);
      if (sss <= 1) {
        client.on("qr", (qr) => {
          console.log("Scan QR-Code", qr);
          // if (typeof interval !== "undefined") {
          //   clearInterval(interval);
          // }
          qrcode.toDataURL(qr, (err, url) => {
            ffffff.emit("qr", url);
            ffffff.emit("message", "QR Code received, scan please!");
          });
        });

        client.on("ready", () => {
          // if (typeof interval !== "undefined") {
          //   clearInterval(interval);
          // }
          console.log("Whatsapp is ready!");
          ffffff.emit("ready", "Whatsapp is ready!");
          ffffff.emit("message", "Whatsapp is ready!");
        });

        client.on("authenticated", (session) => {
          // if (typeof interval !== "undefined") {
          //   clearInterval(interval);
          // }
          console.log("Whatsapp is authenticated!");
          ffffff.emit("authenticated", "Whatsapp is authenticated!");
          ffffff.emit("message", "Whatsapp is authenticated!");
          console.log("AUTHENTICATED", session);
          // Save session to DB
          db.saveSession(session);
          // savedSession = session;
        });

        client.on("auth_failure", function (session) {
          // if (typeof interval !== "undefined") {
          //   clearInterval(interval);
          // }

          console.log("Auth failure, restarting...");
          // console.log(client);
          ffffff.emit("message", "Auth failure, restarting...");
        });

        client.on("disconnected", (reason) => {
          // if (typeof interval !== "undefined") {
          //   clearInterval(interval);
          // }
          ffffff.emit("message", "Whatsapp is disconnected!");
          // Remove session from DB
          console.log("Whatsapp is disconnected!");
          // console.log(client);
          if (statusio) {
            db.removeSession();
            client.destroy();
            client.initialize();
          }
          // console.log("Whatsapp is destroy!");
          // console.log(client.pupPage.isClosed());
        });
      }

      socket.on("disconnect", function () {
        // if (typeof interval !== "undefined") {
        //   clearInterval(interval);
        // }
        console.log("Got disconnect!");
        statusio = socket.connected;
      });
    } else if (uu.pathname == "/realtime") {
      console.log("realtime...");
    }
  });

  const checkRegisteredNumber = async function (number) {
    const isRegistered = await client.isRegisteredUser(number);
    return isRegistered;
  };

  // Send message
  app.post(
    "/send-message",
    [body("number").notEmpty(), body("message").notEmpty()],
    async (req, res) => {
      const errors = validationResult(req).formatWith(({ msg }) => {
        return msg;
      });

      if (!errors.isEmpty()) {
        return res.status(422).json({
          status: false,
          message: errors.mapped(),
        });
      }

      const number = phoneNumberFormatter(req.body.number);
      const message = req.body.message;

      const isRegisteredNumber = await checkRegisteredNumber(number);

      if (!isRegisteredNumber) {
        return res.status(422).json({
          status: false,
          message: "The number is not registered",
        });
      }

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
    }
  );

  const findGroupByName = async function (name) {
    const group = await client.getChats().then((chats) => {
      return chats.find(
        (chat) => chat.isGroup && chat.name.toLowerCase() == name.toLowerCase()
      );
    });
    return group;
  };

  // Send message to group
  // You can use chatID or group name, yea!
  app.post(
    "/send-group-message",
    [
      body("id").custom((value, { req }) => {
        if (!value && !req.body.name) {
          throw new Error("Invalid value, you can use `id` or `name`");
        }
        return true;
      }),
      body("message").notEmpty(),
    ],
    async (req, res) => {
      const errors = validationResult(req).formatWith(({ msg }) => {
        return msg;
      });

      if (!errors.isEmpty()) {
        return res.status(422).json({
          status: false,
          message: errors.mapped(),
        });
      }

      let chatId = req.body.id;
      const groupName = req.body.name;
      const message = req.body.message;

      // Find the group by name
      if (!chatId) {
        const group = await findGroupByName(groupName);
        if (!group) {
          return res.status(422).json({
            status: false,
            message: "No group found with name: " + groupName,
          });
        }
        chatId = group.id._serialized;
      }

      client
        .sendMessage(chatId, message)
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
    }
  );

  server.listen(port, function () {
    console.log("App running on *: " + port);
  });
})();
