require("dotenv").config();
const express = require("express");
const mongoose = require('mongoose');
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const nodemailer = require("nodemailer");
const cors = require("cors");

const multer = require("multer");
const path = require("path");

const User = require('./model/User');
const Category = require('./model/Category');
const Business = require('./model/Business');
const BusinessDetail = require('./model/BusinessDetail');
const app = express();
app.use(express.json());
app.use(cors());
app.use("/uploads", express.static("uploads"));

// =======================
// MongoDB
// =======================
mongoose.connect("mongodb://127.0.0.1:27017/authsystem")
.then(()=>console.log("Mongo Connected"))
.catch(err=>console.log(err));


// =======================
// Email Config
// =======================
const transporter = nodemailer.createTransport({
  service:"gmail",
  auth:{
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "uploads/image");
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + path.extname(file.originalname));
  }
});
const upload = multer({ storage });


// =======================
// Register
// =======================
app.post("/api/register", async(req,res)=>{
  const {email,password} = req.body;

  const exist = await User.findOne({email});
  if(exist) return res.json({success:false,message:"Email already exists"});

  const hash = await bcrypt.hash(password,10);

  const otp = Math.floor(100000+Math.random()*900000).toString();

  const user = new User({
    email,password:hash,otp,
    otpExpire: new Date(Date.now()+5*60*1000)
  });

  await user.save();

  await transporter.sendMail({
    to:email,
    subject:"Verify OTP",
    html:`<h2>Your OTP is ${otp}</h2>`
  });

  res.json({success:true,message:"OTP sent to email"});
});

// =======================
// Verify OTP
// =======================
app.post("/api/verify-otp", async(req,res)=>{
  const {email,otp} = req.body;

  const user = await User.findOne({email,otp});

  if(!user) return res.json({success:false,message:"Invalid OTP"});

  if(user.otpExpire < new Date())
    return res.json({success:false,message:"OTP expired"});

  user.otp = null;
  user.otpExpire = null;
  await user.save();

  res.json({success:true,message:"Email verified"});
});

// =======================
// Login
// =======================
app.post("/api/login", async(req,res)=>{
  const {email,password} = req.body;

  const user = await User.findOne({email});
  if(!user) return res.json({success:false,message:"User not found"});

  const match = await bcrypt.compare(password.trim(),user.password);
  if(!match) return res.json({success:false,message:"Wrong password"});

  const token = jwt.sign({id:user._id},"SECRETKEY",{expiresIn:"1d"});

  res.json({success:true,token,user});
});

// =======================
// Forgot Password
// =======================
app.post("/api/forgot", async(req,res)=>{
  const {email} = req.body;

  const user = await User.findOne({email});
  if(!user) return res.json({success:false, message:"User not found"});

  const otp = Math.floor(100000+Math.random()*900000).toString();
  user.otp = otp;
  user.otpExpire = new Date(Date.now()+5*60*1000);
  await user.save();

  // ✅ Send OTP Email
  try {
    await transporter.sendMail({
      to: email,
      subject: "Your OTP for password reset",
      html: `<h3>Your OTP is: <b>${otp}</b></h3>`
    });
    console.log("OTP sent to email:", email);
  } catch(err) {
    console.log("Error sending OTP email:", err);
    return res.json({success:false, message:"Failed to send OTP"});
  }

  res.json({success:true, message:"OTP sent to email"});
});


// =======================
// Reset Password
// =======================
app.post("/api/reset-password", async(req,res)=>{
  const {email, otp, newPassword} = req.body;

  const user = await User.findOne({email, otp});
  if(!user) return res.json({success:false, message:"Invalid OTP"});

  if(user.otpExpire < new Date())
    return res.json({success:false, message:"OTP expired"});

  user.password = await bcrypt.hash(newPassword, 10);
  user.otp = null;
  user.otpExpire = null;

  await user.save();

  res.json({success:true, message:"Password reset successful"});
});


