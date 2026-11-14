require("dotenv").config();

//#region express configures
var express = require("express");
var path = require("path");
var logger = require("morgan");
const session = require("client-sessions");
const DButils = require("./routes/utils/DButils");
var cors = require("cors");

var app = express();

app.use(logger("dev"));
app.use(express.json());

app.use(
  session({
    cookieName: "session",
    // secret: process.env.COOKIE_SECRET,
    secret: "template",
    duration: 24 * 60 * 60 * 1000,
    activeDuration: 1000 * 60 * 5,
    cookie: {
      httpOnly: false,
    },
  })
);

app.use(express.urlencoded({ extended: false }));
app.use(express.static(path.join(__dirname, "public")));
app.use(express.static(path.join(__dirname, "dist")));

app.get("/", function (req, res) {
  res.sendFile(__dirname + "/index.html");
});

const corsConfig = {
  origin: "http://localhost:8080",
  credentials: true,
};

app.use(cors(corsConfig));
app.options("*", cors(corsConfig));

var port = process.env.PORT || "3000";
//#endregion

const user = require("./routes/user");
const recipes = require("./routes/recipes");
const auth = require("./routes/auth");

//#region cookie middleware
app.use(function (req, res, next) {
  if (req.session && req.session.user_id) {
    DButils.execQuery("SELECT user_id FROM users")
      .then((users) => {
        if (users.find((x) => x.user_id === req.session.user_id)) {
          req.user_id = req.session.user_id;
        }
        next();
      })
      .catch((error) => next());
  } else {
    next();
  }
});
//#endregion

app.get("/alive", (req, res) => res.send("I'm alive"));

// Routings
app.use("/user", user);
app.use("/recipes", recipes);
app.use("/", auth);

// Error handler
app.use(function (err, req, res, next) {
  console.error(err);
  res.status(err.status || 500).send({
    message: err.message,
    success: false,
  });
});

// Start listening only when this file is run directly.
if (require.main === module) {
  const server = app.listen(port, () => {
    console.log(`Server listen on port ${port}`);
  });

  process.on("SIGINT", function () {
    server.close(() => {
      console.log("server closed");
      process.exit();
    });
  });
}

// Allow tests to import the Express application.
module.exports = app;