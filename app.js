const express = require("express");
const app = express();
const userModel = require("./models/user");
const postModel = require("./models/post");
const cookieParser = require("cookie-parser");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcrypt");
const crypto = require("crypto");
const path = require("path");
const upload= require("./config/multerconfig");

app.set("view engine", "ejs");
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, "public")));



app.get("/", (req, res) => {
  res.render("index");
});

app.get("/profile/upload", (req,res)=>{
  res.render("profileuploads")
});

app.post("/upload",  isLoggedIn, upload.single("image"), async(req, res) => {
  let user=await userModel.findOne({email:req.user.email});
  user.profilepic=req.file.filename;
  await user.save();
  res.redirect("profile");
  
});


app.get("/login", (req, res) => {
  res.render("login");
});

app.get("/profile", isLoggedIn, async (req, res) => {
  let user = await userModel.findOne({ email: req.user.email }).populate("posts");
  res.render("profile", { user });
});

app.get("/like/:id", isLoggedIn, async (req, res) => {
  try {
    let post = await postModel.findById(req.params.id).populate("user");
    if (!post) return res.status(404).send("Post not found");

    if (post.likes.indexOf(req.user.userid) === -1) {
      post.likes.push(req.user.userid);
    } else {
      post.likes.splice(post.likes.indexOf(req.user.userid), 1);
    }

    await post.save();
    res.redirect("/profile");
  } catch (err) {
    console.error("Error while liking post:", err);
    res.status(500).send("Internal Server Error");
  }
});

app.get("/edit/:id", isLoggedIn, async (req, res) => {
  let post = await postModel.findById(req.params.id).populate("user");
  res.render("edit", { post });
});

app.post("/update/:id", isLoggedIn, async (req, res) => {
  await postModel.findOneAndUpdate(
    { _id: req.params.id },
    { content: req.body.content }
  );
  res.redirect("/profile");
});

app.post("/post", isLoggedIn, async (req, res) => {
  let user = await userModel.findOne({ email: req.user.email });
  let { content } = req.body;
  let post = await postModel.create({
    user: user._id,
    content,
  });
  user.posts.push(post._id);
  await user.save();
  res.redirect("/profile");
});

app.post("/register", async (req, res) => {
  let { username, email, password, name, age } = req.body;
  let existingUser = await userModel.findOne({ email });
  if (existingUser) return res.status(400).send("User already exists");

  const salt = await bcrypt.genSalt(10);
  const hash = await bcrypt.hash(password, salt);

  let newUser = await userModel.create({
    username,
    email,
    name,
    age,
    password: hash,
  });

  let token = jwt.sign({ email: email, userid: newUser._id }, "secret");
  res.cookie("token", token, { httpOnly: true });
  res.send("Registered successfully");
});

app.post("/login", async (req, res) => {
  let { email, password } = req.body;
  let user = await userModel.findOne({ email });
  if (!user) return res.status(400).send("User not found");

  const isMatch = await bcrypt.compare(password, user.password);
  if (!isMatch) return res.status(400).send("Incorrect password");

  let token = jwt.sign({ email: email, userid: user._id }, "secret");
  res.cookie("token", token, { httpOnly: true });
  res.redirect("/profile");
});

app.get("/logout", (req, res) => {
  res.clearCookie("token");
  res.redirect("/login");
});

function isLoggedIn(req, res, next) {
  const token = req.cookies.token;
  if (!token) return res.redirect("/login");
  const data = jwt.verify(token, "secret");
  req.user = data;
  next();
}

app.listen(3000, () => {
  console.log("Server is running on port 3000");
});