// ADD
app.post("/api/category/add", upload.single("image"), async (req, res) => {
  const cat = new Category({
    name: req.body.name,
    status: req.body.status,
    image: req.file ? `/uploads/image/${req.file.filename}` : ""
  });
  await cat.save();
  res.send({ success: true });
});


// GET ALL
app.get("/api/category", async (req, res) => {
  const data = await Category.find();
  res.send(data);
});

// GET SINGLE
// GET SINGLE CATEGORY (safe)
app.get("/api/category/:id", async (req, res) => {
  const { id } = req.params;

  // Check if id exists
  if (!id) return res.status(400).send({ success: false, message: "Category ID missing" });

  // Check if valid Mongo ObjectId
  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res.status(400).send({ success: false, message: "Invalid Category ID" });
  }

  try {
    const category = await Category.findById(id);
    if (!category) return res.status(404).send({ success: false, message: "Category not found" });

    res.send(category);
  } catch (err) {
    res.status(500).send({ success: false, error: err.message });
  }
});

// update
app.put("/api/category/update/:id", upload.single("image"), async (req, res) => {

  const obj = {
    name: req.body.name,
    status: req.body.status
  };

  if (req.file) {
    obj.image = `/uploads/image/${req.file.filename}`;
  }

  await Category.findByIdAndUpdate(req.params.id, obj);
  res.send({ success: true });
});



// DELETE
app.delete("/api/category/delete/:id", async (req, res) => {
  await Category.findByIdAndDelete(req.params.id);
  res.send({ success: true });
});


// ========== BUSINESS ROUTES ==========

// ADD Business
app.post("/api/business/add", upload.single("image"), async (req, res) => {
  try {
    const data = new Business({
      name: req.body.name,
      category: req.body.category,
      mobile: req.body.mobile,
      whatsapp: req.body.whatsapp,
      address: req.body.address,
      city: req.body.city,
      status: req.body.status,
      image: req.file ? "/uploads/image/" + req.file.filename : ""
    });
    await data.save();
    res.send({ success: true, business: data });
  } catch (err) {
    res.status(500).send({ success: false, error: err.message });
  }
});

// GET all Businesses
app.get("/api/business", async (req, res) => {
  try {
    const data = await Business.find().populate("category").sort({ createdAt: -1 });
    res.send(data);
  } catch (err) {
    res.status(500).send({ success: false, error: err.message });
  }
});

// UPDATE Business
app.put("/api/business/update/:id", upload.single("image"), async (req, res) => {
  try {
    const obj = {
      name: req.body.name,
      category: req.body.category,
      mobile: req.body.mobile,
    whatsapp: req.body.whatsapp,
      address: req.body.address,
      city: req.body.city,
      status: req.body.status === "true" || req.body.status === true
    };
    if (req.file) obj.image = "/uploads/image/" + req.file.filename;
    await Business.findByIdAndUpdate(req.params.id, obj);
    res.send({ success: true });
  } catch (err) {
    res.status(500).send({ success: false, error: err.message });
  }
});

// DELETE Business
app.delete("/api/business/delete/:id", async (req, res) => {
  try {
    await Business.findByIdAndDelete(req.params.id);
    res.send({ success: true });
  } catch (err) {
    res.status(500).send({ success: false, error: err.message });
  }
});

// GET businesses by category with contact info
app.get("/api/business/category/:id", async (req, res) => {
  try {
    const categoryId = req.params.id;
    const city = req.query.city; // optional city filter

    // Build filter
    const filter = { category: categoryId };
    if (city && city !== "all") filter.city = city;

    // Fetch businesses and populate category
    const businesses = await Business.find(filter)
      .populate("category")
      .sort({ createdAt: -1 });

    // Send response
    res.send(businesses);
  } catch (err) {
    console.error(err);
    res.status(500).send({ success: false, error: err.message });
  }
});

// GET single business by id
app.get("/api/business/:id", async (req, res) => {
  try {
    const business = await Business.findById(req.params.id).populate("category");
    res.send(business);
  } catch (err) {
    res.status(500).send({ success: false, error: err.message });
  }
});



