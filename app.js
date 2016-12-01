var port = process.env.PORT || 8888;

var express = require('express');
var app = express();

var bodyParser = require('body-parser');
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({extended: false}));

var db = require('./db');

var md5 = require('js-md5');
var bcrypt = require('bcrypt');
var saltRounds = 10;

app.get('/authenticated_data', function(req, res) {
  if (!req.headers.authorization) {
    res.status(401).send("must be authenticated");
  }
  var token = req.headers.authorization.split(" ")[1]; // fu
  db.qq('SELECT id FROM sessionz WHERE token = $1', [token], function(err, result) {
      if (result.rows.length < 1) {
        res.status(403).send("invalid auth token");
      } else {
        res.status(200).send("i refuse to ever use the phrase boo yah");
      }
  });
});

app.post('/users', function(req, res) {
  var email = req.body.email;
  var pass = req.body.pass;

  var shittyRegex = /^[a-z0-9_-]+@[a-z0-9]+\.[a-z0-9]{2,4}$/;
  if (!email.toLowerCase().match(shittyRegex)) { //lolllololololo
    res.status(422).send(emitError("enter a real fucking email"));
  }

  // feel like this should be on the frontend ok like why the hlel would i wait this far before denying someone for this trivial reason
  if (pass.length < 6) {
    res.status(422).send(emitError("pass must be at least 6 char"));
  }

  db.qq('SELECT id FROM userz WHERE email = $1', [email], function(err, result) {
    if (result.rows.length > 0) {
      res.status(422).send(emitError("user already exists"));
    } else {
      bcrypt.hash(pass, saltRounds, function(err, hash) {
        db.qq('INSERT INTO userz (email, password) VALUES ($1, $2) RETURNING id, created_at, updated_at, email', [email, hash], function(err, newUser) {
          res.status(201).send(newUser.rows[0]);
        });
      });
    }
  });
});

// create new session
app.post('/sessions', function(req, res) {
  var email = req.body.email;
  var pass = req.body.pass;
  db.qq('SELECT password FROM userz WHERE email = $1', [email], function(err, result) {
    if (result.rows.length < 1) {
      res.status(422).send(emitError("invalid"));
    } else {
      var hash = result.rows[0].password;
      bcrypt.compare(pass, hash, function(err, check) {
        if (!check) {
          res.status(422).send(emitError("invalid"));
        } else {
          db.qq('INSERT INTO sessionz (token) VALUES ($1) RETURNING id, token', [md5(new Date().toString())], function(err, newSess) {
            res.status(201).send(newSess.rows[0]);
          });
        }
      });
    }
  });
});

app.delete('/sessions/:sessionId', function(req, res) {
  if (!req.headers.authorization) {
    res.status(401).send(emitError("must be authenticated"));
  }
  var token = req.headers.authorization.split(" ")[1];
  db.qq('SELECT token FROM sessionz WHERE id = $1', [req.params.sessionId], function(err, result) {
    if (result.rows.length < 1) {
      res.status(403).send(emitError("invalid"));
    } else {
      var sessToken = result.rows[0].token;
      if (sessToken != token) {
        res.status(403).send(emitError("not authorized"));
      } else {
        db.qq('DELETE FROM sessionz WHERE id = $1', [req.params.sessionId], function(err, result) {
          res.status(200).send();
        });
      } 
    }
  });
});


app.get("/", function(req, res) {
  res.send("GET /authenticated_data | no login thing idfk how to do that POST /users | POST /sessions | do some other shit");
});

function emitError(msg) {
  return {
    error: msg
  };
}

app.listen(port);