// ADD or UPDATE business detail
app.post("/api/business-detail/add",
  upload.fields([
    { name: "bannerImage", maxCount: 1 },
    { name: "gallery", maxCount: 3 }
  ]),
  async (req, res) => {
    try {
      // Banner
      const banner = req.files["bannerImage"] ? req.files["bannerImage"][0].filename : null;

      // Gallery
      const gallery = req.files["gallery"]
        ? req.files["gallery"].map(f => "/uploads/image/" + f.filename)
        : [];

        const old = await BusinessDetail.findOne({ businessId: req.body.businessId });

      const data = await BusinessDetail.findOneAndUpdate(
        { businessId: req.body.businessId },
        {
          businessId: req.body.businessId,
          description: req.body.description,
          services: req.body.services ? req.body.services.split(",") : [],
         bannerImage: banner
  ? "/uploads/image/" + banner
  : old?.bannerImage || "",
          gallery :gallery.length > 0 ? gallery : old?.gallery || []
        },
        { upsert: true, new: true }
      );

      res.send({ success: true, data });
    } catch (err) {
      console.error("Business Detail Save Error:", err);
      res.status(500).send({ success: false, error: err.message });
    }
  }
);



app.get("/api/business-detail/:id", async (req, res) => {
  try {
    const business = await Business.findById(req.params.id)
      .populate("category");

    const detail = await BusinessDetail.findOne({
      businessId: req.params.id
    });

    res.send({
      ...business.toObject(),

      // ✅ ye fields add karo
      bannerImage: detail?.bannerImage || "",
      gallery: detail?.gallery || [],

      description: detail?.description || "",
      services: detail?.services || [],
      sections: detail?.sections || []
    });

  } catch (err) {
    res.status(500).send({ error: err.message });
  }
});
// console.log






// SEARCH category + business + city
app.get("/api/category/search", async (req, res) => {
  try {
    const q = (req.query.q || "").trim();
    const city = req.query.city;

    if (!q && !city) {
      return res.send(await Category.find());
    }

    const data = await Category.aggregate([
      {
        $lookup: {
          from: "businesses",
          localField: "_id",
          foreignField: "category",
          as: "businesses",
        },
      },
      {
        $match: {
          ...(q ? { name: { $regex: q, $options: "i" } } : {}),
          ...(city ? { "businesses.city": city } : {}),
        },
      },
    ]);

    res.send(data);
  } catch (err) {
    res.status(500).send([]);
  }
});


// GET categories by city (aggregate + businesses)
app.get("/api/categories/by-city", async (req, res) => {
  try {
    const { city } = req.query;
    if (!city || city.trim() === "") return res.send([]);

    // Aggregate categories with businesses in that city
    const categories = await Category.aggregate([
      {
        $lookup: {
          from: "businesses", // MongoDB collection name (make sure lowercase + plural)
          localField: "_id",
          foreignField: "category",
          as: "businesses",
        },
      },
      {
        $match: {
          "businesses.city": { $regex: `^${city.trim()}$`, $options: "i" },
        },
      },
    ]);

    res.send(categories);
  } catch (err) {
    console.error(err);
    res.status(500).send([]);
  }
});



// Dynamic cities
app.get("/api/cities", async (req, res) => {
  const cities = await Business.distinct("city");
  res.send(cities);
});






// GET UNIQUE CITIES

app.get("/api/category/by-city", async (req, res) => {
  try {
    const { city } = req.query;

    if (!city || city === "all") {
      const categories = await Category.find({ status: true });
      return res.send(categories);
    }

    // 🔥 business se category ids
    const businesses = await Business.find({ city }).select("category");

    const categoryIds = [
      ...new Set(businesses.map(b => b.category?.toString()))
    ];

    const categories = await Category.find({
      _id: { $in: categoryIds },
      status: true
    });

    res.send(categories);
  } catch (err) {
    res.status(500).send([]);
  }
});



// =======================
// Server
// =======================
app.listen(5000,()=>{
  console.log("Auth Server Running on 5000");
});
